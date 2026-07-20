import { useState, useEffect, lazy, Suspense } from "react";
import Sidebar from "./components/sidebar/Sidebar";
import MessageList from "./components/MessageList";
import InputBar from "./components/input-bar/InputBar";
import MemoryBrowser from "./components/MemoryBrowser";
import RouterSettings from "./components/RouterSettings";
import ProjectSwitcher from "./components/ProjectSwitcher";
import FirstRunSetup from "./components/FirstRunSetup";
import Button from "./components/button/Button";
import Tooltip from "./components/tooltip/Tooltip";
import Avatar from "./components/avatar/Avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Moon, Sun, Brain, Settings, FolderKanban, Share2, Plus, SquarePen, Search, Pin, PinOff, MoreHorizontal } from "lucide-react";
import { sendMessage, fetchMessages, uploadFile, fetchProjects, fetchConversations, setConversationPinned, fetchRouterConfig } from "./services/api";
import { createGreetingCycle } from "./lib/greetings";

const GraphView = lazy(() => import("./components/GraphView"));

export default function App() {
  const [view, setView] = useState("chat"); // "chat" | "graph"
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem("aria-dark-mode");
    if (stored !== null) return stored === "true";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const [memoryJumpTo, setMemoryJumpTo] = useState(null);

  // New-chat greeting — cycles through the full pool before repeating.
  const [nextGreeting] = useState(() => createGreetingCycle());
  const [greeting, setGreeting] = useState(() => nextGreeting());

  const handleJumpToMemory = (type, ref) => {
    setMemoryJumpTo({ type, ref });
    setSettingsOpen(false);
    setMemoryOpen(true);
  };

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("aria-dark-mode", String(darkMode));
  }, [darkMode]);

  // Projects — active project persisted to localStorage
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(
    () => localStorage.getItem("aria-active-project") || null
  );
  const [projectSwitcherOpen, setProjectSwitcherOpen] = useState(false);

  // New Sidebar (design-system) — all conversations across projects, for
  // the Recent Chats + Projects sections. Refetched whenever the active
  // conversation changes (covers new-chat creation and title updates).
  const [conversations, setConversations] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const refreshConversations = () => {
    fetchConversations().then(setConversations).catch(() => {});
  };

  useEffect(() => {
    refreshConversations();
  }, [conversationId]);

  const handleTogglePin = async (convo) => {
    try {
      await setConversationPinned(convo.id, !convo.pinned);
      refreshConversations();
    } catch {
      // best-effort — list simply won't reflect the change if this fails
    }
  };

  const handleSelectChat = (convo) => {
    setView("chat");
    if (convo.project_id && convo.project_id !== activeProjectId) {
      setActiveProjectId(convo.project_id);
    }
    loadConversation(convo.id);
  };

  const refreshProjects = async () => {
    const list = await fetchProjects();
    setProjects(list);
    refreshConversations(); // project CRUD can add/remove conversations too
    const stillValid = activeProjectId && list.some((p) => p.id === activeProjectId);
    if (!stillValid) {
      setActiveProjectId(list[0]?.id ?? null);
      if (activeProjectId) handleNewChat(); // active project was deleted out from under us
    }
  };

  useEffect(() => {
    refreshProjects().catch(() => {});
  }, []);

  useEffect(() => {
    if (activeProjectId) localStorage.setItem("aria-active-project", activeProjectId);
  }, [activeProjectId]);

  const handleProjectSelect = (id) => {
    setActiveProjectId(id);
    handleNewChat();
  };

  const handleNewChatInProject = (projectId) => {
    setActiveProjectId(projectId);
    setView("chat");
    handleNewChat();
  };

  // Routing state — persisted to localStorage. "ask" was retired with the
  // tier system; anything stored as "ask" falls back to auto.
  const [routingMode, setRoutingMode] = useState(() => {
    const stored = localStorage.getItem("aria-routing-mode");
    return stored === "manual" ? "manual" : "auto";
  });

  // Provider/model catalog — drives the manual picker, the retry menu, and
  // the first-run setup. Refreshed whenever a key is added in Settings.
  const [routerConfig, setRouterConfig] = useState(null);
  const refreshRouterConfig = () => {
    fetchRouterConfig().then(setRouterConfig).catch(() => {});
  };
  useEffect(() => {
    refreshRouterConfig();
  }, []);

  // Every selectable model across configured providers.
  const modelOptions = routerConfig
    ? Object.entries(routerConfig.providers)
        .filter(([, p]) => p.configured)
        .flatMap(([pid, p]) =>
          p.models.map((m) => ({ provider: pid, model: m.id, label: m.label }))
        )
    : [];

  // Manual mode's standing pick — {provider, model} or null (null = let the
  // backend use its default model). Persisted like routingMode.
  const [manualModel, setManualModel] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("aria-manual-model")) || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    localStorage.setItem("aria-routing-mode", routingMode);
  }, [routingMode]);

  useEffect(() => {
    if (manualModel) localStorage.setItem("aria-manual-model", JSON.stringify(manualModel));
    else localStorage.removeItem("aria-manual-model");
  }, [manualModel]);

  const handleModeChange = (mode) => setRoutingMode(mode);

  const loadConversation = async (id) => {
    setView("chat");
    setConversationId(id);
    setError(null);
    try {
      const msgs = await fetchMessages(id);
      setMessages(msgs);
    } catch {
      setMessages([]);
    }
  };

  const handleNewChat = () => {
    setConversationId(null);
    setMessages([]);
    setError(null);
    setGreeting(nextGreeting());
  };

  // Core send. overrideSel ({provider, model} | null) is a one-shot explicit
  // pick — used by the retry menu; a normal manual-mode send uses the
  // standing manualModel pick instead.
  const _doSend = async (text, fileContent, fileName, truncated, overrideSel, existingConvoId, image) => {
    const targetConvoId = existingConvoId ?? conversationId;
    const displayText = text.trim() || (fileName ? "Please read and summarise this file for me." : "");
    const optimisticId = `tmp-${Date.now()}`;

    const optimistic = {
      id: optimisticId,
      role: "user",
      content: displayText,
      file_name: fileName,
      truncated,
      conversation_id: targetConvoId,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setLoading(true);
    setError(null);

    try {
      // A one-shot pick (retry menu) forces manual for that single message;
      // otherwise manual mode sends the standing pick (when one is set) and
      // auto sends nothing — the backend classifies and routes.
      const sel = overrideSel ?? (routingMode === "manual" ? manualModel : null);
      const reqMode = overrideSel ? "manual" : routingMode;

      const data = await sendMessage(text, targetConvoId, fileContent, fileName, reqMode, sel?.provider, sel?.model, activeProjectId, image);

      if (!conversationId) setConversationId(data.conversation_id);

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticId),
        { ...optimistic, id: `user-${data.message_id}` },
        {
          id: data.message_id,
          role: "assistant",
          content: data.reply,
          model: data.model,
          provider: data.provider,
          task_role: data.role,
          tools_used: data.tools_used || [],
          sources: data.sources || [],
          conversation_id: data.conversation_id,
        },
      ]);
    } catch (err) {
      setError(err.message);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (text, file) => {
    let fileContent = null, fileName = null, truncated = false, image = null;
    if (file) {
      try {
        const uploaded = await uploadFile(file);
        fileName = uploaded.filename;
        if (uploaded.is_image) {
          image = { data: uploaded.data, mime: uploaded.mime_type };
        } else {
          fileContent = uploaded.text;
          truncated = uploaded.truncated;
        }
      } catch (err) {
        setError(`File upload failed: ${err.message}`);
        return;
      }
    }
    await _doSend(text, fileContent, fileName, truncated, null, null, image);
  };

  // Retry re-sends the user text behind a message — for a user bubble that's
  // its own content, for an assistant reply it's the nearest preceding user
  // message (attachments aren't retried, only the text). An explicit model
  // pick (from RetryModelMenu, assistant replies only) forces that one
  // resend — it's not sticky, the next message routes fresh as normal.
  const handleRetryMessage = (message, sel) => {
    if (loading) return;
    const userText =
      message.role === "user"
        ? message.content
        : messages
            .slice(0, messages.indexOf(message))
            .reverse()
            .find((m) => m.role === "user")?.content;
    if (!userText) return;
    _doSend(userText, null, null, false, sel ?? null, conversationId);
  };

  // Drops a sent message's text back into the composer for editing — see
  // InputBar's prefillKey effect.
  const [editDraft, setEditDraft] = useState(null);
  const handleEditMessage = (message) => setEditDraft({ text: message.content, key: Date.now() });

  // The "More" menu (Edit / Delete) is deferred entirely — no dropdown
  // built yet, just the icon.
  const toChatItem = (convo) => ({
    id: convo.id,
    label: convo.title || "Untitled",
    selected: convo.id === conversationId,
    onClick: () => handleSelectChat(convo),
    actions: [
      {
        icon: convo.pinned ? PinOff : Pin,
        label: convo.pinned ? "Unpin" : "Pin",
        onClick: () => handleTogglePin(convo),
      },
      { icon: MoreHorizontal, label: "More", onClick: () => {} },
    ],
  });

  const pinnedConversations = conversations.filter((c) => c.pinned);

  const sidebarSections = [
    {
      id: "projects",
      title: "Projects",
      // "Default" is a backend fallback (services/project_service.py), auto-created
      // whenever a chat happens without an explicit project — not a real project
      // the user created, so it shouldn't be browsable as if it were one. Its
      // conversations still show up in Chats regardless.
      items: projects.filter((p) => p.name !== "Default").map((p) => ({
        id: p.id,
        label: p.name,
        icon: FolderKanban,
        defaultExpanded: p.id === activeProjectId,
        children: conversations.filter((c) => c.project_id === p.id).map(toChatItem),
        actions: [{ icon: Plus, label: "New chat in project", onClick: () => handleNewChatInProject(p.id) }],
      })),
      actions: [{ icon: Plus, label: "New project", onClick: () => setProjectSwitcherOpen(true) }],
    },
    // Only rendered while at least one chat is pinned — disappears entirely
    // once the last pin is removed, rather than showing an empty section.
    ...(pinnedConversations.length > 0
      ? [
          {
            id: "pinned",
            title: "Pinned",
            items: pinnedConversations.map(toChatItem),
          },
        ]
      : []),
    {
      id: "chats",
      title: "Chats",
      items: conversations.filter((c) => !c.pinned).map(toChatItem),
      emptyLabel: "No recent chats",
      actions: [{ icon: Plus, label: "New chat", onClick: handleNewChat }],
    },
  ];

  const sidebarLogo = <Avatar variant="content" src="/aria-logo.png" alt="ARIA" size="m" shape="rounded" />;

  // Global shortcuts for New Chat/Graph/Memory — Search stays visual-only
  // until it's actually implemented. Surfaced only via the collapsed
  // sidebar's tooltips, not as permanent inline text. Note: ⌘N/⌘M may be
  // intercepted by the OS/browser before reaching page JS on some platforms
  // (Mac reserves Cmd+N for a new browser window, Cmd+M to minimize).
  useEffect(() => {
    const handler = (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      switch (e.key.toLowerCase()) {
        case "n":
          e.preventDefault();
          setView("chat");
          handleNewChat();
          break;
        case "g":
          e.preventDefault();
          setView((v) => (v === "graph" ? "chat" : "graph"));
          break;
        case "m":
          e.preventDefault();
          setMemoryOpen((v) => !v);
          setSettingsOpen(false);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Search doesn't exist yet — the item is a placeholder for future
  // functionality. Graph/Memory moved here from the app header.
  const sidebarNavItems = [
    { id: "new-chat", label: "New Chat", icon: SquarePen, shortcut: "⌘N", onClick: () => { setView("chat"); handleNewChat(); } },
    { id: "search", label: "Search Chats", icon: Search, shortcut: "⌘K", onClick: () => {} },
    {
      id: "graph",
      label: "Graph",
      icon: Share2,
      shortcut: "⌘G",
      active: view === "graph",
      onClick: () => setView((v) => (v === "graph" ? "chat" : "graph")),
    },
    {
      id: "memory",
      label: "Memory",
      icon: Brain,
      shortcut: "⌘M",
      active: memoryOpen,
      onClick: () => { setMemoryOpen((v) => !v); setSettingsOpen(false); },
    },
  ];

  return (
    <div className="relative flex h-screen bg-background text-foreground">
      <Sidebar
        logo={sidebarLogo}
        navItems={sidebarNavItems}
        sections={sidebarSections}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-3 bg-sidebar px-5 py-3.5">
          <div className="ml-auto flex items-center gap-2">
            <Tooltip label={darkMode ? "Switch to light mode" : "Switch to dark mode"} side="bottom">
              <Button
                variant="clean"
                icon={darkMode ? Sun : Moon}
                onClick={() => setDarkMode((v) => !v)}
              />
            </Tooltip>
            <Tooltip label="Settings" side="bottom">
              <Button
                variant={settingsOpen ? "secondary" : "clean"}
                icon={Settings}
                onClick={() => { setSettingsOpen((v) => !v); setMemoryOpen(false); }}
              />
            </Tooltip>
          </div>
        </header>

        <main className="flex flex-1 flex-col overflow-hidden bg-sidebar">
          {view === "graph" ? (
            <Suspense fallback={
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Loading 3D graph…
              </div>
            }>
              <GraphView active={view === "graph"} projectId={activeProjectId} onJumpToMemory={handleJumpToMemory} />
            </Suspense>
          ) : messages.length === 0 && !loading ? (
            <div className="flex flex-1 flex-col px-6 py-8 md:justify-center">
              <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 md:flex-none md:-translate-y-10">
                <div className="flex flex-1 -translate-y-6 flex-col items-center justify-center md:flex-none md:translate-y-0">
                  <p className="font-sidebar text-center text-xl font-normal text-black sm:text-2xl md:text-3xl dark:text-white">
                    {greeting}
                  </p>
                </div>
                <div className="space-y-3 pb-4 md:pb-0">
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <InputBar
                    onSend={handleSend}
                    disabled={loading}
                    routingMode={routingMode}
                    manualModel={manualModel}
                    onManualModelChange={setManualModel}
                    modelOptions={modelOptions}
                  />
                </div>
              </div>
            </div>
          ) : (
            <>
              <MessageList
                messages={messages}
                loading={loading}
                onJumpToMemory={handleJumpToMemory}
                onRetryMessage={handleRetryMessage}
                onEditMessage={handleEditMessage}
                modelOptions={modelOptions}
              />
              {error && (
                <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
                  <Alert variant="destructive" className="mb-2">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                </div>
              )}
              <div className="px-4 pt-2 pb-4 sm:px-6">
                <div className="mx-auto w-full max-w-3xl">
                  <InputBar
                    onSend={handleSend}
                    disabled={loading}
                    routingMode={routingMode}
                    manualModel={manualModel}
                    onManualModelChange={setManualModel}
                    modelOptions={modelOptions}
                    isFollowUp={messages.length > 0}
                    prefillText={editDraft?.text}
                    prefillKey={editDraft?.key}
                  />
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      <MemoryBrowser
        open={memoryOpen}
        onOpenChange={setMemoryOpen}
        projectId={activeProjectId}
        jumpTo={memoryJumpTo}
      />
      <RouterSettings
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        routingMode={routingMode}
        onModeChange={handleModeChange}
        onConfigChanged={refreshRouterConfig}
      />
      {routerConfig && !routerConfig.default_provider && (
        <FirstRunSetup providers={routerConfig.providers} onConnected={refreshRouterConfig} />
      )}
      <ProjectSwitcher
        open={projectSwitcherOpen}
        onOpenChange={setProjectSwitcherOpen}
        projects={projects}
        activeProjectId={activeProjectId}
        onSelect={handleProjectSelect}
        onProjectsChange={refreshProjects}
      />
    </div>
  );
}
