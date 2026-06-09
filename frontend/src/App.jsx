import { useState } from "react";
import StatusBar from "./components/StatusBar";
import Sidebar from "./components/Sidebar";
import MessageList from "./components/MessageList";
import InputBar from "./components/InputBar";
import MemoryBrowser from "./components/MemoryBrowser";
import { sendMessage, fetchMessages, uploadFile } from "./services/api";

export default function App() {
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [memoryOpen, setMemoryOpen] = useState(false);

  const loadConversation = async (id) => {
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
  };

  const handleSend = async (text, file) => {
    setLoading(true);
    setError(null);

    let fileContent = null;
    let fileName = null;
    let truncated = false;

    // Upload file first if attached
    if (file) {
      try {
        const uploaded = await uploadFile(file);
        fileContent = uploaded.text;
        fileName = uploaded.filename;
        truncated = uploaded.truncated;
      } catch (err) {
        setError(`File upload failed: ${err.message}`);
        setLoading(false);
        return;
      }
    }

    const displayText = text.trim() || (fileName ? `Please read and summarise this file for me.` : "");
    const optimistic = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: displayText,
      file_name: fileName,
      truncated,
      conversation_id: conversationId,
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const data = await sendMessage(text, conversationId, fileContent, fileName);
      if (!conversationId) setConversationId(data.conversation_id);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimistic.id),
        { ...optimistic, id: `user-${data.message_id}` },
        { id: data.message_id, role: "assistant", content: data.reply, conversation_id: data.conversation_id },
      ]);
    } catch (err) {
      setError(err.message);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      background: "#0f0f14", color: "#e2e8f0", fontFamily:
        "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
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
        <button
          onClick={() => setMemoryOpen((v) => !v)}
          style={{
            marginLeft: "auto", padding: "6px 14px", background: memoryOpen ? "#7c3aed22" : "none",
            border: `1px solid ${memoryOpen ? "#7c3aed" : "#2a2a3a"}`,
            borderRadius: 8, cursor: "pointer", fontSize: 13,
            color: memoryOpen ? "#a78bfa" : "#6b7280",
          }}
        >
          🧠 Memory
        </button>
      </header>

      <StatusBar />

      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        <Sidebar activeId={conversationId} onSelect={loadConversation} onNew={handleNewChat} />

        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <MessageList messages={messages} loading={loading} />
          {error && (
            <div style={{
              margin: "0 20px 8px", padding: "10px 14px", background: "#2d1b1b",
              borderRadius: 8, color: "#f87171", fontSize: 13,
            }}>
              {error}
            </div>
          )}
          <InputBar onSend={handleSend} disabled={loading} />
        </main>

        {memoryOpen && <MemoryBrowser onClose={() => setMemoryOpen(false)} />}
      </div>
    </div>
  );
}
