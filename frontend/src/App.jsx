import { useState, useEffect, lazy, Suspense } from "react";
import StatusBar from "./components/StatusBar";
import Sidebar from "./components/Sidebar";
import MessageList from "./components/MessageList";
import InputBar from "./components/InputBar";
import MemoryBrowser from "./components/MemoryBrowser";
import RouterSettings from "./components/RouterSettings";
import ProjectSwitcher from "./components/ProjectSwitcher";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Moon, Sun, Brain, Settings, FolderKanban, Share2 } from "lucide-react";
import { sendMessage, fetchMessages, uploadFile, fetchProjects } from "./services/api";

const GraphView = lazy(() => import("./components/GraphView"));

export default function App() {
  const [view, setView] = useState("chat"); // "chat" | "graph"
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [memoryJumpTo, setMemoryJumpTo] = useState(null);

  const handleJumpToMemory = (node) => {
    setMemoryJumpTo({ type: node.type, ref: node.metadata?.ref_id });
    setSettingsOpen(false);
    setMemoryOpen(true);
  };

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  // Projects — active project persisted to localStorage
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(
    () => localStorage.getItem("aria-active-project") || null
  );
  const [projectSwitcherOpen, setProjectSwitcherOpen] = useState(false);

  const refreshProjects = async () => {
    const list = await fetchProjects();
    setProjects(list);
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

  // Routing state — persisted to localStorage
  const [routingMode, setRoutingMode] = useState(
    () => localStorage.getItem("aria-routing-mode") || "auto"
  );
  const [conversationTier, setConversationTier] = useState(1);
  const [pendingRouting, setPendingRouting] = useState(null);

  // Tools state — persisted to localStorage
  const [toolsEnabled, setToolsEnabled] = useState(
    () => JSON.parse(localStorage.getItem("aria-tools-enabled") || "[]")
  );

  useEffect(() => {
    localStorage.setItem("aria-routing-mode", routingMode);
  }, [routingMode]);

  useEffect(() => {
    localStorage.setItem("aria-tools-enabled", JSON.stringify(toolsEnabled));
  }, [toolsEnabled]);

  const handleToolToggle = (toolName, enabled) => {
    setToolsEnabled((prev) =>
      enabled ? [...prev.filter((t) => t !== toolName), toolName] : prev.filter((t) => t !== toolName)
    );
  };

  const handleModeChange = (mode) => setRoutingMode(mode);

  const loadConversation = async (id) => {
    setView("chat");
    setConversationId(id);
    setError(null);
    setConversationTier(1);
    setPendingRouting(null);
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
    setConversationTier(1);
    setPendingRouting(null);
  };

  // Core send — called both on first send and after routing confirmation
  const _doSend = async (text, fileContent, fileName, truncated, overrideTier, existingConvoId) => {
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
    };
    setMessages((prev) => [...prev, optimistic]);
    setLoading(true);
    setError(null);

    try {
      const reqMode = overrideTier != null ? "manual" : routingMode;
      const reqTier = overrideTier != null ? overrideTier : (routingMode === "manual" ? conversationTier : undefined);

      const data = await sendMessage(text, targetConvoId, fileContent, fileName, reqMode, reqTier, toolsEnabled, activeProjectId);

      if (!conversationId) setConversationId(data.conversation_id);

      if (data.permission_required) {
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== optimisticId),
          { ...optimistic, id: `user-${data.message_id}` },
          { id: `routing-${data.message_id}`, role: "routing", ...data },
        ]);
        setPendingRouting({
          text,
          fileContent,
          fileName,
          truncated: truncated || false,
          conversationId: data.conversation_id,
          suggestedTier: data.suggested_tier,
          suggestedModel: data.suggested_model,
          signals: data.signals,
          routingMsgId: data.message_id,
        });
        return;
      }

      // Normal success
      if (data.tier) setConversationTier(data.tier);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticId),
        { ...optimistic, id: `user-${data.message_id}` },
        {
          id: data.message_id,
          role: "assistant",
          content: data.reply,
          tier: data.tier,
          model: data.model,
          signals: data.signals,
          tools_used: data.tools_used || [],
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
    let fileContent = null, fileName = null, truncated = false;
    if (file) {
      try {
        const uploaded = await uploadFile(file);
        fileContent = uploaded.text;
        fileName = uploaded.filename;
        truncated = uploaded.truncated;
      } catch (err) {
        setError(`File upload failed: ${err.message}`);
        return;
      }
    }
    await _doSend(text, fileContent, fileName, truncated, null, null);
  };

  const handleRoutingDecision = async (routingMsgId, confirmed) => {
    if (!pendingRouting) return;
    const { text, fileContent, fileName, truncated, conversationId: pendingConvoId, suggestedTier } = pendingRouting;

    setMessages((prev) => prev.filter((m) => m.id !== `routing-${routingMsgId}`));
    setPendingRouting(null);

    const overrideTier = confirmed ? suggestedTier : 1;
    if (confirmed) setConversationTier(suggestedTier);

    await _doSend(text, fileContent, fileName, truncated, overrideTier, pendingConvoId);
  };

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center gap-3 border-b border-border bg-card px-5 py-3.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-extrabold text-primary-foreground">
          A
        </div>
        <span className="text-lg font-bold tracking-wide">ARIA</span>
        <span className="ml-1 text-xs text-muted-foreground">
          Adaptive Reasoning Intelligence Assistant
        </span>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => setDarkMode((v) => !v)}>
            {darkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {darkMode ? "Light" : "Dark"}
          </Button>
          <Button variant="outline" onClick={() => setProjectSwitcherOpen(true)}>
            <FolderKanban className="size-4" />
            {projects.find((p) => p.id === activeProjectId)?.name || "Projects"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setView((v) => (v === "graph" ? "chat" : "graph"))}
            className={view === "graph" ? "border-primary bg-primary/10 text-primary" : ""}
          >
            <Share2 className="size-4" /> Graph
          </Button>
          <Button
            variant="outline"
            onClick={() => { setMemoryOpen((v) => !v); setSettingsOpen(false); }}
            className={memoryOpen ? "border-primary bg-primary/10 text-primary" : ""}
          >
            <Brain className="size-4" /> Memory
          </Button>
          <Button
            variant="outline"
            onClick={() => { setSettingsOpen((v) => !v); setMemoryOpen(false); }}
            className={settingsOpen ? "border-primary bg-primary/10 text-primary" : ""}
          >
            <Settings className="size-4" /> Settings
          </Button>
        </div>
      </header>

      <StatusBar />

      <div className="relative flex flex-1 overflow-hidden">
        <Sidebar
          activeId={conversationId}
          projectId={activeProjectId}
          onSelect={loadConversation}
          onNew={() => { setView("chat"); handleNewChat(); }}
        />

        <main className="flex flex-1 flex-col overflow-hidden">
          {view === "graph" ? (
            <Suspense fallback={
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Loading 3D graph…
              </div>
            }>
              <GraphView active={view === "graph"} projectId={activeProjectId} onJumpToMemory={handleJumpToMemory} />
            </Suspense>
          ) : (
            <>
              <MessageList
                messages={messages}
                loading={loading}
                onRoutingDecision={handleRoutingDecision}
              />
              {error && (
                <Alert variant="destructive" className="mx-5 mb-2">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <InputBar
                onSend={handleSend}
                disabled={loading}
                routingMode={routingMode}
                conversationTier={conversationTier}
                onTierChange={setConversationTier}
                toolsEnabled={toolsEnabled}
              />
            </>
          )}
        </main>

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
          toolsEnabled={toolsEnabled}
          onToolToggle={handleToolToggle}
        />
        <ProjectSwitcher
          open={projectSwitcherOpen}
          onOpenChange={setProjectSwitcherOpen}
          projects={projects}
          activeProjectId={activeProjectId}
          onSelect={handleProjectSelect}
          onProjectsChange={refreshProjects}
        />
      </div>
    </div>
  );
}
