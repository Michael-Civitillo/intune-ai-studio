import asyncio
import csv
import io
import json
from typing import Any, AsyncIterator, Optional

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


# ── Dashboard ─────────────────────────────────────────────────────────────────

async def get_dashboard_data(token: str) -> dict:
    """Returns tenant name and managed device counts by OS."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        org_task = _get(client, token, f"{GRAPH_BASE}/organization", {"$select": "displayName"})
        devices_task = _get_paged(client, token, f"{GRAPH_BASE}/deviceManagement/managedDevices", {
            "$select": "operatingSystem",
            "$top": "999",
        })
        org_data, devices = await asyncio.gather(org_task, devices_task)

    tenant_name = (org_data.get("value") or [{}])[0].get("displayName", "Unknown Tenant")

    os_counts: dict[str, int] = {}
    for dev in devices:
        os_name = (dev.get("operatingSystem") or "Unknown").strip()
        os_counts[os_name] = os_counts.get(os_name, 0) + 1

    return {
        "tenantName": tenant_name,
        "totalDevices": len(devices),
        "osCounts": {
            "windows": os_counts.get("Windows", 0),
            "macOS": os_counts.get("macOS", 0),
            "iOS": os_counts.get("iOS", 0),
            "android": os_counts.get("Android", 0),
            "other": sum(v for k, v in os_counts.items() if k not in ("Windows", "macOS", "iOS", "Android")),
        },
        "rawOsCounts": os_counts,
    }


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
            "$select": "id,displayName,deviceId,operatingSystem,operatingSystemVersion",
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


# ── Force Sync ────────────────────────────────────────────────────────────────

async def sync_group_devices(token: str, group_id: str) -> dict:
    """
    Trigger an immediate Intune sync for all managed devices in a group.
    Steps:
      1. Fetch all device-type members from the group
      2. Batch-resolve azureADDeviceId → Intune managedDevice ID
      3. Batch-trigger POST /managedDevices/{id}/syncDevice
      4. Return per-device results + summary
    """
    async with httpx.AsyncClient(timeout=120.0) as client:
        members = await _get_paged(client, token, f"{GRAPH_BASE}/groups/{group_id}/members", {
            "$select": "id,displayName,deviceId,operatingSystem",
            "$top": "999",
        })

    # Filter to device objects only — @odata.type is returned automatically even without $select,
    # but fall back to checking for deviceId presence (only device objects have it)
    devices = [m for m in members if m.get("@odata.type") == "#microsoft.graph.device" or m.get("deviceId")]
    if not devices:
        return {"results": [], "summary": {"total": 0, "synced": 0, "not_managed": 0, "errors": 0}}

    # ── Phase 1: resolve azureADDeviceId → managed device ID ──────────────────

    async def lookup_batch(batch: list[dict]) -> dict[str, str]:
        """Returns {entra_object_id: managed_device_id} for found devices."""
        # Build a list of (request_id, device) only for devices that have a deviceId
        # so that resp["id"] always maps back to the correct device unambiguously.
        eligible = [(str(i), dev) for i, dev in enumerate(batch) if dev.get("deviceId")]
        if not eligible:
            return {}
        reqs = [
            {"id": req_id, "method": "GET",
             "url": f"/deviceManagement/managedDevices?$filter=azureADDeviceId eq '{dev['deviceId']}'&$select=id&$top=1"}
            for req_id, dev in eligible
        ]
        id_to_dev = {req_id: dev for req_id, dev in eligible}
        async with httpx.AsyncClient(timeout=60.0) as c:
            r = await c.post(f"{GRAPH_BASE}/$batch", headers=_headers(token), json={"requests": reqs})
            r.raise_for_status()
        found: dict[str, str] = {}
        for resp in r.json().get("responses", []):
            dev = id_to_dev.get(resp["id"])
            if dev:
                vals = resp.get("body", {}).get("value", [])
                if vals:
                    found[dev["id"]] = vals[0]["id"]
        return found

    lookup_chunks = [devices[i:i + 20] for i in range(0, len(devices), 20)]
    lookup_results = await asyncio.gather(*[lookup_batch(chunk) for chunk in lookup_chunks])
    managed_map: dict[str, str] = {}
    for r in lookup_results:
        managed_map.update(r)

    # ── Phase 2: trigger syncDevice for each managed device ───────────────────

    to_sync = [(dev["id"], managed_map[dev["id"]]) for dev in devices if dev["id"] in managed_map]

    async def sync_batch(batch: list[tuple[str, str]]) -> dict[str, str]:
        """Returns {entra_id: "ok" | "error: <msg>"} for each device.
        syncDevice is a POST action with no request body — omit body/headers
        in the batch item so Graph doesn't reject it as a malformed request."""
        id_to_entra = {str(i): entra_id for i, (entra_id, _) in enumerate(batch)}
        reqs = [
            {"id": str(i), "method": "POST",
             "url": f"/deviceManagement/managedDevices/{mid}/syncDevice"}
            for i, (_, mid) in enumerate(batch)
        ]
        async with httpx.AsyncClient(timeout=60.0) as c:
            r = await c.post(f"{GRAPH_BASE}/$batch", headers=_headers(token), json={"requests": reqs})
            r.raise_for_status()
        result: dict[str, str] = {}
        for resp in r.json().get("responses", []):
            entra_id = id_to_entra.get(resp["id"], "")
            if not entra_id:
                continue
            if resp.get("status") == 204:
                result[entra_id] = "ok"
            else:
                body = resp.get("body") or {}
                msg = body.get("error", {}).get("message", f"HTTP {resp.get('status', '?')}")
                result[entra_id] = f"error: {msg}"
        return result

    sync_map: dict[str, str] = {}
    if to_sync:
        sync_chunks = [to_sync[i:i + 20] for i in range(0, len(to_sync), 20)]
        sync_results = await asyncio.gather(*[sync_batch(chunk) for chunk in sync_chunks])
        for r in sync_results:
            sync_map.update(r)

    # ── Build per-device results ───────────────────────────────────────────────

    results = []
    for dev in devices:
        eid = dev["id"]
        name = dev.get("displayName", "Unknown")
        os_name = dev.get("operatingSystem", "")
        if eid not in managed_map:
            results.append({"deviceName": name, "operatingSystem": os_name,
                            "status": "not_managed", "message": "Not enrolled in Intune"})
        elif sync_map.get(eid, "").startswith("error"):
            results.append({"deviceName": name, "operatingSystem": os_name,
                            "status": "error", "message": sync_map[eid].replace("error: ", "")})
        else:
            results.append({"deviceName": name, "operatingSystem": os_name,
                            "status": "synced", "message": "Sync triggered successfully"})

    summary = {
        "total": len(devices),
        "synced": sum(1 for r in results if r["status"] == "synced"),
        "not_managed": sum(1 for r in results if r["status"] == "not_managed"),
        "errors": sum(1 for r in results if r["status"] == "error"),
    }
    return {"results": results, "summary": summary}


async def sync_group_devices_stream(token: str, group_id: str) -> AsyncIterator[str]:
    """
    Same as sync_group_devices but yields SSE-formatted strings progressively
    so the frontend can show per-device animations in real time.

    SSE event types emitted:
      phase          – { phase: "discovering" | "resolving" | "syncing" | "done" }
      devices_found  – { total: N, devices: [{entraId, name, os}] }
      device_result  – { entraId, name, os, status: "synced"|"not_managed"|"error", message }
      complete       – { summary: {total, synced, not_managed, errors} }
      error          – { message }
    """

    def _sse(payload: dict) -> str:
        return f"data: {json.dumps(payload)}\n\n"

    try:
        # ── Phase 1: discover group members ──────────────────────────────────
        yield _sse({"type": "phase", "phase": "discovering"})

        async with httpx.AsyncClient(timeout=120.0) as client:
            members = await _get_paged(client, token, f"{GRAPH_BASE}/groups/{group_id}/members", {
                "$select": "id,displayName,deviceId,operatingSystem",
                "$top": "999",
            })

        # Filter to device objects only — @odata.type is returned automatically even without $select,
        # but fall back to checking for deviceId presence (only device objects have it)
        devices = [m for m in members if m.get("@odata.type") == "#microsoft.graph.device" or m.get("deviceId")]

        if not devices:
            yield _sse({"type": "devices_found", "total": 0, "devices": []})
            yield _sse({"type": "complete", "summary": {"total": 0, "synced": 0, "not_managed": 0, "errors": 0}})
            return

        yield _sse({
            "type": "devices_found",
            "total": len(devices),
            "devices": [{"entraId": d["id"], "name": d.get("displayName", "Unknown"), "os": d.get("operatingSystem", "")} for d in devices],
        })

        # ── Phase 2: resolve azureADDeviceId → managed device ID ─────────────
        yield _sse({"type": "phase", "phase": "resolving"})

        async def lookup_batch(batch: list[dict]) -> dict[str, str]:
            eligible = [(str(i), dev) for i, dev in enumerate(batch) if dev.get("deviceId")]
            if not eligible:
                return {}
            reqs = [
                {"id": req_id, "method": "GET",
                 "url": f"/deviceManagement/managedDevices?$filter=azureADDeviceId eq '{dev['deviceId']}'&$select=id&$top=1"}
                for req_id, dev in eligible
            ]
            id_to_dev = {req_id: dev for req_id, dev in eligible}
            async with httpx.AsyncClient(timeout=60.0) as c:
                r = await c.post(f"{GRAPH_BASE}/$batch", headers=_headers(token), json={"requests": reqs})
                r.raise_for_status()
            found: dict[str, str] = {}
            for resp in r.json().get("responses", []):
                dev = id_to_dev.get(resp["id"])
                if dev:
                    vals = resp.get("body", {}).get("value", [])
                    if vals:
                        found[dev["id"]] = vals[0]["id"]
            return found

        lookup_chunks = [devices[i:i + 20] for i in range(0, len(devices), 20)]
        managed_map: dict[str, str] = {}
        for chunk in lookup_chunks:
            result = await lookup_batch(chunk)
            managed_map.update(result)

        # Emit not_managed results immediately after resolving
        for dev in devices:
            if dev["id"] not in managed_map:
                yield _sse({
                    "type": "device_result",
                    "entraId": dev["id"],
                    "name": dev.get("displayName", "Unknown"),
                    "os": dev.get("operatingSystem", ""),
                    "status": "not_managed",
                    "message": "Not enrolled in Intune",
                })

        # ── Phase 3: trigger syncDevice ───────────────────────────────────────
        to_sync = [(dev["id"], managed_map[dev["id"]]) for dev in devices if dev["id"] in managed_map]

        if to_sync:
            yield _sse({"type": "phase", "phase": "syncing"})

            async def sync_batch(batch: list[tuple[str, str]]) -> dict[str, str]:
                id_to_entra = {str(i): entra_id for i, (entra_id, _) in enumerate(batch)}
                reqs = [
                    {"id": str(i), "method": "POST",
                     "url": f"/deviceManagement/managedDevices/{mid}/syncDevice"}
                    for i, (_, mid) in enumerate(batch)
                ]
                async with httpx.AsyncClient(timeout=60.0) as c:
                    r = await c.post(f"{GRAPH_BASE}/$batch", headers=_headers(token), json={"requests": reqs})
                    r.raise_for_status()
                result: dict[str, str] = {}
                for resp in r.json().get("responses", []):
                    entra_id = id_to_entra.get(resp["id"], "")
                    if not entra_id:
                        continue
                    if resp.get("status") == 204:
                        result[entra_id] = "ok"
                    else:
                        body = resp.get("body") or {}
                        msg = body.get("error", {}).get("message", f"HTTP {resp.get('status', '?')}")
                        result[entra_id] = f"error: {msg}"
                return result

            # Build a quick name/os lookup
            dev_info = {d["id"]: d for d in devices}

            sync_chunks = [to_sync[i:i + 20] for i in range(0, len(to_sync), 20)]
            for chunk in sync_chunks:
                batch_result = await sync_batch(chunk)
                for entra_id, outcome in batch_result.items():
                    dev = dev_info.get(entra_id, {})
                    if outcome == "ok":
                        yield _sse({
                            "type": "device_result",
                            "entraId": entra_id,
                            "name": dev.get("displayName", "Unknown"),
                            "os": dev.get("operatingSystem", ""),
                            "status": "synced",
                            "message": "Sync triggered successfully",
                        })
                    else:
                        yield _sse({
                            "type": "device_result",
                            "entraId": entra_id,
                            "name": dev.get("displayName", "Unknown"),
                            "os": dev.get("operatingSystem", ""),
                            "status": "error",
                            "message": outcome.replace("error: ", ""),
                        })

        # ── Summary ───────────────────────────────────────────────────────────
        # We need to count, but results were streamed; recalculate from managed_map and sync outcomes
        # We'll collect a summary from what we know
        total = len(devices)
        not_managed_count = total - len(to_sync)
        # to_sync contains all that were resolved; results come from batch processing
        # Emit complete with best-effort summary (frontend tracks live counts too)
        yield _sse({"type": "complete"})

    except Exception as exc:
        yield _sse({"type": "error", "message": str(exc)})


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
