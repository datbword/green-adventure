import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { useAuth } from "~/hooks/useAuth";
import { AuthModal } from "~/components/AuthModal";
import { UserMenu } from "~/components/UserMenu";
import { HANDING_TYPES, renderHandingDiagram, type HandingInfo } from "~/utils/door-handing";

export const Route = createFileRoute("/handing")({
  component: HandingPage,
});


function HandingPage() {

  const { user, showAuth, setShowAuth, clearSession } = useAuth();
  const [selected, setSelected] = useState<HandingInfo>(HANDING_TYPES[0]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-8">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between sm:mb-8">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 no-underline">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg text-lg font-bold text-white shadow-sm"
              style={{ backgroundColor: mode === "high-contrast" ? "#000000" : mode === "dark" ? "#1F1F1F" : mode === "calm" ? "#6B6B6B" : "#1B2A4A" }}>
              LB
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl" style={{ color: "var(--text-primary)" }}>LockBuilder</h1>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Door Handing Reference</p>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link to="/" className="mode-toggle-btn" title="Part Number Builder" aria-label="Part Number Builder">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: "var(--text-secondary)" }}>
              <rect x="2" y="7" width="14" height="4" rx="1.5" fill="currentColor" opacity="0.4"/>
              <path d="M13 5C13 5 15 5 15 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              <path d="M13 5L11.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
            </svg>
          </Link>
          <Link to="/functions" className="mode-toggle-btn" title="Lock Functions" aria-label="Lock Functions">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: "var(--text-secondary)" }}>
              <rect x="2" y="7" width="14" height="4" rx="1.5" fill="currentColor" opacity="0.4"/>
              <path d="M13 5C13 5 15 5 15 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              <path d="M13 5L11.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
            </svg>
          </Link>
          {user ? (
            <div className="flex items-center gap-1 sm:gap-2">
              <Link to="/jobs" className="mode-toggle-btn" title="My Jobs" aria-label="My Jobs">
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>&#9776;</span>
              </Link>
              <UserMenu user={user} onSignOut={clearSession} />
            </div>
          ) : (
            <button onClick={() => setShowAuth(true)}
              className="mode-toggle-btn" title="Sign in" aria-label="Sign in">
              <span className="text-xs font-semibold tracking-widest" style={{ color: "var(--text-secondary)" }}>LOGIN</span>
            </button>
          )}
        </div>
      </header>

      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
        <Link to="/" style={{ color: "var(--accent)", textDecoration: "none" }}>Builder</Link>
        <span>/</span>
        <span>Door Handing</span>
      </div>

      {/* Handing selector — dropdown */}
      <div className="mb-6">
        <label className="mb-2 block text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
          Select Handing Type
        </label>
        <div className="flex flex-wrap gap-2">
          {HANDING_TYPES.map((h) => (
            <button
              key={h.code}
              onClick={() => setSelected(h)}
              className="rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
              style={{
                backgroundColor: selected.code === h.code
                  ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                  : "var(--bg-secondary)",
                color: "var(--text-primary)",
                border: selected.code === h.code
                  ? "2px solid color-mix(in srgb, var(--accent) 40%, transparent)"
                  : "2px solid var(--border-color)",
                cursor: "pointer",
                minHeight: "44px",
              }}
            >
              <span className="font-mono font-bold" style={{ color: "var(--brass)" }}>{h.code}</span>
              {" "}{h.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="space-y-6">
        {/* SVG Diagram */}
        <div className="rounded-xl border p-4 sm:p-6" style={{
          backgroundColor: "var(--bg-primary)",
          borderColor: "var(--border-color)",
        }}>
          <div className="mx-auto max-w-lg" dangerouslySetInnerHTML={{ __html: renderHandingDiagram(selected) }} />
        </div>

        {/* Description */}
        <div className="rounded-xl border p-4 sm:p-6" style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--border-color)",
        }}>
          <h3 className="mb-2 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>Description</h3>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
            {selected.description}
          </p>
        </div>

        {/* Common Uses */}
        <div className="rounded-xl border p-4 sm:p-6" style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--border-color)",
        }}>
          <h3 className="mb-2 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>Common Uses</h3>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
            {selected.common}
          </p>
        </div>

        {/* Quick Reference Table */}
        <div className="rounded-xl border p-4 sm:p-6" style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--border-color)",
        }}>
          <h3 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>All Handing Types</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="pb-2 pr-4 font-semibold" style={{ color: "var(--text-primary)" }}>Code</th>
                  <th className="pb-2 pr-4 font-semibold" style={{ color: "var(--text-primary)" }}>Name</th>
                  <th className="pb-2 pr-4 font-semibold" style={{ color: "var(--text-primary)" }}>Hinges</th>
                  <th className="pb-2 font-semibold" style={{ color: "var(--text-primary)" }}>Swing</th>
                </tr>
              </thead>
              <tbody>
                {HANDING_TYPES.map((h) => (
                  <tr key={h.code} className="cursor-pointer" onClick={() => setSelected(h)}
                    style={{ backgroundColor: selected.code === h.code ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent" }}>
                    <td className="py-2 pr-4 font-mono font-bold" style={{ color: "var(--brass)" }}>{h.code}</td>
                    <td className="py-2 pr-4" style={{ color: "var(--text-primary)" }}>{h.name}</td>
                    <td className="py-2 pr-4" style={{ color: "var(--text-primary)" }}>Hinges on {h.hinges === "left" ? "Left" : "Right"}</td>
                    <td className="py-2" style={{ color: "var(--text-primary)" }}>Swing {h.swing === "push" ? "Away (Push)" : "Toward (Pull)"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* How to determine handing */}
        <div className="rounded-xl border p-4 sm:p-6" style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--border-color)",
        }}>
          <h3 className="mb-2 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>How to Determine Handing</h3>
          <ol className="ml-4 list-decimal space-y-2 text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
            <li><strong>Stand outside</strong> the door (the side you enter from first — the key side).</li>
            <li>Look at which side the <strong>hinges</strong> are on: left or right.</li>
            <li>Check if the door <strong>pushes away</strong> from you (into the room) or <strong>pulls toward</strong> you (out of the room).</li>
            <li><strong>Push away</strong> = Standard Hand (LH or RH). <strong>Pull toward</strong> = Reverse Hand (LHR or RHR).</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

export default HandingPage;