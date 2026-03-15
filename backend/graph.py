import asyncio
import csv
import io
from typing import Any, Optional

import httpx

GRAPH_BASE = "https://graph.microsoft.com/v1.0"
BETA_BASE = "https://graph.microsoft.com/beta"


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


async def _get(client: httpx.AsyncClient, token: str, url: str, params: dict = None) -> dict:
    r = await client.get(url, headers=_headers(token), params=params)
    r.raise_for_status()
    return r.json()


async def _get_paged(client: httpx.AsyncClient, token: str, url: str, params: dict = None) -> list:
    """Follow @odata.nextLink pagination."""
    items = []
    next_url = url
    next_params = params
    while next_url:
        data = await _get(client, token, next_url, next_params)
        items.extend(data.get("value", []))
        next_url = data.get("@odata.nextLink")
        next_params = None  # nextLink already contains params
    return items


# ── Auth / User ──────────────────────────────────────────────────────────────

async def get_me(token: str) -> dict:
    async with httpx.AsyncClient() as client:
        return await _get(client, token, f"{GRAPH_BASE}/me", {"$select": "displayName,userPrincipalName"})


# ── Groups ───────────────────────────────────────────────────────────────────

async def search_groups(token: str, query: str) -> list[dict]:
    async with httpx.AsyncClient() as client:
        data = await _get(client, token, f"{GRAPH_BASE}/groups", {
            "$filter": f"startswith(displayName,'{query}')",
            "$select": "id,displayName,description",
            "$top": "20",
        })
    return data.get("value", [])


async def get_group(token: str, group_id: str) -> dict:
    async with httpx.AsyncClient() as client:
        return await _get(client, token, f"{GRAPH_BASE}/groups/{group_id}", {
            "$select": "id,displayName,description,membershipRule,groupTypes",
        })


async def get_group_members(token: str, group_id: str) -> list[dict]:
    async with httpx.AsyncClient() as client:
        members = await _get_paged(client, token, f"{GRAPH_BASE}/groups/{group_id}/members", {
            "$select": "id,displayName,deviceId,operatingSystem,operatingSystemVersion,@odata.type",
            "$top": "999",
        })
    return members


# ── Devices ──────────────────────────────────────────────────────────────────

async def resolve_device_names(token: str, names: list[str]) -> dict[str, Optional[str]]:
    """Returns {name: device_object_id | None}."""
    if not names:
        return {}

    # Use Graph batch API (max 20 per batch)
    results: dict[str, Optional[str]] = {n: None for n in names}

    async def fetch_batch(batch_names: list[str]) -> None:
        requests_payload = [
            {
                "id": str(i),
                "method": "GET",
                "url": f"/devices?$filter=displayName eq '{name}'&$select=id,displayName&$top=1",
            }
            for i, name in enumerate(batch_names)
        ]
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{GRAPH_BASE}/$batch",
                headers=_headers(token),
                json={"requests": requests_payload},
            )
            r.raise_for_status()
            responses = r.json().get("responses", [])
        for resp in responses:
            idx = int(resp["id"])
            name = batch_names[idx]
            body = resp.get("body", {})
            devices = body.get("value", [])
            if devices:
                results[name] = devices[0]["id"]

    # Process in batches of 20
    chunks = [names[i:i+20] for i in range(0, len(names), 20)]
    await asyncio.gather(*[fetch_batch(chunk) for chunk in chunks])
    return results


async def add_device_to_group(token: str, group_id: str, device_object_id: str) -> dict:
    """Returns {"status": "added" | "already_member" | "error", "message": ...}"""
    url = f"{GRAPH_BASE}/groups/{group_id}/members/$ref"
    body = {"@odata.id": f"{GRAPH_BASE}/directoryObjects/{device_object_id}"}
    async with httpx.AsyncClient() as client:
        r = await client.post(url, headers=_headers(token), json=body)
    if r.status_code == 204:
        return {"status": "added"}
    if r.status_code == 400:
        err = r.json().get("error", {})
        if "already exists" in err.get("message", "").lower() or err.get("code") == "Request_BadRequest":
            # Check if it's truly a duplicate
            if "already" in err.get("message", "").lower():
                return {"status": "already_member"}
    if r.status_code == 400:
        err_msg = r.json().get("error", {}).get("message", r.text)
        return {"status": "error", "message": err_msg}
    try:
        r.raise_for_status()
    except httpx.HTTPStatusError as e:
        return {"status": "error", "message": str(e)}
    return {"status": "added"}


# ── Group Audit ───────────────────────────────────────────────────────────────

def _is_assigned_to_group(assignments: list[dict], group_id: str) -> bool:
    for a in assignments:
        target = a.get("target", {})
        t_type = target.get("@odata.type", "")
        if target.get("groupId") == group_id:
            return True
        # All-devices or all-users targets are not group-specific
    return False


async def _get_config_profiles(client: httpx.AsyncClient, token: str, group_id: str) -> list[dict]:
    items = await _get_paged(client, token, f"{GRAPH_BASE}/deviceManagement/deviceConfigurations", {
        "$expand": "assignments",
        "$select": "id,displayName,lastModifiedDateTime,assignments",
    })
    return [
        {"id": i["id"], "displayName": i["displayName"], "type": "Configuration Profile", "lastModified": i.get("lastModifiedDateTime", "")}
        for i in items if _is_assigned_to_group(i.get("assignments", []), group_id)
    ]


async def _get_compliance_policies(client: httpx.AsyncClient, token: str, group_id: str) -> list[dict]:
    items = await _get_paged(client, token, f"{GRAPH_BASE}/deviceManagement/deviceCompliancePolicies", {
        "$expand": "assignments",
        "$select": "id,displayName,lastModifiedDateTime,assignments",
    })
    return [
        {"id": i["id"], "displayName": i["displayName"], "type": "Compliance Policy", "lastModified": i.get("lastModifiedDateTime", "")}
        for i in items if _is_assigned_to_group(i.get("assignments", []), group_id)
    ]


async def _get_apps(client: httpx.AsyncClient, token: str, group_id: str) -> list[dict]:
    items = await _get_paged(client, token, f"{GRAPH_BASE}/deviceAppManagement/mobileApps", {
        "$expand": "assignments",
        "$select": "id,displayName,lastModifiedDateTime,assignments,publishingState",
        "$filter": "isAssigned eq true",
    })
    return [
        {"id": i["id"], "displayName": i["displayName"], "type": "App", "lastModified": i.get("lastModifiedDateTime", "")}
        for i in items if _is_assigned_to_group(i.get("assignments", []), group_id)
    ]


async def _get_intent_policies(client: httpx.AsyncClient, token: str, group_id: str) -> list[dict]:
    """Endpoint security / security baselines (beta)."""
    try:
        items = await _get_paged(client, token, f"{BETA_BASE}/deviceManagement/intents", {
            "$select": "id,displayName,lastModifiedDateTime",
        })
        results = []
        for item in items:
            assignments = await _get_paged(client, token, f"{BETA_BASE}/deviceManagement/intents/{item['id']}/assignments", {})
            if _is_assigned_to_group(assignments, group_id):
                results.append({"id": item["id"], "displayName": item["displayName"], "type": "Security Policy", "lastModified": item.get("lastModifiedDateTime", "")})
        return results
    except Exception:
        return []


async def get_group_audit(token: str, group_id: str) -> dict:
    async with httpx.AsyncClient(timeout=60.0) as client:
        config_profiles, compliance_policies, apps = await asyncio.gather(
            _get_config_profiles(client, token, group_id),
            _get_compliance_policies(client, token, group_id),
            _get_apps(client, token, group_id),
        )
    total = len(config_profiles) + len(compliance_policies) + len(apps)
    return {
        "configProfiles": config_profiles,
        "compliancePolicies": compliance_policies,
        "apps": apps,
        "totalAssignments": total,
    }


def audit_to_csv(audit_data: dict, group_name: str) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Group", "Type", "Name", "Last Modified"])
    for category, type_label in [
        ("configProfiles", "Configuration Profile"),
        ("compliancePolicies", "Compliance Policy"),
        ("apps", "App"),
    ]:
        for item in audit_data.get(category, []):
            writer.writerow([group_name, type_label, item["displayName"], item.get("lastModified", "")])
    return output.getvalue()


def members_to_csv(members: list[dict], group_name: str) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Group", "Device Name", "OS", "OS Version", "Object ID"])
    for m in members:
        writer.writerow([
            group_name,
            m.get("displayName", ""),
            m.get("operatingSystem", ""),
            m.get("operatingSystemVersion", ""),
            m.get("id", ""),
        ])
    return output.getvalue()
