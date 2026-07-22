"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/components/features/auth/session-context";

export function UserMenu() {
  const { user, loading, signOut } = useSession();

  if (loading) {
    return (
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-8 rounded-full" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-2.5 w-10" />
        </div>
      </div>
    );
  }

  // proxy가 비로그인 접근을 막으므로 정상 흐름에서는 도달하지 않는다 (세션 만료 직후 등 경계 상태)
  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-primary-foreground">
          {user.name.charAt(0)}
        </span>
        <span className="flex flex-col items-start gap-px">
          <span className="text-[13px] font-medium text-foreground">
            {user.name}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {user.title ?? (user.role === "MASTER" ? "마스터" : "스탭")}
          </span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-[220px]">
        <DropdownMenuItem>설정</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => void signOut()}
        >
          로그아웃
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
