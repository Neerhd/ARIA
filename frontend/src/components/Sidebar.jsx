import { useEffect, useState } from "react";
import { fetchConversations } from "../services/api";

export default function Sidebar({ activeId, onSelect, onNew }) {
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    fetchConversations().then(setConversations).catch(() => {});
  }, [activeId]);

  return (
    <aside style={{
      width: 240, background: "#13131e", borderRight: "1px solid #2a2a3a",
      display: "flex", flexDirection: "column", overflowY: "auto",
    }}>
      <div style={{ padding: "16px 12px 8px" }}>
        <button onClick={onNew} style={{
          width: "100%", padding: "8px 12px", background: "#7c3aed",
          color: "#fff", border: "none", borderRadius: 8, cursor: "pointer",
          fontSize: 13, fontWeight: 600,
        }}>
          + New Chat
        </button>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {conversations.map((c) => (
          <div key={c.id} onClick={() => onSelect(c.id)} style={{
            padding: "10px 14px", cursor: "pointer", fontSize: 13,
            background: c.id === activeId ? "#1e1e2e" : "transparent",
            color: c.id === activeId ? "#e2e8f0" : "#94a3b8",
            borderLeft: c.id === activeId ? "3px solid #7c3aed" : "3px solid transparent",
          }}>
            {c.title || "Untitled"}
          </div>
        ))}
      </div>
    </aside>
  );
}
