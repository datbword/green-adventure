interface AdBannerProps {
  tier: "free" | "premium";
}

export function AdBanner({ tier }: AdBannerProps) {
  if (tier === "premium") return null;

  return (
    <a
      href="/pricing"
      className="block rounded-lg border px-4 py-3 text-center text-xs transition-colors hover:opacity-90"
      style={{
        borderColor: "var(--border-color)",
        backgroundColor: "color-mix(in srgb, var(--accent) 5%, var(--bg-secondary))",
        color: "var(--text-muted)",
      }}
    >
      <span className="font-medium" style={{ color: "var(--accent)" }}>📢 Ad</span>{" "}
      Love LockBuilder?{" "}
      <span className="underline underline-offset-2" style={{ color: "var(--brass)" }}>
        Go ad-free for $2/month
      </span>{" "}
      or unlock full access for a one-time $5 payment.
    </a>
  );
}