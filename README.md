# QA Hub

Desktop tool for QA engineers to manage test sessions, create test cases, and manage test cycles — all integrated with **Zephyr Scale Cloud** and **Jira**.

---

## Prerequisites

- Java 21+
- Maven 3.8+
- Node.js 18+

---

## Setup

**1. Copy the env file:**
```bash
cp .env.example .env
```

**2. Fill in your `.env`:**

| Variable | Required | Description |
|---|---|---|
| `ZEPHYR_TOKEN` | Yes | Generate at: Jira → Apps → Zephyr Scale → API Access Tokens |
| `JIRA_PROJECT` | Yes | Your Jira project key (e.g. `DEV`) |
| `JIRA_BASE_URL` | Optional | Your Jira base URL (e.g. `https://company.atlassian.net`). Needed to link cycles to Jira issues. |
| `JIRA_EMAIL` | Optional | Your Jira email. Needed together with `JIRA_BASE_URL`. |
| `JIRA_API_TOKEN` | Optional | Generate at: id.atlassian.net → Security → API tokens. Used as fallback if Zephyr can't resolve the issue ID. |
| `ANTHROPIC_AUTH_TOKEN` | Optional | Required for AI features. Your Anthropic API key or gateway token. |
| `TEST_CASES_FILE` | Yes | JSON file path (default: `test-cases.json`) |
| `REPOS_BASE_DIR` | Optional* | Path to your local repos folder. Used by Branch Analysis to read git diffs locally. |
| `GITHUB_ORG` | Optional* | Your GitHub organization name (e.g. `YourOrg`). Used by Branch Analysis via GitHub MCP — no local repos needed. Requires `github` configured in `~/.claude/mcp.json`. |

> **Note:** `JIRA_BASE_URL`, `JIRA_EMAIL` and `JIRA_API_TOKEN` are optional — the app tries to resolve the Jira issue ID using only the Zephyr token first. Add them only if linking cycles to issues isn't working.

> **Branch Analysis — pick one approach:**
> - `REPOS_BASE_DIR` — point to your local clone of the repos. Works offline, no extra setup.
> - `GITHUB_ORG` — set your GitHub org name and configure the `github` MCP in `~/.claude/mcp.json`. The app fetches the diff directly from GitHub — no local repos needed.

**3. Build the backend:**
```bash
mvn package -q
```

**4. Install frontend dependencies:**
```bash
cd app && npm install
```

---

## Running

```bash
cd app && npm run dev
```

To stop the app, press **Ctrl+C** in the terminal.

---

## Features

### New QA Session

The main workflow screen. Fill in the details for a QA session and export everything to a report or Zephyr.

**Panels:**
- **Issue Info** — Jira issue link, developer name, QA name
- **Additional & Default Configuration** — environment notes, test data, credentials
- **QA Notes** — observations and findings during QA
- **Possible Impacts** — areas that could be affected by the change
- **Test Cases** — create and import test cases to Zephyr

**Text formatting** (available in Configuration, QA Notes, and Possible Impacts):
- `**text**` → **bold** — or select text and click **B**
- `*text*` → *italic* — or select text and click **I**
- `` `text` `` → `inline code` — or select text and click **`**
- `- text` → bullet point — or click **•** to toggle on the current line

**Workflow:**
1. Fill in Issue Info
2. Add configuration notes, QA notes, and possible impacts
3. In Test Cases, fill the form and click **ADD** for each test case
   - Select a **Folder** by typing to search — the full path is shown (e.g. `API / TEAM / Feature`)
   - Click **✎** to edit a case before importing
4. Click **Import to Zephyr** to send all cases to Zephyr Scale
5. After importing, click **Create Test Cycle** to create a cycle with all imported cases
   - After the cycle is created, you can **link it to a Jira issue** directly in the modal
6. Click **Generate Report** to generate an HTML report with all session details

---

### Create Test Case

Standalone screen to create and import test cases without starting a full QA session. Same form and folder search as above.

---

### Manage Test Cycle

Screen to load, inspect, and manage existing test cycles in Zephyr.

- **Create Test Cycle** (left panel) — create a new cycle with test case IDs
- **Load Cycle** (middle panel) — load a cycle by ID to see its test cases and execution statuses
  - Update execution status (Pass, Fail, Blocked, etc.) directly from the app
  - Link the cycle to a Jira issue
  - **Generate Report** — exports an HTML report with all test cases, statuses, and a Pass/Fail summary

---

### New QA Session powered by AI

Generate a QA session plan (QA notes, possible impacts, and BDD test cases) from a Jira issue key using Claude AI.

> **TEMPORARY APPROACH — AI authentication via Claude CLI**
>
> Currently the app calls Claude by spawning the local Claude CLI. Each QA member needs to set it up once on their machine:
>
> **1. Install the Claude CLI:**
> ```bash
> npm install -g @anthropic-ai/claude-code
> ```
>
> **2. Log in:**
> ```bash
> claude login
> ```
> This opens the browser for authentication. Once done, the app will use your session automatically.
>
> **3. Make sure `JIRA_BASE_URL`, `JIRA_EMAIL` and `JIRA_API_TOKEN` are set in your `.env`** — the AI feature fetches the Jira issue before calling Claude.
>
> In the future this will be replaced by a direct API key approach when the team has access to an Anthropic API key.

---

### My Sessions

Saved sessions screen where every QA session is stored locally for future reference.

**Tabs:**
- **Working** — active sessions currently in progress
- **Merged** — sessions moved here after the PR is merged, kept as a historical record

**Actions per session:**
- **Load** — reopen the session in the QA workflow
- **Preview** — opens the session as an HTML report in the browser for quick viewing
- **↓ DOCX** — exports a `.docx` file with all test cases, BDD scenarios, and an empty evidence box below each scenario so the team can paste screenshots and notes directly into the document
- **Branch Analysis** — run an AI-powered diff analysis against a branch; findings are saved with the session
- **⤵** — moves the session to the Merged tab
- **✕** — deletes the session (with confirmation)

**Branch Analysis panel:**
- Enter a branch name and optionally paste the PR description
- Claude analyses the diff and returns: automated test coverage by layer (unit / acceptance / e2e), coverage gaps with risk level, and plan adherence score
- Under **Missing / Not tested**, each item has a checkbox — click to mark it as **Manually validated** (persisted with the session)

---

## Reports

Reports are saved in the `reports/` folder.

| Format | How to generate | Contents |
|---|---|---|
| **HTML Preview** | Click **Preview** on any saved session | Issue info, config notes, QA notes, impacts, all test cases with BDD |
| **DOCX** | Click **↓ DOCX** on any saved session | Same as Preview + an evidence box below each BDD scenario for screenshots/notes |
| **Cycle report (HTML)** | Click **Generate Report** in Manage Test Cycle | Cycle name, folder, dates, all test cases with execution status, Pass/Fail summary |
