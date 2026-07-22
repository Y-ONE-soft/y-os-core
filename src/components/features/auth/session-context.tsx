"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { fetchMe, logout } from "@/lib/api/auth";
import type { SessionUser } from "@/types/auth";

type SessionValue = {
  user: SessionUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchMe()
      .then((me) => {
        if (active) setUser(me);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const signOut = useCallback(async () => {
    await logout();
    setUser(null);
    router.replace("/login");
    router.refresh();
  }, [router]);

  return (
    <SessionContext value={{ user, loading, signOut }}>
      {children}
    </SessionContext>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession은 SessionProvider 내부에서만 사용할 수 있습니다.");
  }
  return context;
}
