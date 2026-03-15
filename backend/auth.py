import json
import threading
import time
from pathlib import Path
from typing import Optional

import msal

CONFIG_PATH = Path(__file__).parent / "config.json"

REQUIRED_SCOPES = [
    "DeviceManagementConfiguration.ReadWrite.All",
    "DeviceManagementApps.Read.All",
    "DeviceManagementManagedDevices.Read.All",
    "Group.ReadWrite.All",
    "Directory.Read.All",
    "User.Read",
]

SCOPE_DESCRIPTIONS = {
    "DeviceManagementConfiguration.ReadWrite.All": "Read & add devices to groups; view config profiles",
    "DeviceManagementApps.Read.All": "View app assignments in group audit",
    "DeviceManagementManagedDevices.Read.All": "Resolve device names to IDs",
    "Group.ReadWrite.All": "Search groups and add members",
    "Directory.Read.All": "Look up Entra device objects",
    "User.Read": "Display your signed-in account name",
}

# In-memory state (single-user local tool)
_token_cache: dict = {}
_device_flow: Optional[dict] = None
_msal_app: Optional[msal.PublicClientApplication] = None
_lock = threading.Lock()


def load_config() -> Optional[dict]:
    if CONFIG_PATH.exists():
        return json.loads(CONFIG_PATH.read_text())
    return None


def save_config(client_id: str, tenant_id: str) -> None:
    CONFIG_PATH.write_text(json.dumps({"client_id": client_id, "tenant_id": tenant_id}, indent=2))


def _get_app(client_id: str, tenant_id: str) -> msal.PublicClientApplication:
    authority = f"https://login.microsoftonline.com/{tenant_id}" if tenant_id else "https://login.microsoftonline.com/common"
    return msal.PublicClientApplication(client_id=client_id, authority=authority)


def get_msal_app() -> Optional[msal.PublicClientApplication]:
    global _msal_app
    with _lock:
        if _msal_app is None:
            cfg = load_config()
            if cfg:
                _msal_app = _get_app(cfg["client_id"], cfg["tenant_id"])
        return _msal_app


def reset_msal_app(client_id: str, tenant_id: str) -> msal.PublicClientApplication:
    global _msal_app
    with _lock:
        _msal_app = _get_app(client_id, tenant_id)
        return _msal_app


def _friendly_error(description: str) -> str:
    """Convert AAD error codes into actionable messages."""
    if "AADSTS7000218" in description:
        return (
            "Your Entra app registration does not have public client flows enabled. "
            "Fix: go to portal.azure.com → Entra ID → App registrations → your app → "
            "Authentication → scroll to 'Advanced settings' → set "
            "'Allow public client flows' to Yes → Save."
        )
    if "AADSTS700016" in description:
        return "Application not found. Double-check your Client ID in Settings."
    if "AADSTS90002" in description:
        return "Tenant not found. Double-check your Tenant ID in Settings."
    return description


def initiate_device_flow() -> dict:
    global _device_flow
    app = get_msal_app()
    if not app:
        raise RuntimeError("App not configured. Complete setup first.")
    scopes = [f"https://graph.microsoft.com/{s}" for s in REQUIRED_SCOPES]
    flow = app.initiate_device_flow(scopes=scopes)
    if "error" in flow:
        raw = flow.get("error_description", flow["error"])
        raise RuntimeError(_friendly_error(raw))
    with _lock:
        _device_flow = flow
    return {
        "user_code": flow["user_code"],
        "verification_uri": flow["verification_uri"],
        "expires_in": flow.get("expires_in", 900),
        "message": flow.get("message", ""),
    }


def poll_device_flow() -> dict:
    global _device_flow, _token_cache
    with _lock:
        flow = _device_flow
    if not flow:
        return {"status": "no_flow"}
    app = get_msal_app()
    if not app:
        return {"status": "error", "message": "App not configured"}
    try:
        # exit_condition=lambda f: True makes MSAL do one poll and return immediately
        # instead of blocking for the entire 15-minute flow lifetime.
        result = app.acquire_token_by_device_flow(flow, exit_condition=lambda f: True)
    except Exception as e:
        return {"status": "error", "message": str(e)}
    if "access_token" in result:
        with _lock:
            _token_cache = result
            _device_flow = None
        return {"status": "authenticated"}
    error = result.get("error", "")
    if error in ("authorization_pending", "slow_down"):
        return {"status": "pending"}
    return {"status": "error", "message": result.get("error_description", error)}


def get_token() -> Optional[str]:
    """Return the cached access token. Tokens are valid for ~1 hour after sign-in.
    If the token has expired, the user can sign out and sign back in."""
    with _lock:
        return _token_cache.get("access_token")


def get_current_user() -> Optional[dict]:
    with _lock:
        cache = _token_cache.copy()
    if not cache:
        return None
    id_claims = cache.get("id_token_claims") or {}
    return {
        "name": id_claims.get("name", id_claims.get("preferred_username", "Unknown")),
        "upn": id_claims.get("preferred_username", ""),
    }


def get_permission_status() -> list[dict]:
    token = get_token()
    if not token:
        return [{"scope": s, "granted": False, "description": SCOPE_DESCRIPTIONS.get(s, "")} for s in REQUIRED_SCOPES]

    # Decode scopes from the access token claims (MSAL stores them)
    with _lock:
        cache = _token_cache.copy()
    granted_scopes_str = cache.get("scope", "")
    granted = set(s.lower() for s in granted_scopes_str.split())

    result = []
    for scope in REQUIRED_SCOPES:
        # Graph scopes appear as "https://graph.microsoft.com/Scope" or just "Scope"
        short = scope.lower()
        full = f"https://graph.microsoft.com/{scope}".lower()
        is_granted = short in granted or full in granted
        result.append({
            "scope": scope,
            "granted": is_granted,
            "description": SCOPE_DESCRIPTIONS.get(scope, ""),
        })
    return result


def logout() -> None:
    global _token_cache, _device_flow, _msal_app
    with _lock:
        _token_cache = {}
        _device_flow = None
        _msal_app = None
    # Rebuild app without cached accounts
    get_msal_app()
