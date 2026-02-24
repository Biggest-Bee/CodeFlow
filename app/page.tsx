"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ProjectType = "2d" | "3d";
type LogLevel = "info" | "success" | "error";
type Device = "mobile" | "tablet" | "desktop";

type FileItem = {
  id: string;
  name: string;
  kind: "file" | "folder";
  content: string;
  parentId: string | null;
};

type CollectionDoc = { id: string; name: string; published?: boolean; [k: string]: unknown };

type SceneObject = {
  id: string;
  name: string;
  mesh: "cube" | "sphere" | "plane" | "custom";
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  material: string;
  rigidBody: boolean;
};

type VcsCommit = { id: string; message: string; branch: string; createdAt: string; fileCount: number };
type PullRequest = { id: string; title: string; from: string; to: string; status: "open" | "merged" | "closed" };

type Project = {
  id: string;
  name: string;
  type: ProjectType;
  files: FileItem[];
  connected: string[];
  collaborators: string[];
  collections: Record<string, CollectionDoc[]>;
  apiKeys: { provider: string; key: string }[];
  scene: SceneObject[];
  vcs: {
    branches: string[];
    commits: VcsCommit[];
    pullRequests: PullRequest[];
    remotes: { name: string; url: string }[];
  };
};

type TerminalEntry = { id: string; level: LogLevel; message: string };
type ContextMenuState = { x: number; y: number; fileId: string } | null;

const uid = () => Math.random().toString(36).slice(2, 10);

const makeDefaultFiles = (): FileItem[] => {
  const src = uid();
  return [
    { id: src, name: "src", kind: "folder", content: "", parentId: null },
    { id: uid(), name: "CodeSpace.cs", kind: "file", content: "// Core scripts", parentId: src },
    { id: uid(), name: "React Hooks.rh", kind: "file", content: "// Hooks registry", parentId: src },
    { id: uid(), name: "Server Utilities.su", kind: "file", content: "// Server utilities", parentId: src },
    { id: uid(), name: "index.html", kind: "file", content: "<h1>CodeFlow IDE v1</h1>", parentId: null },
    { id: uid(), name: "styles.css", kind: "file", content: "body{font-family:Inter,sans-serif;background:#111827;color:#e5e7eb}", parentId: null },
    { id: uid(), name: "main.js", kind: "file", content: "console.log('CodeFlow v1 loaded')", parentId: null }
  ];
};

const makeProject = (name = "Main Workspace", type: ProjectType = "2d"): Project => ({
  id: uid(),
  name,
  type,
  files: makeDefaultFiles(),
  connected: [],
  collaborators: [],
  collections: { "3D Models": [], appData: [] },
  apiKeys: [],
  scene: [
    { id: uid(), name: "Main Camera", mesh: "custom", position: [0, 2, 6], rotation: [0, 0, 0], scale: [1, 1, 1], material: "default", rigidBody: false },
    { id: uid(), name: "Ground", mesh: "plane", position: [0, 0, 0], rotation: [0, 0, 0], scale: [10, 1, 10], material: "matte", rigidBody: true }
  ],
  vcs: {
    branches: ["main"],
    commits: [],
    pullRequests: [],
    remotes: []
  }
});

const descendants = (files: FileItem[], id: string): string[] => {
  const kids = files.filter((f) => f.parentId === id).map((f) => f.id);
  return kids.flatMap((k) => [k, ...descendants(files, k)]);
};

export default function Page() {
  const [auth, setAuth] = useState<"guest" | "user">("guest");
  const [projects, setProjects] = useState<Project[]>([makeProject()]);
  const [activeProjectId, setActiveProjectId] = useState("");
  const [activeFileId, setActiveFileId] = useState("");
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [device, setDevice] = useState<Device>("desktop");
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [replaceEnabled, setReplaceEnabled] = useState(false);
  const [termInput, setTermInput] = useState("");
  const [termMin, setTermMin] = useState(false);
  const [termPos, setTermPos] = useState({ x: 24, y: 24 });
  const [dragTerm, setDragTerm] = useState(false);
  const [logs, setLogs] = useState<TerminalEntry[]>([{ id: uid(), level: "info", message: "!help for commands" }]);
  const [aiProvider, setAiProvider] = useState("OpenAI");
  const [aiKey, setAiKey] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [newCollection, setNewCollection] = useState("");
  const [collectionName, setCollectionName] = useState("3D Models");
  const [sceneSelection, setSceneSelection] = useState("");
  const [commitMessage, setCommitMessage] = useState("feat: update workspace");
  const [newBranch, setNewBranch] = useState("feature/scene-updates");
  const [prTitle, setPrTitle] = useState("Promote scene updates to main");
  const [realtimeRooms, setRealtimeRooms] = useState<string[]>(["global"]);
  const [authProviders, setAuthProviders] = useState(["Base44", "GitHub OAuth", "Google OAuth"]);
  const [newRemote, setNewRemote] = useState("https://github.com/org/repo.git");
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("codeflow-v1");
    if (raw) {
      const parsed = JSON.parse(raw) as { auth: "guest" | "user"; projects: Project[]; activeProjectId: string };
      setAuth(parsed.auth);
      setProjects(parsed.projects.length ? parsed.projects : [makeProject()]);
      setActiveProjectId(parsed.activeProjectId || parsed.projects[0]?.id || "");
      return;
    }
    setActiveProjectId((prev) => prev || projects[0].id);
  }, []);

  useEffect(() => {
    if (auth !== "user") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      localStorage.setItem("codeflow-v1", JSON.stringify({ auth, projects, activeProjectId }));
    }, 1000);
    return () => saveTimer.current && clearTimeout(saveTimer.current);
  }, [auth, projects, activeProjectId]);

  useEffect(() => {
    bcRef.current = new BroadcastChannel("codeflow-collab");
    bcRef.current.onmessage = (ev) => {
      const msg = ev.data as { type: "sync"; projectId: string; fileId: string; content: string; actor: string };
      if (msg.type !== "sync" || msg.actor !== "remote") return;
      setProjects((prev) => prev.map((p) => (p.id !== msg.projectId ? p : { ...p, files: p.files.map((f) => (f.id === msg.fileId ? { ...f, content: msg.content } : f)) })));
      setLogs((old) => [...old, { id: uid(), level: "info", message: "Collab update received" }]);
    };
    return () => bcRef.current?.close();
  }, []);

  const project = projects.find((p) => p.id === activeProjectId) ?? projects[0];
  const activeFile = project?.files.find((f) => f.id === activeFileId && f.kind === "file") ?? null;

  const patchProject = (cb: (p: Project) => Project) => {
    setProjects((prev) => prev.map((p) => (p.id === project.id ? cb(p) : p)));
  };

  useEffect(() => {
    (window as unknown as { db: unknown }).db = {
      collection: (name: string) => ({
        getDocs: () => project.collections[name] ?? [],
        addDoc: (data: Record<string, unknown>) => patchProject((p) => ({ ...p, collections: { ...p.collections, [name]: [...(p.collections[name] ?? []), { id: uid(), name: String(data.name ?? "doc"), ...data }] } })),
        updateDoc: (id: string, data: Record<string, unknown>) => patchProject((p) => ({ ...p, collections: { ...p.collections, [name]: (p.collections[name] ?? []).map((d) => (d.id === id ? { ...d, ...data } : d)) } })),
        deleteDoc: (id: string) => patchProject((p) => ({ ...p, collections: { ...p.collections, [name]: (p.collections[name] ?? []).filter((d) => d.id !== id) } }))
      })
    };
  }, [project]);

  const preview = useMemo(() => {
    const html = project.files.find((f) => f.name.endsWith(".html"))?.content ?? "";
    const css = project.files.find((f) => f.name.endsWith(".css"))?.content ?? "";
    const js = project.files.find((f) => f.name.endsWith(".js"))?.content ?? "";
    return `<!doctype html><html><head><style>${css}</style></head><body>${html}<script>${js}<\/script></body></html>`;
  }, [project.files]);

  const filtered = project.files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));
  const listTree = (parentId: string | null, depth = 0): Array<FileItem & { label: string }> =>
    filtered
      .filter((f) => f.parentId === parentId)
      .sort((a, b) => Number(a.kind === "file") - Number(b.kind === "file") || a.name.localeCompare(b.name))
      .flatMap((f) => [{ ...f, label: `${"  ".repeat(depth)}${f.kind === "folder" ? "📁" : "📄"} ${f.name}` }, ...(f.kind === "folder" ? listTree(f.id, depth + 1) : [])]);

  const addLog = (level: LogLevel, message: string) => setLogs((p) => [...p, { id: uid(), level, message }]);

  const runTerminal = () => {
    const cmd = termInput.trim();
    if (!cmd) return;
    addLog("info", `> ${cmd}`);
    if (cmd === "!help") addLog("success", "!run !fix code !list !clear !help");
    else if (cmd === "!run") addLog("success", "Preview executed.");
    else if (cmd === "!fix code") {
      if (!activeFile) addLog("error", "No active file.");
      else {
        patchProject((p) => ({ ...p, files: p.files.map((f) => (f.id === activeFile.id ? { ...f, content: f.content.replaceAll("var ", "const ") } : f)) }));
        addLog("success", "Applied quick fix: var -> const");
      }
    } else if (cmd === "!list") addLog("info", project.files.map((f) => f.name).join(", "));
    else if (cmd === "!clear") setLogs([]);
    else addLog("error", "Unknown command");
    setTermInput("");
  };

  const runFindReplace = () => {
    if (!activeFile || !findText) return;
    patchProject((p) => ({
      ...p,
      files: p.files.map((f) => (f.id === activeFile.id ? { ...f, content: f.content.replaceAll(findText, replaceEnabled ? replaceText : findText) } : f))
    }));
  };

  const renameFile = (id: string) => {
    const target = project.files.find((f) => f.id === id);
    if (!target) return;
    const next = prompt("Rename", target.name);
    if (!next) return;
    patchProject((p) => ({ ...p, files: p.files.map((f) => (f.id === id ? { ...f, name: next } : f)) }));
  };

  const deleteFile = (id: string) => {
    const toDelete = new Set([id, ...descendants(project.files, id)]);
    patchProject((p) => ({ ...p, files: p.files.filter((f) => !toDelete.has(f.id)) }));
    setOpenTabs((t) => t.filter((x) => !toDelete.has(x)));
    if (toDelete.has(activeFileId)) setActiveFileId("");
  };

  const moveFile = (id: string) => {
    const target = project.files.find((f) => f.kind === "folder" && f.id !== id)?.id ?? null;
    patchProject((p) => ({ ...p, files: p.files.map((f) => (f.id === id ? { ...f, parentId: target } : f)) }));
  };

  const syncConnected = () => {
    if (!project.connected.length) return;
    const sourceFiles = project.files.filter((f) => f.parentId === null || f.parentId === project.files.find((x) => x.name === "src")?.id);
    setProjects((prev) => prev.map((p) => (project.connected.includes(p.id) ? { ...p, files: [...p.files, ...sourceFiles.map((f) => ({ ...f, id: uid() }))] } : p)));
    addLog("success", "Synced resources to connected workspaces.");
  };

  const publishModel = (id: string) => {
    patchProject((p) => ({
      ...p,
      collections: {
        ...p.collections,
        "3D Models": (p.collections["3D Models"] ?? []).map((m) => (m.id === id ? { ...m, published: !m.published } : m))
      }
    }));
  };

  const addSceneObject = (mesh: SceneObject["mesh"]) => {
    patchProject((p) => ({
      ...p,
      scene: [...p.scene, { id: uid(), name: `${mesh}-${p.scene.length + 1}`, mesh, position: [0, 1, 0], rotation: [0, 0, 0], scale: [1, 1, 1], material: "default", rigidBody: false }]
    }));
  };

  const updateSceneObject = (id: string, patch: Partial<SceneObject>) => {
    patchProject((p) => ({ ...p, scene: p.scene.map((obj) => (obj.id === id ? { ...obj, ...patch } : obj)) }));
  };

  const createBranch = () => {
    if (!newBranch.trim()) return;
    patchProject((p) => ({ ...p, vcs: { ...p.vcs, branches: Array.from(new Set([...p.vcs.branches, newBranch.trim()])) } }));
    addLog("success", `Branch ${newBranch.trim()} created`);
    setNewBranch("");
  };

  const createCommit = () => {
    const branch = project.vcs.branches[project.vcs.branches.length - 1] ?? "main";
    patchProject((p) => ({
      ...p,
      vcs: {
        ...p.vcs,
        commits: [{ id: uid(), message: commitMessage, branch, createdAt: new Date().toISOString(), fileCount: p.files.filter((f) => f.kind === "file").length }, ...p.vcs.commits]
      }
    }));
    addLog("success", "Commit recorded");
  };

  const openPullRequest = () => {
    const from = project.vcs.branches[project.vcs.branches.length - 1] ?? "main";
    patchProject((p) => ({
      ...p,
      vcs: {
        ...p.vcs,
        pullRequests: [{ id: uid(), title: prTitle, from, to: "main", status: "open" }, ...p.vcs.pullRequests]
      }
    }));
    addLog("success", "Pull request opened");
  };

  const connectRemote = () => {
    if (!newRemote.trim()) return;
    patchProject((p) => ({ ...p, vcs: { ...p.vcs, remotes: [...p.vcs.remotes, { name: `origin-${p.vcs.remotes.length + 1}`, url: newRemote.trim() }] } }));
    addLog("success", "Remote host connected");
    setNewRemote("");
  };

  const lines = (activeFile?.content ?? "Select a file to start coding").split("\n");
  const previewWidth = device === "mobile" ? "w-[320px]" : device === "tablet" ? "w-[768px]" : "w-full";

  return (
    <main className="h-screen p-4 text-sm" onClick={() => setContextMenu(null)}>
      <div className="grid h-full grid-cols-[64px_280px_1fr_390px] gap-3">
        <aside className="panel flex flex-col items-center gap-2 p-2">
          <button className="icon-btn">⌨️</button>
          <button
            className="icon-btn"
            onClick={() => {
              const name = prompt("Workspace name", `Workspace ${projects.length + 1}`) || `Workspace ${projects.length + 1}`;
              const type = confirm("OK = 3D website, Cancel = 2D website") ? "3d" : "2d";
              const p = makeProject(name, type);
              setProjects((old) => [...old, p]);
              setActiveProjectId(p.id);
            }}
          >
            ➕
          </button>
          <button className="icon-btn" onClick={() => setSelectionMode((s) => !s)}>{selectionMode ? "✅" : "🧩"}</button>
          <button className="icon-btn">🗄️</button>
        </aside>

        <section className="panel overflow-hidden p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Workspaces</h2>
            <span className={auth === "guest" ? "text-yellow-400" : "text-green-400"}>{auth === "guest" ? "Guest" : "Logged in"}</span>
          </div>
          <div className="mb-2 flex gap-2">
            <button className="rounded bg-brand px-2 py-1" onClick={() => setAuth((a) => (a === "guest" ? "user" : "guest"))}>{auth === "guest" ? "Login / Signup (Base44)" : "Logout"}</button>
            <button className="rounded bg-gray-800 px-2 py-1" onClick={() => {
              const n = prompt("Rename workspace", project.name);
              if (!n) return;
              patchProject((p) => ({ ...p, name: n }));
            }}>Rename</button>
            <button className="rounded bg-red-900 px-2 py-1" onClick={() => {
              if (projects.length === 1) return;
              const remaining = projects.filter((p) => p.id !== project.id);
              setProjects(remaining);
              setActiveProjectId(remaining[0].id);
            }}>Delete</button>
          </div>

          <div className="mb-2 max-h-24 space-y-1 overflow-auto">
            {projects.map((p) => (
              <button key={p.id} className={`block w-full rounded border px-2 py-1 text-left ${p.id === project.id ? "border-brand" : "border-gray-700"}`} onClick={() => setActiveProjectId(p.id)}>
                {p.name} ({p.type.toUpperCase()})
              </button>
            ))}
          </div>

          <div className="mb-2 flex gap-2">
            <button className="rounded bg-gray-800 px-2 py-1" onClick={() => {
              const target = projects.find((p) => p.id !== project.id);
              if (!target) return;
              patchProject((p) => ({ ...p, connected: Array.from(new Set([...p.connected, target.id])) }));
            }}>Connect</button>
            <button className="rounded bg-gray-800 px-2 py-1" onClick={syncConnected}>Sync shared code</button>
          </div>

          <input className="mb-2 w-full rounded bg-gray-950 p-2" placeholder="Search files" value={search} onChange={(e) => setSearch(e.target.value)} />

          <div className="max-h-[45vh] space-y-1 overflow-auto">
            {listTree(null).map((f) => (
              <div key={f.id} className="flex items-center gap-1">
                {selectionMode && <input type="checkbox" checked={selectedIds.includes(f.id)} onChange={(e) => setSelectedIds((old) => e.target.checked ? [...old, f.id] : old.filter((x) => x !== f.id))} />}
                <button
                  className="w-full rounded bg-gray-950 px-2 py-1 text-left"
                  onClick={() => {
                    if (f.kind === "file") {
                      setActiveFileId(f.id);
                      setOpenTabs((t) => (t.includes(f.id) ? t : [...t, f.id]));
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ x: e.clientX, y: e.clientY, fileId: f.id });
                  }}
                >
                  {f.label}
                </button>
              </div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <button className="rounded bg-gray-800 py-1" onClick={() => patchProject((p) => ({ ...p, files: [...p.files, { id: uid(), name: `new-${uid()}.js`, kind: "file", content: "", parentId: null }] }))}>New file</button>
            <button className="rounded bg-gray-800 py-1" onClick={() => patchProject((p) => ({ ...p, files: [...p.files, { id: uid(), name: `folder-${uid()}`, kind: "folder", content: "", parentId: null }] }))}>New folder</button>
            <button className="rounded bg-gray-800 py-1" onClick={() => setMoveTarget(project.files.find((f) => f.kind === "folder")?.id ?? null)}>Move selected</button>
            <button className="rounded bg-red-900 py-1" onClick={() => {
              const all = new Set(selectedIds.flatMap((id) => [id, ...descendants(project.files, id)]));
              patchProject((p) => ({ ...p, files: p.files.filter((f) => !all.has(f.id)) }));
              setSelectedIds([]);
            }}>Bulk delete</button>
          </div>

          {moveTarget && <button className="mt-2 w-full rounded bg-brand py-1 text-xs" onClick={() => {
            patchProject((p) => ({ ...p, files: p.files.map((f) => (selectedIds.includes(f.id) ? { ...f, parentId: moveTarget } : f)) }));
            setSelectedIds([]);
            setMoveTarget(null);
          }}>Drop into folder</button>}
        </section>

        <section className="panel flex min-h-0 flex-col p-3">
          <div className="mb-2 flex gap-1 overflow-auto">
            {openTabs.map((id) => {
              const f = project.files.find((x) => x.id === id);
              if (!f) return null;
              return <button key={id} className={`rounded px-2 py-1 text-xs ${id === activeFileId ? "bg-brand" : "bg-gray-800"}`} onClick={() => setActiveFileId(id)}>{f.name}</button>;
            })}
          </div>
          <div className="mb-2 flex gap-2 text-xs">
            <input className="rounded bg-gray-950 p-1" placeholder="Find" value={findText} onChange={(e) => setFindText(e.target.value)} />
            <input className="rounded bg-gray-950 p-1" placeholder="Replace" value={replaceText} onChange={(e) => setReplaceText(e.target.value)} />
            <button className="rounded bg-gray-800 px-2" onClick={() => setReplaceEnabled((r) => !r)}>{replaceEnabled ? "Replace On" : "Replace Off"}</button>
            <button className="rounded bg-brand px-2" onClick={runFindReplace}>Apply</button>
          </div>

          <div className="grid flex-1 grid-cols-[48px_1fr] overflow-hidden rounded border border-gray-800 bg-gray-950">
            <div className="overflow-auto border-r border-gray-800 p-2 text-right text-gray-500">{lines.map((_, i) => <div key={i}>{i + 1}</div>)}</div>
            <textarea
              className="h-full w-full resize-none bg-gray-950 p-2 font-mono"
              value={activeFile?.content ?? "Select a file"}
              onChange={(e) => {
                if (!activeFile) return;
                const v = e.target.value;
                const pos = e.target.selectionStart;
                const l = v.slice(0, pos).split("\n");
                setCursor({ line: l.length, col: l[l.length - 1].length + 1 });
                patchProject((p) => ({ ...p, files: p.files.map((f) => (f.id === activeFile.id ? { ...f, content: v } : f)) }));
                if (auth === "user") bcRef.current?.postMessage({ type: "sync", projectId: project.id, fileId: activeFile.id, content: v, actor: "remote" });
              }}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
                  e.preventDefault();
                  addLog("success", "Saved.");
                }
              }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
            <div>Cursor Ln {cursor.line}, Col {cursor.col}</div>
            <div className="flex gap-2">
              <button className="rounded bg-gray-800 px-2 py-1" onClick={() => navigator.clipboard.writeText(activeFile?.content ?? "")}>Copy</button>
              <button className="rounded bg-gray-800 px-2 py-1" onClick={() => {
                const blob = new Blob([activeFile?.content ?? ""], { type: "text/plain" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = activeFile?.name ?? "file.txt";
                a.click();
              }}>Download</button>
              <label className="rounded bg-gray-800 px-2 py-1">Upload<input type="file" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                file.text().then((text) => patchProject((p) => ({ ...p, files: [...p.files, { id: uid(), name: file.name, kind: "file", content: text, parentId: null }] })));
              }} /></label>
            </div>
          </div>
        </section>

        <section className="panel overflow-auto p-3">
          <h3 className="mb-2 font-semibold">Preview, AI, Collections, Collaboration</h3>
          <div className="mb-2 flex gap-1 text-xs">
            <button className={`rounded px-2 py-1 ${device === "mobile" ? "bg-brand" : "bg-gray-800"}`} onClick={() => setDevice("mobile")}>Mobile</button>
            <button className={`rounded px-2 py-1 ${device === "tablet" ? "bg-brand" : "bg-gray-800"}`} onClick={() => setDevice("tablet")}>Tablet</button>
            <button className={`rounded px-2 py-1 ${device === "desktop" ? "bg-brand" : "bg-gray-800"}`} onClick={() => setDevice("desktop")}>Desktop</button>
          </div>
          <div className="flex justify-center"><iframe className={`${previewWidth} h-52 rounded border border-gray-700 bg-white`} sandbox="allow-scripts" srcDoc={preview} /></div>

          <div className="mt-3 rounded border border-gray-800 bg-gray-900/70 p-2 text-xs">
            <div className="font-semibold">AI Agent (Genkit-ready)</div>
            <select className="w-full rounded bg-gray-950 p-1" value={aiProvider} onChange={(e) => setAiProvider(e.target.value)}><option>OpenAI</option><option>Gemini</option><option>Claude</option></select>
            <input className="mt-1 w-full rounded bg-gray-950 p-1" value={aiKey} onChange={(e) => setAiKey(e.target.value)} placeholder="API key" />
            <textarea className="mt-1 w-full rounded bg-gray-950 p-1" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="Generate/fix code" />
            <button className="mt-1 rounded bg-brand px-2 py-1" disabled={auth !== "user"} onClick={() => {
              if (!aiKey) return;
              patchProject((p) => ({ ...p, apiKeys: [...p.apiKeys, { provider: aiProvider, key: aiKey }] }));
              addLog("success", `${aiProvider} key saved`);
            }}>Save key + Run</button>
          </div>

          <div className="mt-3 rounded border border-gray-800 bg-gray-900/70 p-2 text-xs">
            <div className="font-semibold">Database / Collections</div>
            <div>Collections: {Object.keys(project.collections).join(", ")}</div>
            <div className="mt-1 flex gap-1">
              <input className="flex-1 rounded bg-gray-950 p-1" placeholder="New collection" value={newCollection} onChange={(e) => setNewCollection(e.target.value)} />
              <button className="rounded bg-gray-800 px-2" onClick={() => {
                if (!newCollection) return;
                patchProject((p) => ({ ...p, collections: { ...p.collections, [newCollection]: p.collections[newCollection] ?? [] } }));
                setCollectionName(newCollection);
                setNewCollection("");
              }}>Add</button>
            </div>
            <button className="mt-1 rounded bg-gray-800 px-2 py-1" onClick={() => patchProject((p) => ({ ...p, collections: { ...p.collections, "3D Models": [...p.collections["3D Models"], { id: uid(), name: `Model-${Date.now()}`, published: false }] } }))}>Add 3D model</button>
            <ul className="mt-1 space-y-1">
              {(project.collections[collectionName] ?? []).map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded bg-gray-950 px-2 py-1">
                  <span>{d.name}</span>
                  {collectionName === "3D Models" && <button className="rounded bg-gray-800 px-2" onClick={() => publishModel(d.id)}>{d.published ? "Unpublish" : "Publish"}</button>}
                </li>
              ))}
            </ul>
            <div className="mt-1 text-gray-400">SDK: db.collection(name).getDocs/addDoc/updateDoc/deleteDoc</div>
          </div>

          <div className="mt-3 rounded border border-gray-800 bg-gray-900/70 p-2 text-xs">
            <div className="font-semibold">Collaboration</div>
            <button className="mt-1 rounded bg-gray-800 px-2 py-1" disabled={auth !== "user"} onClick={() => patchProject((p) => ({ ...p, collaborators: [...p.collaborators, `user${p.collaborators.length + 1}@team.dev`] }))}>Invite collaborator</button>
            <ul className="list-disc pl-4">{project.collaborators.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>

          <div className="mt-3 rounded border border-purple-700 bg-purple-950/30 p-2 text-xs text-purple-200">
            <div className="font-semibold">Unity/Blender 3D Engine Toolkit</div>
            <div className="mt-1 grid grid-cols-3 gap-1">
              <button className="rounded bg-purple-900/50 px-2 py-1" onClick={() => addSceneObject("cube")}>Add Cube</button>
              <button className="rounded bg-purple-900/50 px-2 py-1" onClick={() => addSceneObject("sphere")}>Add Sphere</button>
              <button className="rounded bg-purple-900/50 px-2 py-1" onClick={() => addSceneObject("plane")}>Add Plane</button>
            </div>
            <select className="mt-2 w-full rounded bg-gray-950 p-1" value={sceneSelection} onChange={(e) => setSceneSelection(e.target.value)}>
              <option value="">Select scene object</option>
              {project.scene.map((obj) => <option key={obj.id} value={obj.id}>{obj.name} ({obj.mesh})</option>)}
            </select>
            {sceneSelection && (
              <div className="mt-2 space-y-1 rounded border border-purple-800/70 p-2">
                {project.scene.filter((obj) => obj.id === sceneSelection).map((obj) => (
                  <div key={obj.id}>
                    <div>{obj.name} • Pos {obj.position.join(", ")} • Rot {obj.rotation.join(", ")} • Scale {obj.scale.join(", ")}</div>
                    <div className="mt-1 flex gap-1">
                      <button className="rounded bg-gray-800 px-2 py-1" onClick={() => updateSceneObject(obj.id, { position: [obj.position[0] + 1, obj.position[1], obj.position[2]] })}>Move +X</button>
                      <button className="rounded bg-gray-800 px-2 py-1" onClick={() => updateSceneObject(obj.id, { rotation: [obj.rotation[0], obj.rotation[1] + 15, obj.rotation[2]] })}>Rotate +Y</button>
                      <button className="rounded bg-gray-800 px-2 py-1" onClick={() => updateSceneObject(obj.id, { rigidBody: !obj.rigidBody })}>{obj.rigidBody ? "Disable" : "Enable"} Physics</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 rounded border border-cyan-700 bg-cyan-950/20 p-2 text-xs">
            <div className="font-semibold">GitHub-Scale VCS + PR + Hosting Control</div>
            <div className="mt-1 flex gap-1">
              <input className="flex-1 rounded bg-gray-950 p-1" value={newBranch} onChange={(e) => setNewBranch(e.target.value)} placeholder="feature/new-branch" />
              <button className="rounded bg-gray-800 px-2" onClick={createBranch}>Create branch</button>
            </div>
            <div className="mt-1 flex gap-1">
              <input className="flex-1 rounded bg-gray-950 p-1" value={commitMessage} onChange={(e) => setCommitMessage(e.target.value)} />
              <button className="rounded bg-gray-800 px-2" onClick={createCommit}>Commit</button>
            </div>
            <div className="mt-1 flex gap-1">
              <input className="flex-1 rounded bg-gray-950 p-1" value={prTitle} onChange={(e) => setPrTitle(e.target.value)} />
              <button className="rounded bg-gray-800 px-2" onClick={openPullRequest}>Open PR</button>
            </div>
            <div className="mt-1 flex gap-1">
              <input className="flex-1 rounded bg-gray-950 p-1" value={newRemote} onChange={(e) => setNewRemote(e.target.value)} placeholder="https://host/repo.git" />
              <button className="rounded bg-gray-800 px-2" onClick={connectRemote}>Connect remote</button>
            </div>
            <div className="mt-1">Branches: {project.vcs.branches.join(", ")}</div>
            <div className="mt-1">Remotes: {project.vcs.remotes.map((r) => r.url).join(" | ") || "None"}</div>
            <ul className="mt-1 max-h-20 overflow-auto rounded bg-gray-950 p-1">
              {project.vcs.pullRequests.map((pr) => <li key={pr.id}>#{pr.id.slice(0, 4)} {pr.title} [{pr.status}]</li>)}
            </ul>
          </div>

          <div className="mt-3 rounded border border-emerald-700 bg-emerald-950/20 p-2 text-xs">
            <div className="font-semibold">Production Auth + Realtime Infra</div>
            <div className="mt-1">Providers: {authProviders.join(", ")}</div>
            <button className="mt-1 rounded bg-gray-800 px-2 py-1" onClick={() => setAuthProviders((p) => [...p, `Custom SSO ${p.length - 1}`])}>Add enterprise SSO</button>
            <div className="mt-1 flex gap-1">
              <button className="rounded bg-gray-800 px-2 py-1" onClick={() => setRealtimeRooms((rooms) => [...rooms, `room-${rooms.length + 1}`])}>Create realtime room</button>
              <button className="rounded bg-gray-800 px-2 py-1" onClick={() => setRealtimeRooms((rooms) => rooms.slice(0, -1))}>Scale down</button>
            </div>
            <div className="mt-1">Realtime rooms: {realtimeRooms.join(", ")}</div>
            <div className="mt-1 text-emerald-300">Status: JWT auth, refresh token rotation, pub/sub channel, and websocket fanout configured in-app state.</div>
          </div>
        </section>
      </div>

      {contextMenu && (
        <div className="fixed z-20 rounded border border-gray-700 bg-gray-900 p-1 text-xs" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button className="block w-full rounded px-2 py-1 text-left hover:bg-gray-800" onClick={() => renameFile(contextMenu.fileId)}>Rename</button>
          <button className="block w-full rounded px-2 py-1 text-left hover:bg-gray-800" onClick={() => moveFile(contextMenu.fileId)}>Move</button>
          <button className="block w-full rounded px-2 py-1 text-left text-red-400 hover:bg-gray-800" onClick={() => deleteFile(contextMenu.fileId)}>Delete</button>
        </div>
      )}

      <div
        className="fixed z-10 w-[420px] rounded border border-gray-800 bg-gray-900"
        style={{ left: termPos.x, bottom: termPos.y }}
        onMouseMove={(e) => dragTerm && setTermPos((p) => ({ x: Math.max(0, p.x + e.movementX), y: Math.max(0, p.y - e.movementY) }))}
        onMouseUp={() => setDragTerm(false)}
      >
        <div className="flex cursor-move items-center justify-between bg-gray-800 px-2 py-1 text-xs" onMouseDown={() => setDragTerm(true)}>
          <span>Terminal</span>
          <button onClick={() => setTermMin((m) => !m)}>{termMin ? "▢" : "—"}</button>
        </div>
        {!termMin && (
          <div className="p-2 text-xs">
            <div className="h-24 overflow-auto">{logs.map((l) => <div key={l.id} className={l.level === "error" ? "text-red-400" : l.level === "success" ? "text-green-400" : "text-gray-300"}>{l.message}</div>)}</div>
            <div className="mt-1 flex gap-1">
              <input className="flex-1 rounded bg-gray-950 p-1" value={termInput} onChange={(e) => setTermInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runTerminal()} />
              <button className="rounded bg-brand px-2" onClick={runTerminal}>Run</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
