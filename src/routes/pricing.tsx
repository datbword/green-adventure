import { createFileRoute, Link } from "@tanstack/react-router";
import { useVisualMode } from "~/hooks/useVisualMode";
import { useAuth } from "~/hooks/useAuth";
import { PRODUCTS, getPaymentLink, upgradeSubscription } from "~/utils/payments";
import { useState } from "react";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
});

const MODE_ICONS: Record<string, string> = { normal: "☀️", dark: "🌙", "high-contrast": "🔲", calm: "🌀" };
const MODE_LABELS: Record<string, string> = { normal: "Light mode", dark: "Dark mode", "high-contrast": "High contrast", calm: "Calm mode" };

function PricingPage() {
  const { mode, cycleMode } = useVisualMode();
  const { user, showAuth, setShowAuth, saveSession, clearSession } = useAuth();
  const [updating, setUpdating] = useState<string | null>(null);

  const handlePurchase = async (productId: string) => {
    if (!user) {
      setShowAuth(true);
      return;
    }
    if (productId === "full_access") {
      // One-time purchase — open Stripe checkout link
      const link = getPaymentLink(productId, user.id);
      window.open(link, "_blank", "noopener,noreferrer");
    } else if (productId === "ad_free") {
      // Subscription — open Stripe checkout link
      const link = getPaymentLink(productId, user.id);
      window.open(link, "_blank", "noopener,noreferrer");
    }
  };

  // Manual upgrade for testing (the lead can also trigger this)
  const handleManualUpgrade = async () => {
    if (!user) return;
    setUpdating("manual");
    const result = await upgradeSubscription({ data: { userId: user.id, tier: "premium" } });
    if (result.ok && result.user) {
      saveSession(result.user);
    }
    setUpdating(null);
  };

  const cardStyle = {
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    borderRadius: "12px",
    padding: "24px",
    display: "flex",
    flexDirection: "column" as const,
  };

  const btnStyle = {
    width: "100%",
    padding: "14px",
    borderRadius: "8px",
    fontSize: "16px",
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    color: "#fff",
    minHeight: "48px",
    backgroundColor: "var(--accent)",
    marginTop: "auto",
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 sm:py-8">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between sm:mb-8">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-3 no-underline">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg text-lg font-bold text-white shadow-sm"
              style={{ backgroundColor: mode === "high-contrast" ? "#000" : mode === "calm" ? "#6B6B6B" : "#1B2A4A" }}>
              LB
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl" style={{ color: "var(--text-primary)" }}>LockBuilder</h1>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Pricing</p>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {user && (
            <button onClick={clearSession} className="mode-toggle-btn" title="Sign out" aria-label="Sign out">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
          <button className="mode-toggle-btn" onClick={cycleMode} title={MODE_LABELS[mode]}
            aria-label={`Visual mode: ${MODE_LABELS[mode]}. Click to change.`}>
            <span className="text-base">{MODE_ICONS[mode]}</span>
          </button>
        </div>
      </header>

      <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Go Ad-Free &amp; Unlock Full Access</h2>
      <p className="mb-8 text-sm" style={{ color: "var(--text-muted)" }}>
        Support LockBuilder and get the best experience. Your subscription helps us maintain accurate manufacturer data.
      </p>

      {/* Current status */}
      {user && (
        <div className="mb-6 rounded-lg px-4 py-3 text-sm" style={{
          backgroundColor: "color-mix(in srgb, var(--success) 12%, transparent)",
          color: "var(--success)",
        }}>
          {user.tier === "premium"
            ? "✅ You're a premium member — no ads, full access!"
            : "👤 Free tier — upgrade below to remove ads and support development."}
        </div>
      )}

      {/* Pricing cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* One-time $5 */}
        <div style={cardStyle}>
          <h3 className="text-lg font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            {PRODUCTS.fullAccess.name}
          </h3>
          <p className="text-3xl font-bold mb-3" style={{ color: "var(--accent)" }}>
            {PRODUCTS.fullAccess.price}
          </p>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            {PRODUCTS.fullAccess.description}
          </p>
          <ul className="text-sm mb-6 space-y-2" style={{ color: "var(--text-secondary)" }}>
            <li>✓ All 7 manufacturers</li>
            <li>✓ All product series</li>
            <li>✓ Cross-reference lookups</li>
            <li>✓ Part number export</li>
            <li>One-time payment — never expires</li>
          </ul>
          <button style={btnStyle} onClick={() => handlePurchase("full_access")}
            disabled={updating === "full_access"}>
            {user?.tier === "premium" ? "✓ Purchased" : "Buy Now — $5"}
          </button>
        </div>

        {/* $2/month subscription */}
        <div style={{
          ...cardStyle,
          borderColor: "var(--brass)",
          boxShadow: "0 0 0 1px var(--brass), 0 4px 12px rgba(200,150,62,0.15)",
        }}>
          <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "var(--brass)" }}>
            Popular
          </div>
          <h3 className="text-lg font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            {PRODUCTS.adFree.name}
          </h3>
          <p className="text-3xl font-bold mb-3" style={{ color: "var(--accent)" }}>
            {PRODUCTS.adFree.price}
          </p>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            {PRODUCTS.adFree.description}
          </p>
          <ul className="text-sm mb-6 space-y-2" style={{ color: "var(--text-secondary)" }}>
            <li>✓ No advertisements</li>
            <li>✓ Clean, focused experience</li>
            <li>✓ Includes all features</li>
            <li>✓ Cancel anytime</li>
            <li>Monthly subscription</li>
          </ul>
          <button style={btnStyle} onClick={() => handlePurchase("ad_free")}
            disabled={updating === "ad_free"}>
            {user?.tier === "premium" ? "✓ Active" : "Subscribe — $2/mo"}
          </button>
        </div>
      </div>

      {/* Manual upgrade (for testing) */}
      {user && (
        <div className="mt-6 text-center">
          <button onClick={handleManualUpgrade}
            className="text-xs underline-offset-2 hover:underline"
            style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
            {updating === "manual" ? "Updating..." : "Test: manually upgrade (dev only)"}
          </button>
        </div>
      )}

      {/* Not signed in prompt */}
      {!user && (
        <div className="mt-6 text-center">
          <button onClick={() => setShowAuth(true)}
            className="text-sm font-medium underline-offset-2 hover:underline"
            style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>
            Sign in to purchase
          </button>
        </div>
      )}

      <footer className="mt-10 border-t pt-5 text-center text-xs"
        style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}>
        <Link to="/" className="hover:underline" style={{ color: "var(--accent)" }}>Back to builder</Link>
      </footer>
    </div>
  );
}