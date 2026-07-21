import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { SidebarToggle } from "@/components/layout/sidebar-toggle";
import { UserMenu } from "@/components/layout/user-menu";

const TOP_NAV = [
  { label: "운영", href: "/", active: true },
  { label: "프로젝트", href: "/projects", active: false },
  { label: "위키", href: "/wiki", active: false },
];

export function GlobalHeader() {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-9">
        <div className="flex items-center gap-3">
          <SidebarToggle />
          <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/brand-mark.svg"
            alt="Y.OS Core 브랜드 마크"
            width={28}
            height={28}
            priority
          />
          <span className="text-base font-semibold text-foreground">
            Y.OS Core
          </span>
            <span aria-hidden className="h-3.5 w-px bg-border" />
            <span className="text-xs text-muted-foreground">통합 업무 관리</span>
          </Link>
        </div>
        <nav aria-label="주요 섹션">
          <ul className="flex items-center gap-1">
            {TOP_NAV.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  aria-current={item.active ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center rounded-full px-3.5 py-[7px] text-sm font-medium transition-colors",
                    item.active
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <UserMenu />
    </header>
  );
}
