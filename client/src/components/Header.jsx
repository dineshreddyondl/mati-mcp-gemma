/**
 * Header.jsx — top bar with ONDL logo, mode switcher, model badge, dark toggle.
 */
const MODES = [
  {
    id: "internal",
    label: "Internal data",
    color: "#1d4ed8",
    darkColor: "#60a5fa",
    bgColor: "#eff6ff",
    darkBgColor: "#1e3a5f",
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="2" width="5" height="5" rx="1" fill="currentColor" opacity=".9"/>
        <rect x="9" y="2" width="5" height="5" rx="1" fill="currentColor"/>
        <rect x="2" y="9" width="5" height="5" rx="1" fill="currentColor" opacity=".4"/>
        <rect x="9" y="9" width="5" height="5" rx="1" fill="currentColor" opacity=".7"/>
      </svg>
    ),
  },
  {
    id: "general",
    label: "General",
    color: "#16a34a",
    darkColor: "#4ade80",
    bgColor: "#f0fdf4",
    darkBgColor: "#052e16",
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
        <circle cx="8" cy="8" r="2" fill="currentColor" opacity=".5"/>
        <path d="M8 2.5v1M8 12.5v1M2.5 8h1M12.5 8h1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "document",
    label: "Document",
    color: "#d97706",
    darkColor: "#fbbf24",
    bgColor: "#fffbeb",
    darkBgColor: "#1c1400",
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <rect x="3" y="1" width="10" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export default function Header({ mode, onModeChange, dark, onToggleDark, model }) {
  const activeMode = MODES.find((m) => m.id === mode) || MODES[0];
  const modeColor = dark ? activeMode.darkColor : activeMode.color;

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 16px", height: 54,
      background: dark ? "#1e293b" : "#ffffff",
      borderBottom: `0.5px solid ${dark ? "#334155" : "#e2e8f0"}`,
      gap: 12, flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <img src="/ondl-logo.svg" alt="ONDL" style={{ height: 20, filter: dark ? "brightness(0) invert(1)" : "none" }} />
        <span style={{
          fontSize: 13, fontWeight: 600, color: dark ? "#94a3b8" : "#64748b",
          borderLeft: `1px solid ${dark ? "#334155" : "#e2e8f0"}`,
          paddingLeft: 10, letterSpacing: "0.01em"
        }}>Mati</span>
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          fontSize: 11, background: dark ? "#052e16" : "#f0fdf4",
          color: dark ? "#4ade80" : "#166534",
          border: `0.5px solid ${dark ? "#166534" : "#bbf7d0"}`,
          borderRadius: 20, padding: "3px 9px",
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%", background: "#16a34a",
            animation: "pulse 2s ease-in-out infinite",
          }} />
          Mac Mini
        </div>
      </div>

      {/* Mode switcher */}
      <div style={{
        display: "flex", gap: 3,
        background: dark ? "#0f172a" : "#f1f5f9",
        borderRadius: 10, padding: 3, flexShrink: 0,
      }}>
        {MODES.map((m) => {
          const isActive = m.id === mode;
          const color = dark ? m.darkColor : m.color;
          return (
            <button key={m.id} onClick={() => onModeChange(m.id)} style={{
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 12, padding: "6px 14px", borderRadius: 7,
              border: isActive ? `0.5px solid ${dark ? "#334155" : "#e2e8f0"}` : "none",
              background: isActive ? (dark ? "#1e293b" : "#ffffff") : "transparent",
              color: isActive ? color : (dark ? "#94a3b8" : "#64748b"),
              fontWeight: isActive ? 500 : 400,
              cursor: "pointer", whiteSpace: "nowrap",
            }}>
              {m.icon}
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Right side */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <div style={{
          fontSize: 11, color: dark ? "#c4b5fd" : "#7c3aed",
          background: dark ? "#2e1065" : "#f5f3ff",
          border: `0.5px solid ${dark ? "#4c1d95" : "#ddd6fe"}`,
          borderRadius: 6, padding: "3px 9px",
          display: "flex", alignItems: "center", gap: 5,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: dark ? "#c4b5fd" : "#7c3aed" }} />
          {model || "Gemma 3 8B"}
        </div>
        <button onClick={onToggleDark} style={{
          background: "none",
          border: `0.5px solid ${dark ? "#334155" : "#e2e8f0"}`,
          borderRadius: 6, padding: "5px 10px",
          cursor: "pointer", fontSize: 12,
          color: dark ? "#94a3b8" : "#64748b",
        }}>
          {dark ? "Light" : "Dark"}
        </button>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );
}

export { MODES };
