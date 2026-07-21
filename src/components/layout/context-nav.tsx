"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  ListTodo,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useShell } from "@/components/layout/shell-context";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
};

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "운영",
    items: [
      { label: "대시보드", href: "/", icon: LayoutDashboard },
      { label: "작업 현황", href: "/tasks", icon: ListTodo },
      { label: "문의함", href: "/inbox", icon: Inbox, badge: 4 },
    ],
  },
  {
    label: "바로가기",
    items: [
      { label: "프로젝트", href: "/projects", icon: FolderKanban },
      { label: "위키", href: "/wiki", icon: BookOpen },
      { label: "고객", href: "/customers", icon: Users },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function ContextNav() {
  const pathname = usePathname();
  const { sidebarCollapsed: collapsed } = useShell();

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col gap-6 border-r bg-background py-5",
        collapsed ? "w-[72px] px-3" : "w-64 px-4",
      )}
    >
      <nav
        aria-label="컨텍스트 메뉴"
        className="flex flex-1 flex-col gap-6 overflow-y-auto"
      >
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col">
            {!collapsed && (
              <p className="pb-1.5 pl-3 text-[11px] font-medium tracking-[0.04em] text-muted-foreground">
                {group.label}
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "flex h-[38px] items-center gap-2.5 rounded-[10px] px-3 text-sm font-medium transition-colors",
                        active
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                        collapsed && "justify-center px-0",
                      )}
                    >
                      <item.icon className="size-4 shrink-0" />
                      {!collapsed && <span className="flex-1">{item.label}</span>}
                      {!collapsed && item.badge != null && (
                        <Badge
                          variant="secondary"
                          className="text-[11px] text-muted-foreground"
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
