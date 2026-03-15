import csv
import io
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import auth
import graph

app = FastAPI(title="Intune Admin Toolbox API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_token() -> str:
    token = auth.get_token()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return token


# ── Setup ─────────────────────────────────────────────────────────────────────

class SetupPayload(BaseModel):
    client_id: str
    tenant_id: str


@app.get("/api/setup/status")
def setup_status():
    cfg = auth.load_config()
    return {"configured": cfg is not None, "config": cfg}


@app.post("/api/setup/validate")
def setup_validate(payload: SetupPayload):
    """Validate client/tenant by attempting to initiate a device flow."""
    try:
        app_instance = auth.reset_msal_app(payload.client_id, payload.tenant_id)
        scopes = ["https://graph.microsoft.com/User.Read"]
        flow = app_instance.initiate_device_flow(scopes=scopes)
        if "error" in flow:
            return {"valid": False, "error": flow.get("error_description", flow["error"])}
        return {"valid": True}
    except Exception as e:
        return {"valid": False, "error": str(e)}


@app.post("/api/setup/save")
def setup_save(payload: SetupPayload):
    auth.save_config(payload.client_id, payload.tenant_id)
    auth.reset_msal_app(payload.client_id, payload.tenant_id)
    return {"saved": True}


# ── Auth ──────────────────────────────────────────────────────────────────────

@app.post("/api/auth/start")
def auth_start():
    try:
        flow = auth.initiate_device_flow()
        return flow
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/auth/poll")
def auth_poll():
    try:
        return auth.poll_device_flow()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/auth/me")
def auth_me():
    try:
        user = auth.get_current_user()
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        return user
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/auth/permissions")
def auth_permissions():
    try:
        return auth.get_permission_status()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/auth/logout")
def auth_logout():
    auth.logout()
    return {"logged_out": True}


# ── Dashboard ─────────────────────────────────────────────────────────────────

@app.get("/api/dashboard")
async def dashboard():
    token = require_token()
    try:
        return await graph.get_dashboard_data(token)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Groups ────────────────────────────────────────────────────────────────────

@app.get("/api/groups/search")
async def groups_search(q: str = Query(..., min_length=1)):
    token = require_token()
    try:
        results = await graph.search_groups(token, q)
        return {"groups": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/groups/{group_id}")
async def group_get(group_id: str):
    token = require_token()
    try:
        return await graph.get_group(token, group_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/groups/{group_id}/members")
async def group_members(group_id: str):
    token = require_token()
    try:
        members = await graph.get_group_members(token, group_id)
        return {"members": members, "count": len(members)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/groups/{group_id}/members/export")
async def group_members_export(group_id: str):
    token = require_token()
    try:
        group = await graph.get_group(token, group_id)
        members = await graph.get_group_members(token, group_id)
        csv_content = graph.members_to_csv(members, group.get("displayName", group_id))
        return StreamingResponse(
            io.StringIO(csv_content),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="members-{group_id}.csv"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/groups/{group_id}/audit")
async def group_audit(group_id: str):
    token = require_token()
    try:
        audit = await graph.get_group_audit(token, group_id)
        return audit
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/groups/{group_id}/audit/export")
async def group_audit_export(group_id: str):
    token = require_token()
    try:
        group = await graph.get_group(token, group_id)
        audit = await graph.get_group_audit(token, group_id)
        csv_content = graph.audit_to_csv(audit, group.get("displayName", group_id))
        return StreamingResponse(
            io.StringIO(csv_content),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="audit-{group_id}.csv"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Force Sync ────────────────────────────────────────────────────────────────

@app.post("/api/groups/{group_id}/sync")
async def group_sync(group_id: str):
    token = require_token()
    try:
        result = await graph.sync_group_devices(token, group_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/groups/{group_id}/sync/stream")
async def group_sync_stream(group_id: str):
    """SSE endpoint — streams per-device sync progress."""
    token = require_token()
    return StreamingResponse(
        graph.sync_group_devices_stream(token, group_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── Devices / Bulk Add ────────────────────────────────────────────────────────

class BulkAddPayload(BaseModel):
    group_id: str
    device_names: list[str]


@app.post("/api/devices/bulk-add")
async def devices_bulk_add(payload: BulkAddPayload):
    token = require_token()
    if not payload.device_names:
        raise HTTPException(status_code=400, detail="No device names provided")

    # Step 1: resolve names → object IDs
    name_to_id = await graph.resolve_device_names(token, payload.device_names)

    # Step 2: add resolved devices
    results = []
    for name in payload.device_names:
        obj_id = name_to_id.get(name)
        if obj_id is None:
            results.append({"deviceName": name, "status": "not_found", "message": "Device not found in Entra"})
            continue
        add_result = await graph.add_device_to_group(token, payload.group_id, obj_id)
        results.append({
            "deviceName": name,
            "objectId": obj_id,
            "status": add_result["status"],
            "message": add_result.get("message", ""),
        })

    summary = {
        "added": sum(1 for r in results if r["status"] == "added"),
        "already_member": sum(1 for r in results if r["status"] == "already_member"),
        "not_found": sum(1 for r in results if r["status"] == "not_found"),
        "error": sum(1 for r in results if r["status"] == "error"),
    }
    return {"results": results, "summary": summary}
