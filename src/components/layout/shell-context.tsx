"use client";

import { createContext, useContext, useState } from "react";

type ShellContextValue = {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
};

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <ShellContext
      value={{
        sidebarCollapsed,
        toggleSidebar: () => setSidebarCollapsed((prev) => !prev),
      }}
    >
      {children}
    </ShellContext>
  );
}

export function useShell() {
  const context = useContext(ShellContext);
  if (!context) {
    throw new Error("useShell은 ShellProvider 내부에서만 사용할 수 있습니다.");
  }
  return context;
}
