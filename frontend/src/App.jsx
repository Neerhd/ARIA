import { useState, useEffect } from "react";
import StatusBar from "./components/StatusBar";
import Sidebar from "./components/Sidebar";
import MessageList from "./components/MessageList";
import InputBar from "./components/InputBar";
import MemoryBrowser from "./components/MemoryBrowser";
import RouterSettings from "./components/RouterSettings";
import { sendMessage, fetchMessages, uploadFile } from "./services/api";

export default function App() {
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

      const data = await sendMessage(text, targetConvoId, fileContent, fileName, reqMode, reqTier, toolsEnabled);

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

  const overlayOpen = memoryOpen || settingsOpen;

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      background: "#0f0f14", color: "#e2e8f0",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <header style={{
        padding: "14px 20px", background: "#13131e",
        borderBottom: "1px solid #2a2a3a", display: "flex", alignItems: "center", gap: 12,
      }}>
        <div style={{
          width: 32, height: 32, background: "linear-gradient(135deg,#7c3aed,#2563eb)",
          borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 800, fontSize: 14, color: "#fff",
        }}>A</div>
        <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: 1 }}>ARIA</span>
        <span style={{ color: "#4a5568", fontSize: 12, marginLeft: 4 }}>
          Adaptive Reasoning Intelligence Assistant
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            onClick={() => { setMemoryOpen((v) => !v); setSettingsOpen(false); }}
            style={{
              padding: "6px 14px", background: memoryOpen ? "#7c3aed22" : "none",
              border: `1px solid ${memoryOpen ? "#7c3aed" : "#2a2a3a"}`,
              borderRadius: 8, cursor: "pointer", fontSize: 13,
              color: memoryOpen ? "#a78bfa" : "#6b7280",
            }}
          >
            🧠 Memory
          </button>
          <button
            onClick={() => { setSettingsOpen((v) => !v); setMemoryOpen(false); }}
            style={{
              padding: "6px 14px", background: settingsOpen ? "#7c3aed22" : "none",
              border: `1px solid ${settingsOpen ? "#7c3aed" : "#2a2a3a"}`,
              borderRadius: 8, cursor: "pointer", fontSize: 13,
              color: settingsOpen ? "#a78bfa" : "#6b7280",
            }}
          >
            ⚙ Settings
          </button>
        </div>
      </header>

      <StatusBar />

      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        <Sidebar activeId={conversationId} onSelect={loadConversation} onNew={handleNewChat} />

        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <MessageList
            messages={messages}
            loading={loading}
            onRoutingDecision={handleRoutingDecision}
          />
          {error && (
            <div style={{
              margin: "0 20px 8px", padding: "10px 14px", background: "#2d1b1b",
              borderRadius: 8, color: "#f87171", fontSize: 13,
            }}>
              {error}
            </div>
          )}
          <InputBar
            onSend={handleSend}
            disabled={loading}
            routingMode={routingMode}
            conversationTier={conversationTier}
            onTierChange={setConversationTier}
            toolsEnabled={toolsEnabled}
          />
        </main>

        {memoryOpen && <MemoryBrowser onClose={() => setMemoryOpen(false)} />}
        {settingsOpen && (
          <RouterSettings
            routingMode={routingMode}
            onModeChange={handleModeChange}
            toolsEnabled={toolsEnabled}
            onToolToggle={handleToolToggle}
            onClose={() => setSettingsOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
