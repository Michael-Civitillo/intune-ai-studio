# Intune Admin Toolbox

A locally hosted web app for Intune administrators. Provides a modern GUI for common day-to-day tasks that otherwise require CLI or Graph API knowledge.

## Features

| Feature | Description |
|---------|-------------|
| **Bulk Device Add** | Upload a CSV of device names → automatically resolves them to Entra object IDs → batch-adds them to any group |
| **Group Audit** | Select a group and see every config profile, compliance policy, and app assigned to it — know if it's safe to delete |
| **Group Members** | View all devices in a group with OS breakdown; filter and export to CSV |

---

## Quick Start

### 1. Start the backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

> Requires Python 3.11+. Use a virtual environment: `python -m venv .venv && source .venv/bin/activate`

### 2. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

### 3. Open the app

Navigate to **http://localhost:5173** — the setup wizard will guide you through everything else.

---

## First-Run Setup (in the app)

The setup wizard will walk you through:

1. **Registering an Entra App** — step-by-step instructions are shown in the wizard
2. **Entering your Client ID and Tenant ID**
3. **Signing in** with your Microsoft account (device code flow — your password never touches this app)
4. **Verifying permissions** — a checklist shows which Graph permissions are granted

### Required API Permissions (delegated)

Your Entra app registration needs these Microsoft Graph delegated permissions:

| Permission | Used for |
|-----------|----------|
| `DeviceManagementConfiguration.ReadWrite.All` | View config profiles, resolve device assignments |
| `DeviceManagementApps.Read.All` | View app assignments in group audit |
| `DeviceManagementManagedDevices.Read.All` | Resolve device names to IDs |
| `Group.ReadWrite.All` | Search groups, add members |
| `Directory.Read.All` | Look up Entra device objects |
| `User.Read` | Display your signed-in account name |

> **Important:** In your app registration → Authentication → enable **"Allow public client flows"** (required for device code flow).

---

## Architecture

```
intune-admin-toolbox/
├── backend/
│   ├── main.py           # FastAPI app
│   ├── auth.py           # MSAL device code flow
│   ├── graph.py          # All Microsoft Graph API calls
│   ├── config.json       # Created by setup wizard (gitignored)
│   └── requirements.txt
└── frontend/
    └── src/
        ├── pages/        # BulkAdd, GroupAudit, GroupMembers, Auth, Setup
        ├── components/   # Layout, GroupSearch, PermissionsPanel, StatusBadge
        └── api/          # axios client
```

The backend runs on **port 8000**, the frontend dev server on **port 5173** (proxies `/api/*` to the backend).

---

## Security Notes

- Authentication uses Microsoft's **device code flow** — your password is entered on Microsoft's servers, not here
- Your Client ID and Tenant ID are stored in `backend/config.json` (gitignored)
- Access tokens are held in memory only — they are cleared when the backend restarts or you sign out
- This tool is designed for local use only; do not expose port 8000 to the internet
