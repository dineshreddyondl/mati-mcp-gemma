/**
 * Sidebar.jsx — named conversations list with mode color pips.
 */
const MODE_COLORS = {
  internal: "#1d4ed8",
  general: "#16a34a",
  document: "#d97706",
};

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M13 4l-1 9a1 1 0 01-1 1H5a1 1 0 01-1-1L3 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function Sidebar({ grouped, activeId, onSelect, onNew, onDelete, dark }) {
  const bg = dark ? "#1e293b" : "#ffffff";
  const border = dark ? "#334155" : "#e2e8f0";
  const text = dark ? "#f1f5f9" : "#0f172a";
  const muted = dark ? "#94a3b8" : "#64748b";
  const hover = dark ? "#0f172a" : "#f1f5f9";
  const activeBg = dark ? "#1e3a5f" : "#eff6ff";

  return (
    <div style={{
      width: 224, background: bg,
      borderRight: `0.5px solid ${border}`,
      display: "flex", flexDirection: "column",
      flexShrink: 0, overflow: "hidden",
    }}>
      <div style={{ padding: 10, borderBottom: `0.5px solid ${border}` }}>
        <button onClick={onNew} style={{
          width: "100%", padding: "8px 12px",
          borderRadius: 8, border: `0.5px solid ${border}`,
          background: dark ? "#0f172a" : "#f8fafc",
          cursor: "pointer", fontSize: 13,
          color: dark ? "#60a5fa" : "#1d4ed8",
          fontWeight: 500, display: "flex",
          alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          New chat
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {grouped.length === 0 && (
          <div style={{ padding: "24px 16px", fontSize: 13, color: muted, textAlign: "center" }}>
            No conversations yet
          </div>
        )}
        {grouped.map(([label, items]) => (
          <div key={label}>
            <div style={{
              padding: "10px 12px 4px",
              fontSize: 10, color: muted,
              fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em",
            }}>{label}</div>
            {items.map((conv) => (
              <div
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                style={{
                  padding: "8px 10px", cursor: "pointer",
                  borderRadius: 7, margin: "1px 6px",
                  background: conv.id === activeId ? activeBg : "transparent",
                  display: "flex", alignItems: "flex-start",
                  justifyContent: "space-between", gap: 6,
                }}
                onMouseEnter={(e) => { if (conv.id !== activeId) e.currentTarget.style.background = hover; }}
                onMouseLeave={(e) => { if (conv.id !== activeId) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, color: text,
                    whiteSpace: "nowrap", overflow: "hidden",
                    textOverflow: "ellipsis", marginBottom: 3,
                  }}>{conv.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: muted }}>
                    <span style={{
                      width: 5, height: 5, borderRadius: "50%",
                      background: MODE_COLORS[conv.mode] || "#94a3b8",
                      display: "inline-block", flexShrink: 0,
                    }} />
                    {conv.mode === "internal" ? "Internal" : conv.mode === "general" ? "General" : "Document"}
                    {" · "}
                    {formatAge(conv.updatedAt)}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: muted, padding: 2, borderRadius: 4,
                    opacity: 0, transition: "opacity 0.15s",
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = "0"; }}
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatAge(ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
