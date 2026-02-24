# CodeFlow IDE (v1)

CodeFlow IDE v1 is a high-fidelity Next.js web IDE prototype that implements a practical, testable v1 scope.

## Done for v1
- Multi-workspace management: create, rename, delete, switch, and connect workspaces.
- 2D or 3D mode on project creation.
- Connected workspace resource sync action.
- File explorer with hierarchy, search, context menu (rename/move/delete), and bulk selection mode.
- Editor with tabs, line numbers, cursor location, find/replace, save hotkey signal, copy/download/upload.
- Live preview panel with mobile/tablet/desktop selectors.
- Draggable/minimizable terminal with `!run`, `!fix code`, `!list`, `!clear`, `!help`.
- Simulated DB engine + SDK on `window.db.collection(name)` with CRUD methods.
- AI panel with provider selection and per-project API key persistence (logged-in users).
- 3D Models collection with publish/unpublish flow.
- Collaboration panel and same-browser-tab live sync via `BroadcastChannel`.
- Debounced (1s) persistence for authenticated users.

## What is not in v1
- Full Unity/Blender-grade 3D engine capabilities.
- Full GitHub-scale VCS, PRs, and remote hosting.
- Production backend auth and realtime infra.

## Run
```bash
npm install
npm run dev
```

## Direct link
- Local app URL: `http://localhost:3000`
- Direct file path in this environment: `/workspace/CodeFlow`
- GitHub link for this working copy: **not available right now** (no `origin` remote is configured in this environment).
- To create your direct GitHub link, run:

```bash
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin work
```

Then open: `https://github.com/<your-user>/<your-repo>/tree/work`
