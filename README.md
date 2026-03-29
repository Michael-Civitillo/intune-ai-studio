<p align="center">
  <img src="frontend/public/logo.svg" alt="Intune AI Studio" width="120" />
</p>

<h1 align="center">Intune AI Studio</h1>

<p align="center">
  AI-powered admin tools for Microsoft Intune — built by an admin, for admins.
</p>

---

Tired of wrestling with PowerShell scripts and Graph Explorer just to do basic Intune housekeeping? Same. This is a locally hosted web app that wraps the most repetitive admin tasks in a clean UI — and adds AI on top to make the stuff that's actually hard feel easy too.

> **Heads up:** This is a personal side project. It works well for me but comes with no guarantees, warranties, or SLAs of any kind. Test it in a non-production environment first. You're responsible for what you do with it.

---

## What it does

### Admin Tools

| Feature | What it saves you from |
|---------|----------------------|
| **Dashboard** | Tenant name, device counts by OS, and a live Microsoft service health indicator — green when all clear, amber/red if Intune or Entra are having issues. |
| **Bulk Device Add** | Upload a CSV of device names, resolve them to Entra object IDs, and add the whole lot to a group. No more one-by-one. |
| **Force Sync** | Trigger an immediate Intune check-in for every managed device in a group. Live animated progress shows each device's status in real time via SSE streaming. |
| **Group Audit** | See every config profile, compliance policy, and app assigned to a group before you delete it. Export to CSV. |
| **Group Members** | Browse all devices in a group with OS breakdown. Filter and export to CSV. |

### AI-Powered Features

| Feature | What it does |
|---------|-------------|
| **Device Search** | Search your Intune devices in plain English — "show me all Windows devices that haven't synced in 30 days". AI translates your query into the right Graph API OData filter and runs it. |
| **Policy Explainer** | Paste a config profile or policy JSON and get a plain-English breakdown of what every setting does, its security impact, and recommendations. |
| **Script Generator** | Describe a problem and get a ready-to-deploy Intune remediation script — detection + remediation pair in PowerShell, with deployment notes. |
| **Compliance Gaps** | Select a group and AI reviews its assigned policies against Microsoft security baselines, identifying gaps with risk ratings and specific recommendations. |
| **Cleanup Advisor** | Select a group and AI analyzes its assignments, members, and type to tell you whether it's safe to delete — with a pre-deletion checklist if needed. |

AI features are powered by Claude and require an [Anthropic API key](https://console.anthropic.com/settings/keys). Your key is stored locally and never leaves your machine.

---

## Getting started

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

## First-time setup

The in-app wizard walks you through everything:

1. **Register an Entra app** — step-by-step instructions are shown in the app
2. **Paste your Client ID + Tenant ID**
3. **Sign in** via Microsoft's device code flow — your password never touches this app
4. **Check your permissions** — a live checklist shows exactly what's granted
5. **(Optional) Add your Anthropic API key** — prompted when you first use any AI feature

### Required permissions (delegated)

| Permission | Why |
|-----------|-----|
| `DeviceManagementConfiguration.ReadWrite.All` | Config profiles + adding devices to groups |
| `DeviceManagementApps.Read.All` | App assignments in group audit |
| `DeviceManagementManagedDevices.Read.All` | Resolving device names to managed device IDs |
| `DeviceManagementManagedDevices.PrivilegedOperations.All` | Triggering force sync via `syncDevice` action |
| `Group.ReadWrite.All` | Searching groups + adding members |
| `Directory.Read.All` | Looking up Entra device objects |
| `ServiceHealth.Read.All` | Live Intune / Entra service health on the dashboard |
| `User.Read` | Showing your name in the UI |

> **One thing people miss:** In your app registration > Authentication, you need to enable **"Allow public client flows"**. The app will remind you if you forget, but save yourself a round trip and do it upfront.

---

## How it's built

```
intune-ai-studio/
├── backend/
│   ├── main.py           # FastAPI — all API endpoints
│   ├── auth.py           # MSAL device code flow + token cache
│   ├── graph.py          # Microsoft Graph API calls
│   ├── ai.py             # Claude AI integration (search, explain, generate, analyze)
│   ├── config.json       # Created by setup wizard (gitignored)
│   └── requirements.txt
└── frontend/
    └── src/
        ├── pages/        # Dashboard, BulkAdd, ForceSync, GroupAudit, GroupMembers,
        │                 # DeviceSearch, PolicyExplainer, Remediation, ComplianceGap, GroupCleanup
        ├── components/   # Layout, GroupSearch, AIStreamOutput, AIKeyBanner, PermissionsPanel
        └── api/          # Axios wrapper + response interceptor
```

- **Backend** on `:8000`, **frontend** dev server on `:5173` (Vite proxies `/api/*` to the backend)
- Force Sync and AI features use **Server-Sent Events** for real-time streaming
- AI features use the Anthropic SDK with Claude Sonnet for fast, accurate responses

---

## Security

- Auth uses Microsoft's **device code flow** — you authenticate on Microsoft's own servers
- Client ID, Tenant ID, and Anthropic API key live in `backend/config.json` (gitignored)
- Tokens are in memory only and cleared on backend restart or sign-out
- OData injection protection on all Graph API filter inputs
- 30-second timeout on all external API calls
- This is designed for **local use** — don't expose port 8000 to the internet

---

## Ideas & feedback

I'm actively using this and adding to it. If something's broken or you've got an idea for a feature that would save you time, open an issue or drop a PR.

Some things I'm thinking about:
- Bulk device **remove** from groups
- Stale device report (devices not checked in for X days)
- Bulk device rename / tagging
- Cross-group membership comparison
- AI-powered policy **builder** (describe what you want, get the JSON)

Got something better on your wishlist? Let me know.
