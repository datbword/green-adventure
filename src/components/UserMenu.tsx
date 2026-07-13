import { useState, useRef, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import type { UserSession } from "~/utils/auth";

interface UserMenuProps {
  user: UserSession;
  onSignOut: () => void;
}

export function UserMenu({ user, onSignOut }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const dropdownStyle: React.CSSProperties = {
    position: "absolute",
    top: "100%",
    right: 0,
    marginTop: "6px",
    minWidth: "180px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    borderRadius: "10px",
    padding: "6px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
    zIndex: 200,
  };

  const itemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    width: "100%",
    padding: "10px 12px",
    borderRadius: "8px",
    fontSize: "14px",
    color: "var(--text-primary)",
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    textDecoration: "none",
    minHeight: "44px",
  };

  return (
    <div ref={ref} className="relative" style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        className="mode-toggle-btn"
        title="Account menu"
        aria-label="Account menu"
        aria-expanded={open}
      >
        <span className="text-base">👤</span>
      </button>

      {open && (
        <div style={dropdownStyle}>
          <div
            className="truncate px-3 py-2 text-xs border-b"
            style={{ color: "var(--text-muted)", borderColor: "var(--border-color)" }}
          >
            {user.name}
            <br />
            <span className="opacity-60">{user.email}</span>
          </div>

          <Link
            to="/jobs"
            onClick={() => setOpen(false)}
            style={itemStyle}
            className="hover:brightness-110"
          >
            <span>📋</span> My Jobs
          </Link>

          <Link
            to="/pricing"
            onClick={() => setOpen(false)}
            style={itemStyle}
            className="hover:brightness-110"
          >
            <span>$</span> Pricing & Account
          </Link>

          <hr style={{ borderColor: "var(--border-color)", margin: "4px 0" }} />

          <button
            onClick={() => { setOpen(false); onSignOut(); }}
            style={{ ...itemStyle, color: "#d32f2f" }}
            className="hover:brightness-110"
          >
            <span>🚪</span> Sign Out
          </button>
        </div>
      )}
    </div>
  );
}