# Intune AI Studio — Technical Documentation

High-level overviews of how each feature works, the **Entra delegated permissions** it
relies on, and the **APIs** it calls. This is developer/admin-facing reference material —
for setup and usage, see the [project README](../README.md).

![System architecture](assets/system-architecture.svg)

## Documentation map

| Doc | What's inside |
|-----|---------------|
| **[Architecture](architecture.md)** | System design, the device-code authentication flow, the multi-provider AI layer, and security model. |
| **[Features](features.md)** | Single reference for all 10 features — how each works, permissions used, APIs called, and backend route. |

## The 30-second version

- **Frontend** — React + TypeScript (Vite) on `:5173`. Vite proxies `/api/*` to the backend.
- **Backend** — FastAPI (uvicorn) on `:8000`. Four modules: `main.py` (routes), `auth.py`
  (MSAL device-code sign-in), `graph.py` (Microsoft Graph calls), `ai.py` (AI providers).
- **External APIs** — Microsoft Entra ID (sign-in), Microsoft Graph (`v1.0` + `beta`), and
  one AI provider of your choice (Anthropic, OpenAI, Azure OpenAI, or Google Gemini).
- **State** — the access token lives in memory only; Client ID, Tenant ID, and the AI key
  live in `backend/config.json` (gitignored). Designed for **local** use.

## Permissions at a glance

All access is **delegated** (acts as the signed-in admin) via Microsoft's device-code flow.
The app requests these eight scopes up front; see [features.md](features.md) for which
feature uses which.

| Scope | Why it's needed |
|-------|-----------------|
| `DeviceManagementConfiguration.ReadWrite.All` | Read config profiles; add devices to groups |
| `DeviceManagementApps.Read.All` | View app assignments in group audit |
| `DeviceManagementManagedDevices.Read.All` | Read managed devices; resolve names → IDs |
| `DeviceManagementManagedDevices.PrivilegedOperations.All` | Trigger force sync (`syncDevice`) |
| `Group.ReadWrite.All` | Search groups and add members |
| `Directory.Read.All` | Look up Entra device objects and org info |
| `ServiceHealth.Read.All` | Show Microsoft service health on the dashboard |
| `User.Read` | Display the signed-in account name |

> Source of truth: `REQUIRED_SCOPES` / `SCOPE_DESCRIPTIONS` in
> [`backend/auth.py`](../backend/auth.py).
