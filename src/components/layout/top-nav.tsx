"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const SECTIONS = [
  { label: "운영", href: "/", prefix: null },
  { label: "프로젝트", href: "/projects", prefix: "/projects" },
  { label: "위키", href: "/wiki", prefix: "/wiki" },
] as const;

export function TopNav() {
  const pathname = usePathname();
  const activeSection =
    SECTIONS.find((s) => s.prefix && pathname.startsWith(s.prefix)) ??
    SECTIONS[0];

  return (
    <nav aria-label="주요 섹션">
      <ul className="flex items-center gap-1">
        {SECTIONS.map((section) => {
          const active = section === activeSection;
          return (
            <li key={section.label}>
              <Link
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center rounded-full px-3.5 py-[7px] text-sm font-medium transition-colors",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
