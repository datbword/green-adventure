import { useState, useEffect, useCallback } from "react";
import type { UserSession } from "~/utils/auth";

const SESSION_KEY = "lockbuilder-session";

export function useAuth() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);

  // Load session from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as UserSession;
        setUser(parsed);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const saveSession = useCallback((session: UserSession) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setUser(session);
    setShowAuth(false);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  return {
    user,
    loading,
    showAuth,
    setShowAuth,
    saveSession,
    clearSession,
    isSignedIn: !!user,
    isPremium: user?.tier === "premium",
  };
}