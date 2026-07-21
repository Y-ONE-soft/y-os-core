import Image from "next/image";
import Link from "next/link";

import { SidebarToggle } from "@/components/layout/sidebar-toggle";
import { TopNav } from "@/components/layout/top-nav";
import { UserMenu } from "@/components/layout/user-menu";

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
        <TopNav />
      </div>
      <UserMenu />
    </header>
  );
}
