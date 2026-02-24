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
- Unity/Blender-inspired scene toolkit: primitive creation, transform operations, and physics toggle per scene object.
- GitHub-inspired control surface: branch creation, commit snapshots, PR tracking, and remote host entries.
- Production-infra simulation controls: multi-provider auth list, SSO extension, and scalable realtime room topology.

## Run
```bash
npm install
npm run dev
```
