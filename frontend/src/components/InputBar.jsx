import { useState, useRef } from "react";

const ACCEPTED = ".txt,.md,.pdf,.py,.js,.ts,.jsx,.tsx,.json,.csv,.html,.xml,.yaml,.yml,.sh,.sql,.toml,.rb,.go,.java,.c,.cpp,.h,.rs,.swift,.kt";

export default function InputBar({ onSend, disabled }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const fileRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (disabled) return;
    if (!text.trim() && !file) return;
    onSend(text, file);
    setText("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) handleSubmit(e);
  };

  const handleFileChange = (e) => {
    const picked = e.target.files?.[0];
    if (picked) setFile(picked);
  };

  const removeFile = () => {
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const canSend = !disabled && (text.trim() || file);

  return (
    <div style={{ borderTop: "1px solid #2a2a3a", background: "#13131e" }}>
      {/* File attachment chip */}
      {file && (
        <div style={{ padding: "6px 20px 0", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "#1e1e2e", border: "1px solid #7c3aed",
            borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "#a78bfa",
          }}>
            <span>📎</span>
            <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {file.name}
            </span>
            <button
              type="button"
              onClick={removeFile}
              style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 0, lineHeight: 1, fontSize: 14 }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ padding: "10px 20px 12px", display: "flex", gap: 8, alignItems: "flex-end" }}>
        {/* Hidden file input */}
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED}
          onChange={handleFileChange}
          style={{ display: "none" }}
        />

        {/* Paperclip button */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          title="Attach a file"
          style={{
            padding: "9px 10px", background: "none", border: "1px solid #2a2a3a",
            borderRadius: 10, cursor: disabled ? "default" : "pointer",
            color: file ? "#7c3aed" : "#6b7280", fontSize: 16, lineHeight: 1,
            flexShrink: 0,
          }}
        >
          📎
        </button>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={file ? "Add a question about the file, or send as-is…" : "Message ARIA… (Enter to send, Shift+Enter for new line)"}
          disabled={disabled}
          rows={1}
          style={{
            flex: 1, background: "#1e1e2e", border: "1px solid #2a2a3a",
            borderRadius: 10, padding: "10px 14px", color: "#e2e8f0",
            fontSize: 14, resize: "none", outline: "none",
            fontFamily: "inherit", lineHeight: 1.5,
          }}
        />

        <button
          type="submit"
          disabled={!canSend}
          style={{
            padding: "10px 20px",
            background: canSend ? "#7c3aed" : "#4a4a6a",
            color: "#fff", border: "none", borderRadius: 10,
            cursor: canSend ? "pointer" : "default",
            fontSize: 14, fontWeight: 600, flexShrink: 0,
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
