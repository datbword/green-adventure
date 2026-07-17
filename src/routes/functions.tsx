import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useVisualMode } from "~/hooks/useVisualMode";
import { useAuth } from "~/hooks/useAuth";
import { AuthModal } from "~/components/AuthModal";
import { UserMenu } from "~/components/UserMenu";
import { LOCK_FUNCTIONS, renderDoorDiagram, type LockFunction } from "~/utils/lock-functions";

export const Route = createFileRoute("/functions")({
  component: FunctionsPage,
});

const MODE_ICONS: Record<string, string> = { normal: "☀️", dark: "🌙", "high-contrast": "🔲", calm: "🌀" };
const MODE_LABELS: Record<string, string> = { normal: "Light mode", dark: "Dark mode", "high-contrast": "High contrast", calm: "Calm mode" };

const CATEGORY_ORDER = ["commercial", "residential", "electric"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  commercial: "ANSI/BHMA Commercial Functions",
  residential: "Residential Functions",
  electric: "Electric Functions",
};

function FunctionsPage() {
  const { mode, cycleMode } = useVisualMode();
  const { user, showAuth, setShowAuth, saveSession, clearSession } = useAuth();
  const [selectedFn, setSelectedFn] = useState<LockFunction | null>(null);

  // Group functions by category
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    functions: LOCK_FUNCTIONS.filter((f) => f.category === cat),
  })).filter((g) => g.functions.length > 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-8">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between sm:mb-8">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 no-underline">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg text-lg font-bold text-white shadow-sm"
              style={{ backgroundColor: mode === "high-contrast" ? "#000" : mode === "calm" ? "#6B6B6B" : "#1B2A4A" }}>
              LB
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl" style={{ color: "var(--text-primary)" }}>LockBuilder</h1>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Lock Functions</p>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link to="/" className="mode-toggle-btn" title="Part Number Builder" aria-label="Part Number Builder">
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>🔧</span>
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
          <button className="mode-toggle-btn" onClick={cycleMode} title={MODE_LABELS[mode]}
            aria-label={`Visual mode: ${MODE_LABELS[mode]}. Click to change.`}>
            <span className="text-base">{MODE_ICONS[mode]}</span>
          </button>
        </div>
      </header>

      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
        <Link to="/" style={{ color: "var(--accent)", textDecoration: "none" }}>Builder</Link>
        <span>/</span>
        <span>Lock Functions</span>
      </div>

      {/* Main layout: sidebar + detail */}
      <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
        {/* Left sidebar — function list */}
        <aside className="w-full shrink-0 lg:w-72">
          <div className="rounded-xl border p-3" style={{
            backgroundColor: "var(--bg-secondary)",
            borderColor: "var(--border-color)",
          }}>
            {grouped.map((group) => (
              <div key={group.category} className="mb-3 last:mb-0">
                <h3 className="mb-1.5 px-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  {group.label}
                </h3>
                <div className="space-y-0.5">
                  {group.functions.map((fn) => (
                    <button
                      key={fn.code}
                      onClick={() => setSelectedFn(fn)}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm transition-colors"
                      style={{
                        backgroundColor: selectedFn?.code === fn.code ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
                        color: "var(--text-primary)",
                        border: selectedFn?.code === fn.code
                          ? "1px solid color-mix(in srgb, var(--accent) 30%, transparent)"
                          : "1px solid transparent",
                        cursor: "pointer",
                        minHeight: "44px",
                        fontWeight: selectedFn?.code === fn.code ? 600 : 400,
                      }}
                    >
                      <span className="font-mono text-xs" style={{ color: "var(--brass)" }}>{fn.code}</span>
                      {" "}{fn.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Main content — function detail */}
        <main className="min-w-0 flex-1">
          {selectedFn ? (
            <FunctionDetail fn={selectedFn} />
          ) : (
            <div className="flex h-full min-h-[300px] items-center justify-center rounded-xl border border-dashed p-8"
              style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-secondary)" }}>
              <p className="text-center" style={{ color: "var(--text-muted)" }}>
                Select a function from the list to see details
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function FunctionDetail({ fn }: { fn: LockFunction }) {
  const svg = renderDoorDiagram(fn);

  // Map imageTemplate to filename
  const imageMap: Record<string, string> = {
    lever: "/images/lever-lock-top-down.png",
    "exit-device": "/images/exit-device.png",
    deadbolt: "/images/deadbolt-top-down.png",
    hotel: "/images/hotel-lock.png",
  };
  const imagePath = imageMap[fn.imageTemplate] || imageMap.lever;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border p-4 sm:p-6" style={{
        backgroundColor: "var(--bg-secondary)",
        borderColor: "var(--border-color)",
      }}>
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-md px-2.5 py-0.5 text-xs font-bold font-mono" style={{
            backgroundColor: "color-mix(in srgb, var(--brass) 15%, transparent)",
            color: "var(--brass)",
          }}>
            {fn.code}
          </span>
          <span className="rounded-md px-2 py-0.5 text-xs font-medium" style={{
            backgroundColor: "color-mix(in srgb, var(--text-muted) 10%, transparent)",
            color: "var(--text-muted) ",
          }}>
            {fn.category === "commercial" ? "ANSI/BHMA" : fn.category === "electric" ? "Electric" : "Residential"}
          </span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: "var(--text-primary)" }}>
          {fn.name}
        </h2>
      </div>

      {/* Hardware Diagram — illustrator image */}
      <div className="rounded-xl border p-4 sm:p-6" style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: "var(--border-color)",
      }}>
        <h3 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>Hardware Diagram</h3>
        <div className="mx-auto max-w-lg">
          <img src={imagePath} alt={`${fn.code} — ${fn.name}`} className="w-full h-auto rounded-lg" style={{ maxHeight: "320px", objectFit: "contain" }} />
        </div>
      </div>

      {/* Annotated schematic — SVG */}
      <div className="rounded-xl border p-4 sm:p-6" style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: "var(--border-color)",
      }}>
        <h3 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>Function Diagram</h3>
        <div className="mx-auto max-w-md" dangerouslySetInnerHTML={{ __html: svg }} />
      </div>

      {/* Description */}
      <div className="rounded-xl border p-4 sm:p-6" style={{
        backgroundColor: "var(--bg-secondary)",
        borderColor: "var(--border-color)",
      }}>
        <h3 className="mb-2 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>Description</h3>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
          {fn.description}
        </p>
      </div>
    </div>
  );
}

export default FunctionsPage;