/**
 * Header.jsx — Su-Mati top bar
 * Left: ONDL logo | Su-Mati + Mac Mini status | Powered by Google Gemma
 * Right: mode switcher (radio style) + dark/light icon toggle
 */

const MODES = [
  {
    id: "internal",
    label: "ONDL Order reporting",
    icon: (<svg width="11" height="11" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="5" height="5" rx="1" fill="currentColor"/><rect x="9" y="2" width="5" height="5" rx="1" fill="currentColor" opacity=".6"/><rect x="2" y="9" width="5" height="5" rx="1" fill="currentColor" opacity=".3"/><rect x="9" y="9" width="5" height="5" rx="1" fill="currentColor" opacity=".6"/></svg>),
    active: { bg: "#eff6ff", border: "#1d4ed8", color: "#1d4ed8" },
    activeDark: { bg: "#1e3a5f", border: "#3b82f6", color: "#60a5fa" },
  },
  {
    id: "general",
    label: "General context",
    icon: (<svg width="11" height="11" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3"/><circle cx="8" cy="8" r="2" fill="currentColor" opacity=".5"/></svg>),
    active: { bg: "#f0fdf4", border: "#16a34a", color: "#16a34a" },
    activeDark: { bg: "#052e16", border: "#22c55e", color: "#4ade80" },
  },
  {
    id: "document",
    label: "Document analysis",
    icon: (<svg width="11" height="11" viewBox="0 0 16 16" fill="none"><rect x="3" y="1" width="10" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>),
    active: { bg: "#fffbeb", border: "#d97706", color: "#d97706" },
    activeDark: { bg: "#1c1400", border: "#f59e0b", color: "#fbbf24" },
  },
];

export default function Header({ mode, onModeChange, dark, onToggleDark, macOnline }) {
  const border = dark ? "#30363d" : "#e5e7eb";
  const bg = dark ? "#161b22" : "#ffffff";
  const muted = dark ? "#8b949e" : "#6b7280";

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 20px", height: 60, background: bg,
      borderBottom: `0.5px solid ${border}`,
      gap: 16, flexShrink: 0,
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>

      {/* ── Left ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <img src="/ondl-logo.svg" alt="ONDL" style={{ height: 20, filter: dark ? "brightness(0) invert(1)" : "none" }} />
        <div style={{ width: 1, height: 22, background: border }} />

        {/* Su-Mati + Mac Mini status */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.3px", color: dark ? "#e6edf3" : "#111827", lineHeight: 1 }}>
            Su-Mati
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
              background: macOnline ? "#22c55e" : "#ef4444",
              animation: macOnline ? "pulse 2s infinite" : "none",
            }} />
            <span style={{ fontSize: 10, fontWeight: 500, color: macOnline ? "#16a34a" : "#ef4444" }}>
              {macOnline ? "Running on Mac Mini" : "Mac Mini offline"}
            </span>
          </div>
        </div>

        <div style={{ width: 1, height: 22, background: border }} />

        {/* Powered by Google Gemma */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ display: "flex", gap: 2 }}>
            {["#4285f4","#ea4335","#fbbc04","#34a853"].map((c, i) => (
              <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: c }} />
            ))}
          </div>
          <span style={{ fontSize: 11, color: muted }}>Powered by Google Gemma</span>
        </div>
      </div>

      {/* ── Right ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {/* Mode switcher */}
        <div style={{ display: "flex", gap: 5 }}>
          {MODES.map((m) => {
            const isActive = m.id === mode;
            const s = dark ? (isActive ? m.activeDark : null) : (isActive ? m.active : null);
            return (
              <button key={m.id} onClick={() => onModeChange(m.id)} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 14px", borderRadius: 100,
                border: `1.5px solid ${isActive ? (s?.border || border) : border}`,
                background: isActive ? (s?.bg || "transparent") : "transparent",
                color: isActive ? (s?.color || muted) : muted,
                fontSize: 12, fontWeight: isActive ? 600 : 500,
                cursor: "pointer", whiteSpace: "nowrap",
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  border: "1.5px solid currentColor",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  {isActive && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "currentColor" }} />}
                </div>
                {m.icon}
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Dark/light toggle */}
        <button onClick={onToggleDark} style={{
          width: 32, height: 32, borderRadius: "50%",
          border: `1px solid ${border}`, background: "none",
          cursor: "pointer", display: "flex", alignItems: "center",
          justifyContent: "center", color: muted, flexShrink: 0,
        }}>
          {dark ? (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 3V1M8 15v-2M3 8H1M15 8h-2M4.5 4.5L3 3M13 13l-1.5-1.5M11.5 4.5L13 3M3 13l1.5-1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M13 9A5 5 0 1 1 7 3a3.5 3.5 0 0 0 6 6z" fill="currentColor" opacity=".8"/></svg>
          )}
        </button>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );
}

export { MODES };
