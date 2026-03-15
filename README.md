# 🛠️ Intune Admin Toolbox

Tired of wrestling with PowerShell scripts and Graph Explorer just to do basic Intune housekeeping? Same. This is a locally hosted web app that wraps the most repetitive admin tasks in a clean UI — no CLI required.

Built by an Intune admin, for Intune admins. Use it, break it, tell me what you think.

> ⚠️ **Heads up:** This is a personal side project. It works well for me but comes with no guarantees, warranties, or SLAs of any kind. Test it in a non-production environment first. You're responsible for what you do with it.

---

## ✨ What it does

| Feature | What it saves you from |
|---------|----------------------|
| 🏠 **Dashboard** | Tenant name, signed-in user, and total managed device count broken down by OS (Windows / macOS / iOS / Android) — at a glance. |
| ➕ **Bulk Device Add** | Upload a CSV of device names → resolves them to Entra object IDs → adds the whole lot to a group. No more adding devices one by one. |
| 🔄 **Force Sync** | Trigger an immediate Intune check-in for every managed device in a group. Live animated progress window shows each device's status in real time — no more waiting for the scheduled window. |
| 🔍 **Group Audit** | See every config profile, compliance policy, and app assigned to a group before you delete it. No more "oops". Export to CSV. |
| 👥 **Group Members** | Browse all devices in a group with OS breakdown. Export to CSV. |

---

## 🚀 Getting started

### 1. Start the backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

> Requires Python 3.11+

### 2. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

### 3. Open it up

Head to **http://localhost:5173** — the setup wizard takes it from there.

---

## 🔧 First-time setup (in-app wizard)

The wizard walks you through everything:

1. **Register an Entra app** — step-by-step instructions are shown in the app
2. **Paste your Client ID + Tenant ID**
3. **Sign in** via Microsoft's device code flow — your password never touches this app
4. **Check your permissions** — a live checklist shows exactly what's granted

### Permissions you'll need (delegated)

| Permission | Why |
|-----------|-----|
| `DeviceManagementConfiguration.ReadWrite.All` | Config profiles + adding devices to groups |
| `DeviceManagementApps.Read.All` | App assignments in group audit |
| `DeviceManagementManagedDevices.Read.All` | Resolving device names to managed device IDs |
| `DeviceManagementManagedDevices.PrivilegedOperations.All` | Triggering force sync via `syncDevice` action |
| `Group.ReadWrite.All` | Searching groups + adding members |
| `Directory.Read.All` | Looking up Entra device objects |
| `User.Read` | Showing your name in the UI |

> 📌 **One thing people miss:** In your app registration → Authentication, you need to enable **"Allow public client flows"**. The app will remind you if you forget, but save yourself a round trip and do it upfront.

---

## 🏗️ How it's built

```
intune-admin-toolbox/
├── backend/
│   ├── main.py           # FastAPI — all API endpoints
│   ├── auth.py           # MSAL device code flow + token cache
│   ├── graph.py          # All Graph API calls live here
│   ├── config.json       # Created by setup wizard (gitignored)
│   └── requirements.txt
└── frontend/
    └── src/
        ├── pages/        # Dashboard, BulkAdd, ForceSync, GroupAudit, GroupMembers, Auth, Setup
        ├── components/   # Layout, GroupSearch, PermissionsPanel, StatusBadge
        └── api/          # axios wrapper + response interceptor
```

Backend on **:8000**, frontend dev server on **:5173** (Vite proxies `/api/*` to the backend).

Force Sync uses **Server-Sent Events** to stream per-device progress from the backend to the browser in real time — no polling, no waiting for the whole batch to finish before you see anything.

---

## 🔒 A note on security

- Auth uses Microsoft's **device code flow** — you authenticate on Microsoft's own servers
- Your Client ID and Tenant ID live in `backend/config.json` (gitignored — don't commit it)
- Tokens are in memory only and cleared on backend restart or sign-out
- This is designed for **local use** — don't expose port 8000 to the internet

---

## 💬 Ideas, feedback, feature requests

I'm actively using this and adding to it. If something's broken or you've got an idea for a feature that would save you time, open an issue or drop a PR — genuinely keen to hear what would make this more useful.

Some things I'm thinking about:
- 🗑️ Bulk device **remove** from groups
- 📋 Stale device report (devices not checked in for X days)
- 🏷️ Bulk device rename / tagging
- 🔁 Cross-group membership comparison

Got something better on your wishlist? Let me know 👇
