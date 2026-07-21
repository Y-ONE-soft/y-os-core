"use client";

import { PanelLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useShell } from "@/components/layout/shell-context";

export function SidebarToggle() {
  const { sidebarCollapsed, toggleSidebar } = useShell();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleSidebar}
      aria-label={sidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
      aria-expanded={!sidebarCollapsed}
      className="text-muted-foreground"
    >
      <PanelLeft />
    </Button>
  );
}
