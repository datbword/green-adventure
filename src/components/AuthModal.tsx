import { useState } from "react";
import { signUp, signIn } from "~/utils/auth";
import type { UserSession } from "~/utils/auth";

interface AuthModalProps {
  onClose: () => void;
  onSuccess: (user: UserSession) => void;
}

export function AuthModal({ onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signup") {
        const result = await signUp({ data: { email, name, password } });
        if (!result.ok) {
          setError(result.error ?? "Sign up failed");
          return;
        }
        onSuccess(result.user!);
      } else {
        const result = await signIn({ data: { email, password } });
        if (!result.ok) {
          setError(result.error ?? "Sign in failed");
          return;
        }
        onSuccess(result.user!);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const overlayStyle: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 100,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
  };

  const modalStyle: React.CSSProperties = {
    backgroundColor: "var(--bg-secondary)",
    borderRadius: "12px", padding: "24px", width: "100%", maxWidth: "400px",
    border: "1px solid var(--border-color)",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: "8px", fontSize: "16px",
    backgroundColor: "var(--bg-primary)", color: "var(--text-primary)",
    border: "1px solid var(--border-color)", outline: "none",
    minHeight: "48px", marginBottom: "12px",
  };

  const btnStyle: React.CSSProperties = {
    width: "100%", padding: "12px", borderRadius: "8px", fontSize: "16px",
    fontWeight: 600, cursor: busy ? "wait" : "pointer", border: "none",
    color: "#fff", marginTop: "8px", minHeight: "48px",
    backgroundColor: busy ? "var(--text-muted)" : "var(--accent)",
  };

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            {mode === "signin" ? "Sign In" : "Create Account"}
          </h2>
          <button onClick={onClose} className="text-xl leading-none" style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", fontSize: "24px", padding: "4px 8px" }}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <input style={inputStyle} type="email" placeholder="Email" required value={email}
            onChange={(e) => setEmail(e.target.value)} autoComplete="email" />

          {mode === "signup" && (
            <input style={inputStyle} type="text" placeholder="Your name" required value={name}
              onChange={(e) => setName(e.target.value)} autoComplete="name" />
          )}

          <input style={inputStyle} type="password" placeholder="Password (6+ characters)" required minLength={6} value={password}
            onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} />

          {error && (
            <p className="text-sm mb-2" style={{ color: "#d32f2f" }}>{error}</p>
          )}

          <button type="submit" style={btnStyle} disabled={busy}>
            {busy ? "Please wait..." : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}
            className="font-medium underline-offset-2 hover:underline"
            style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}