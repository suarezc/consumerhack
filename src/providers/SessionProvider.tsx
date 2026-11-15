import { randomUUID } from "expo-crypto";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { createSessionStore, type Session } from "@/services/session";
import { sessionStorage } from "@/services/storage";

const store = createSessionStore(sessionStorage, randomUUID);

type SessionContextValue = {
  session: Session | null;
  loading: boolean;
  error: boolean;
  retry: () => void;
  selectTree: (treeId: string | null) => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    store.load().then((value) => {
      if (active) setSession(value);
    }).catch(() => {
      if (active) setError(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [attempt]);

  async function selectTree(treeId: string | null) {
    const next = await store.selectTree(treeId);
    setSession(next);
  }

  return (
    <SessionContext.Provider value={{ session, loading, error, retry: () => {
      setLoading(true);
      setError(false);
      setAttempt((value) => value + 1);
    }, selectTree }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("SessionProvider is required");
  return context;
}
