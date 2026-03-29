"""Multi-provider AI integration layer for Intune AI Studio.

Supported providers:
  - anthropic  (Claude)
  - openai     (GPT-4o)
  - azure      (Azure OpenAI / Copilot)
  - gemini     (Google Gemini)

Provides streaming and non-streaming AI features:
  - Natural language device search (NL → OData filter → Graph query)
  - Policy explainer (config profile JSON → plain-English breakdown)
  - Remediation script generator (problem description → PowerShell)
  - Compliance gap analysis (group policies → gap report)
  - Group cleanup advisor (group data → safe-to-delete recommendation)
"""

import json
import logging
import os
from pathlib import Path
from typing import AsyncIterator

import graph

log = logging.getLogger(__name__)

CONFIG_PATH = Path(__file__).parent / "config.json"
MAX_TOKENS = 4096

# Default models per provider
DEFAULT_MODELS = {
    "anthropic": "claude-sonnet-4-20250514",
    "openai": "gpt-4o",
    "azure": "gpt-4o",
    "gemini": "gemini-2.5-flash",
}

PROVIDER_LABELS = {
    "anthropic": "Anthropic (Claude)",
    "openai": "OpenAI (GPT-4o)",
    "azure": "Azure OpenAI (Copilot)",
    "gemini": "Google (Gemini)",
}


# ── Config Management ────────────────────────────────────────────────────────

def _load_ai_config() -> dict:
    """Load AI provider config from config.json."""
    if CONFIG_PATH.exists():
        cfg = json.loads(CONFIG_PATH.read_text())
        return {
            "provider": cfg.get("ai_provider", ""),
            "api_key": cfg.get("ai_api_key", ""),
            "endpoint": cfg.get("ai_endpoint", ""),
            "model": cfg.get("ai_model", ""),
        }
    return {"provider": "", "api_key": "", "endpoint": "", "model": ""}


def get_ai_status() -> dict:
    """Check whether AI is configured and which provider is active."""
    cfg = _load_ai_config()
    # Fall back to legacy anthropic_api_key field
    if not cfg["api_key"] and CONFIG_PATH.exists():
        full_cfg = json.loads(CONFIG_PATH.read_text())
        if full_cfg.get("anthropic_api_key"):
            cfg["provider"] = "anthropic"
            cfg["api_key"] = full_cfg["anthropic_api_key"]
    # Fall back to env vars
    if not cfg["api_key"]:
        for env_key, provider in [
            ("ANTHROPIC_API_KEY", "anthropic"),
            ("OPENAI_API_KEY", "openai"),
            ("AZURE_OPENAI_API_KEY", "azure"),
            ("GEMINI_API_KEY", "gemini"),
        ]:
            val = os.environ.get(env_key)
            if val:
                cfg["provider"] = provider
                cfg["api_key"] = val
                break
    return {
        "configured": bool(cfg["provider"] and cfg["api_key"]),
        "provider": cfg["provider"],
        "providers": list(PROVIDER_LABELS.keys()),
        "providerLabels": PROVIDER_LABELS,
    }


def save_ai_config(provider: str, api_key: str, endpoint: str = "", model: str = "") -> None:
    """Persist AI provider settings into config.json."""
    cfg = {}
    if CONFIG_PATH.exists():
        cfg = json.loads(CONFIG_PATH.read_text())
    cfg["ai_provider"] = provider
    cfg["ai_api_key"] = api_key
    cfg["ai_endpoint"] = endpoint
    cfg["ai_model"] = model
    CONFIG_PATH.write_text(json.dumps(cfg, indent=2))


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


# ── Provider Abstraction ─────────────────────────────────────────────────────

def _get_provider_config() -> dict:
    """Get the active provider config, with fallbacks."""
    cfg = _load_ai_config()
    # Legacy fallback
    if not cfg["api_key"] and CONFIG_PATH.exists():
        full_cfg = json.loads(CONFIG_PATH.read_text())
        if full_cfg.get("anthropic_api_key"):
            cfg["provider"] = "anthropic"
            cfg["api_key"] = full_cfg["anthropic_api_key"]
    # Env fallback
    if not cfg["api_key"]:
        for env_key, provider in [
            ("ANTHROPIC_API_KEY", "anthropic"),
            ("OPENAI_API_KEY", "openai"),
            ("AZURE_OPENAI_API_KEY", "azure"),
            ("GEMINI_API_KEY", "gemini"),
        ]:
            val = os.environ.get(env_key)
            if val:
                cfg["provider"] = provider
                cfg["api_key"] = val
                if provider == "azure":
                    cfg["endpoint"] = os.environ.get("AZURE_OPENAI_ENDPOINT", "")
                break
    if not cfg["provider"] or not cfg["api_key"]:
        raise RuntimeError("No AI provider configured. Set one up in the AI Tools settings.")
    cfg["model"] = cfg["model"] or DEFAULT_MODELS.get(cfg["provider"], "")
    return cfg


async def _create_message(system: str, user_content: str) -> str:
    """Non-streaming message → full text response."""
    cfg = _get_provider_config()
    provider = cfg["provider"]

    if provider == "anthropic":
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=cfg["api_key"])
        response = await client.messages.create(
            model=cfg["model"], max_tokens=MAX_TOKENS,
            system=system,
            messages=[{"role": "user", "content": user_content}],
        )
        return response.content[0].text

    elif provider in ("openai", "azure"):
        import openai
        if provider == "azure":
            client = openai.AsyncAzureOpenAI(
                api_key=cfg["api_key"],
                azure_endpoint=cfg["endpoint"],
                api_version="2024-12-01-preview",
            )
        else:
            client = openai.AsyncOpenAI(api_key=cfg["api_key"])
        response = await client.chat.completions.create(
            model=cfg["model"], max_tokens=MAX_TOKENS,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_content},
            ],
        )
        return response.choices[0].message.content or ""

    elif provider == "gemini":
        from google import genai
        client = genai.Client(api_key=cfg["api_key"])
        response = await client.aio.models.generate_content(
            model=cfg["model"],
            contents=user_content,
            config=genai.types.GenerateContentConfig(
                system_instruction=system,
                max_output_tokens=MAX_TOKENS,
            ),
        )
        return response.text or ""

    raise RuntimeError(f"Unknown AI provider: {provider}")


async def _stream_message(system: str, user_content: str) -> AsyncIterator[str]:
    """Streaming message → yields SSE token events."""
    cfg = _get_provider_config()
    provider = cfg["provider"]

    try:
        if provider == "anthropic":
            import anthropic
            client = anthropic.AsyncAnthropic(api_key=cfg["api_key"])
            async with client.messages.stream(
                model=cfg["model"], max_tokens=MAX_TOKENS,
                system=system,
                messages=[{"role": "user", "content": user_content}],
            ) as stream:
                async for text in stream.text_stream:
                    yield _sse({"type": "token", "text": text})

        elif provider in ("openai", "azure"):
            import openai
            if provider == "azure":
                client = openai.AsyncAzureOpenAI(
                    api_key=cfg["api_key"],
                    azure_endpoint=cfg["endpoint"],
                    api_version="2024-12-01-preview",
                )
            else:
                client = openai.AsyncOpenAI(api_key=cfg["api_key"])
            stream = await client.chat.completions.create(
                model=cfg["model"], max_tokens=MAX_TOKENS, stream=True,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_content},
                ],
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta if chunk.choices else None
                if delta and delta.content:
                    yield _sse({"type": "token", "text": delta.content})

        elif provider == "gemini":
            from google import genai
            client = genai.Client(api_key=cfg["api_key"])
            async for chunk in client.aio.models.generate_content_stream(
                model=cfg["model"],
                contents=user_content,
                config=genai.types.GenerateContentConfig(
                    system_instruction=system,
                    max_output_tokens=MAX_TOKENS,
                ),
            ):
                if chunk.text:
                    yield _sse({"type": "token", "text": chunk.text})

        else:
            yield _sse({"type": "error", "message": f"Unknown provider: {provider}"})
            return

        yield _sse({"type": "done"})

    except Exception as e:
        yield _sse({"type": "error", "message": str(e)})


# ── Feature 1: Natural Language Device Search ────────────────────────────────

_DEVICE_SEARCH_SYSTEM = """You are an expert at translating natural language queries about Intune-managed devices
into Microsoft Graph API OData filters for the /deviceManagement/managedDevices endpoint.

Available filterable properties:
- deviceName (string) — the device hostname
- operatingSystem (string) — "Windows", "macOS", "iOS", "Android"
- complianceState (string) — "compliant", "noncompliant", "unknown", "conflict", "error", "inGracePeriod", "configManager"
- isEncrypted (boolean)
- model (string) — device hardware model
- manufacturer (string) — e.g. "Microsoft", "Apple", "Dell", "Lenovo"
- enrolledDateTime (DateTimeOffset) — when the device was enrolled
- lastSyncDateTime (DateTimeOffset) — last Intune check-in
- userDisplayName (string) — primary user
- userPrincipalName (string) — primary user UPN
- managementAgent (string) — "mdm", "eas", "configurationManagerClient", etc.
- deviceEnrollmentType (string) — "userEnrollment", "deviceEnrollmentManager", "appleBulkWithUser", etc.
- managedDeviceName (string) — Intune display name (may differ from deviceName)
- serialNumber (string)
- totalStorageSpaceInBytes (Int64)
- freeStorageSpaceInBytes (Int64)

OData filter syntax rules:
- String comparison: propertyName eq 'value'
- Starts with: startswith(propertyName,'value')
- Contains: contains(propertyName,'value')
- Boolean: isEncrypted eq true
- Date comparison: lastSyncDateTime lt 2024-01-15T00:00:00Z
- Logical: and, or, not
- For "days ago" calculations, compute the actual ISO 8601 date

You MUST respond with ONLY a valid JSON object (no markdown, no explanation) in this format:
{
  "filter": "<OData $filter string>",
  "select": "<comma-separated $select properties to return>",
  "description": "<one-sentence summary of what this query finds>"
}

If the query cannot be translated to a valid OData filter, respond with:
{"filter": null, "select": null, "description": "<explanation of why>"}"""


async def device_search(query: str, token: str) -> dict:
    """Translate a natural language query into a Graph API device search."""
    import datetime
    today = datetime.date.today().isoformat()

    raw = await _create_message(
        _DEVICE_SEARCH_SYSTEM,
        f"Today's date is {today}. Query: {query}",
    )

    raw = raw.strip()
    # Some providers wrap JSON in markdown code fences
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {"error": "AI returned an invalid response. Try rephrasing your query.", "raw": raw}

    odata_filter = parsed.get("filter")
    if not odata_filter:
        return {"error": parsed.get("description", "Could not translate that query."), "devices": []}

    # Execute the Graph query
    import httpx
    select_fields = parsed.get("select", "deviceName,operatingSystem,complianceState,lastSyncDateTime,userDisplayName")
    params = {
        "$filter": odata_filter,
        "$select": select_fields,
        "$top": "100",
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as http:
            devices = await graph._get_paged(http, token, f"{graph.GRAPH_BASE}/deviceManagement/managedDevices", params)
    except httpx.HTTPStatusError as e:
        error_body = e.response.text if hasattr(e.response, 'text') else str(e)
        return {
            "error": "Graph API rejected the generated filter. Try rephrasing your query.",
            "filter": odata_filter,
            "graphError": error_body,
            "devices": [],
        }

    return {
        "devices": devices,
        "count": len(devices),
        "filter": odata_filter,
        "description": parsed.get("description", ""),
    }


# ── Feature 2: Policy Explainer ──────────────────────────────────────────────

_POLICY_EXPLAINER_SYSTEM = """You are an expert Intune administrator who explains configuration profiles and policies in clear, plain English.

Given a JSON configuration profile or policy from Microsoft Intune / Endpoint Manager, explain:
1. **What this policy does** — a one-paragraph summary
2. **Settings breakdown** — for each significant setting, explain:
   - What it controls
   - The configured value and what it means
   - Impact on end users (if any)
   - Security implications (Low / Medium / High)
3. **Recommendations** — any best-practice suggestions or potential issues

Format your response in clean markdown. Use headers (##), bullet points, and bold for key terms.
Write for an IT admin audience — be specific and practical, not academic."""


async def explain_policy_stream(policy_json: str) -> AsyncIterator[str]:
    """Stream a plain-English explanation of an Intune policy."""
    async for event in _stream_message(
        _POLICY_EXPLAINER_SYSTEM,
        f"Explain this Intune policy:\n\n```json\n{policy_json}\n```",
    ):
        yield event


# ── Feature 3: Remediation Script Generator ─────────────────────────────────

_REMEDIATION_SYSTEM = """You are an expert at writing Intune remediation scripts in PowerShell.

Intune remediation scripts come in pairs:
1. **Detection script** — checks if a problem exists. Exit code 0 = compliant (no action needed), exit code 1 = non-compliant (remediation needed).
2. **Remediation script** — fixes the problem. Exit code 0 = success, exit code 1 = failure.

Rules:
- Use PowerShell 5.1 compatible syntax (not PowerShell 7+)
- Run as SYSTEM unless the scenario explicitly requires user context
- Include proper error handling with try/catch
- Add clear comments explaining each step
- Log actions for troubleshooting (Write-Output is captured by Intune)
- Keep scripts focused and efficient — they run on potentially thousands of devices
- Include a brief header comment block explaining what the script does

Format your response as:

## Detection Script
```powershell
<detection script code>
```

## Remediation Script
```powershell
<remediation script code>
```

## Deployment Notes
- Brief notes on how to deploy in Intune (run as system vs user, frequency, etc.)"""


async def generate_remediation_stream(description: str) -> AsyncIterator[str]:
    """Stream a PowerShell remediation script pair."""
    async for event in _stream_message(
        _REMEDIATION_SYSTEM,
        f"Create an Intune remediation script for this problem:\n\n{description}",
    ):
        yield event


# ── Feature 4: Compliance Gap Analysis ───────────────────────────────────────

_COMPLIANCE_GAP_SYSTEM = """You are an expert Intune security architect who analyzes assigned policies against Microsoft security best practices.

Given a group's current policy assignments (config profiles, compliance policies, and apps), analyze:

1. **Current Coverage** — what security areas are covered by the assigned policies
2. **Gaps Identified** — what's missing compared to Microsoft's recommended security baselines:
   - Device encryption (BitLocker / FileVault)
   - Password/PIN complexity requirements
   - OS version requirements (minimum version, update compliance)
   - Firewall configuration
   - Antivirus/Defender configuration
   - App protection policies
   - Conditional Access integration
   - Network protection
   - Device compliance deadlines
   - Jailbreak/root detection (mobile)
3. **Risk Assessment** — rate each gap as Critical / High / Medium / Low
4. **Recommendations** — specific actions to close each gap, with links to relevant Microsoft docs where appropriate

Format as clean markdown with clear sections. Be specific about what policies to create — don't just say "add encryption", say "create a Windows 10+ device configuration profile with BitLocker requiring XTS-AES 256-bit encryption on OS and fixed data drives."

Focus on practical, actionable advice for a mid-size organization."""


async def compliance_gap_stream(token: str, group_id: str) -> AsyncIterator[str]:
    """Fetch group policies and stream a compliance gap analysis."""
    try:
        yield _sse({"type": "status", "message": "Fetching group policies..."})
        audit = await graph.get_group_audit(token, group_id)
        group = await graph.get_group(token, group_id)

        group_name = group.get("displayName", "Unknown Group")
        policy_summary = json.dumps({
            "groupName": group_name,
            "configProfiles": [{"name": p["displayName"], "type": p["type"]} for p in audit.get("configProfiles", [])],
            "compliancePolicies": [{"name": p["displayName"]} for p in audit.get("compliancePolicies", [])],
            "apps": [{"name": a["displayName"]} for a in audit.get("apps", [])],
            "totalAssignments": audit.get("totalAssignments", 0),
        }, indent=2)

        yield _sse({"type": "status", "message": f"Analyzing {audit.get('totalAssignments', 0)} assignments..."})

        async for event in _stream_message(
            _COMPLIANCE_GAP_SYSTEM,
            f"Analyze the compliance posture for this group:\n\n```json\n{policy_summary}\n```",
        ):
            yield event
    except Exception as e:
        yield _sse({"type": "error", "message": str(e)})


# ── Feature 5: Group Cleanup Advisor ─────────────────────────────────────────

_CLEANUP_ADVISOR_SYSTEM = """You are an expert Intune administrator who helps decide whether a group is safe to delete.

Given data about a group (its properties, members, and policy/app assignments), provide:

1. **Safety Verdict** — one of:
   - ✅ **SAFE TO DELETE** — no assignments, no members, or clearly unused
   - ⚠️ **PROCEED WITH CAUTION** — some assignments/members but low risk
   - 🛑 **DO NOT DELETE** — active assignments that would impact devices/users

2. **Impact Analysis**
   - How many devices/users would be affected
   - What policies would lose their target group
   - Whether this is a dynamic group (auto-populates, so deleting doesn't remove device management)
   - Any critical policies (compliance, security baselines) that target this group

3. **Pre-Deletion Checklist**
   - Steps to take before safely deleting (re-assign policies, notify users, etc.)

4. **Alternative Actions**
   - If deletion is risky, suggest alternatives (rename, remove assignments first, archive)

Be direct and actionable. Start with the verdict prominently."""


async def group_cleanup_stream(token: str, group_id: str) -> AsyncIterator[str]:
    """Fetch group data and stream a cleanup recommendation."""
    try:
        yield _sse({"type": "status", "message": "Gathering group data..."})

        group = await graph.get_group(token, group_id)
        members = await graph.get_group_members(token, group_id)
        audit = await graph.get_group_audit(token, group_id)

        group_data = json.dumps({
            "group": {
                "displayName": group.get("displayName"),
                "description": group.get("description"),
                "groupTypes": group.get("groupTypes", []),
                "membershipRule": group.get("membershipRule"),
                "isDynamic": "DynamicMembership" in (group.get("groupTypes") or []),
            },
            "members": {
                "count": len(members),
                "sample": [{"name": m.get("displayName"), "os": m.get("operatingSystem")} for m in members[:10]],
            },
            "assignments": {
                "configProfiles": [p["displayName"] for p in audit.get("configProfiles", [])],
                "compliancePolicies": [p["displayName"] for p in audit.get("compliancePolicies", [])],
                "apps": [a["displayName"] for a in audit.get("apps", [])],
                "totalAssignments": audit.get("totalAssignments", 0),
            },
        }, indent=2)

        yield _sse({"type": "status", "message": "Analyzing group..."})

        async for event in _stream_message(
            _CLEANUP_ADVISOR_SYSTEM,
            f"Should this group be deleted?\n\n```json\n{group_data}\n```",
        ):
            yield event
    except Exception as e:
        yield _sse({"type": "error", "message": str(e)})
