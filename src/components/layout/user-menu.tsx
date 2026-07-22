"use client";

import { ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/components/features/auth/session-context";
import type { SessionUser } from "@/types/auth";

/**
 * 알림 도메인이 아직 없어 Figma 예시 값을 자리표시로 둔다.
 * (사이드바 "문의함" 배지와 동일한 방식 — context-nav.tsx)
 */
const NOTIFICATION_COUNT = 2;

/** 항목 공통 스펙 — Figma 187:842 등: 13px regular, px 8 / py 7, 라운딩 6 */
const ITEM_CLASS = "gap-2 rounded-[6px] px-2 py-[7px] text-[13px] font-normal";

/** 직책이 없으면 권한명으로 대체한다. */
function roleLabel(user: SessionUser) {
  return user.title ?? (user.role === "MASTER" ? "마스터" : "스탭");
}

export function UserMenu() {
  const { user, loading, signOut } = useSession();

  if (loading) {
    // 트리거와 동일한 한 줄·32px 높이 — 로딩 → 로드 전환 시 헤더가 흔들리지 않도록
    return (
      <div className="flex h-8 items-center gap-2.5">
        <Skeleton className="size-8 shrink-0 rounded-full" />
        <Skeleton className="h-3.5 w-16" />
      </div>
    );
  }

  // proxy가 비로그인 접근을 막으므로 정상 흐름에서는 도달하지 않는다 (세션 만료 직후 등 경계 상태)
  if (!user) return null;

  const subtitle = user.email
    ? `${roleLabel(user)} · ${user.email}`
    : roleLabel(user);

  return (
    <DropdownMenu>
      {/*
        트리거는 아바타 높이(32px)에 맞춘 한 줄로 둔다.
        - 이전에는 이름/역할 2줄이라 텍스트단(37px)이 아바타(32px)보다 커서 위아래로 삐져나오고,
          좌측 정렬된 짧은 역할 텍스트가 헤더 우측 경계에서 최대 17px 파여 우측이 들쭉날쭉했다.
        - 역할은 드롭다운 _Me 블록에 이름·이메일과 함께 이미 있으므로 트리거에서는 뺀다.
        - 이름은 max-w + truncate로 길이 변동을 흡수한다(고정하지 않으면 이름 길이에 따라
          트리거 좌측단이 움직여 헤더 우측 덩어리 위치가 흔들린다).
      */}
      <DropdownMenuTrigger className="flex h-8 items-center gap-2.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-primary-foreground">
          {user.name.charAt(0)}
        </span>
        <span className="max-w-[140px] truncate text-[13px] font-medium text-foreground">
          {user.name}
        </span>
        <ChevronDown
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground"
        />
      </DropdownMenuTrigger>
      {/*
        Figma(187:821)의 패널 위치는 트리거가 아니라 헤더 기준이다.
        - 가로: 화면 우측 4px. 헤더 좌우 패딩이 24px이라 트리거 우측단보다 20px 바깥이므로
          alignOffset -20으로 밀고, 기본 충돌 패딩(10px)이 되밀지 않도록 collisionPadding을 4로 낮춘다.
        - 세로: top 72px = 헤더 높이(64) + 8. 트리거는 헤더 안에서 세로 중앙 정렬이라
          하단이 48px(=(64-32)/2 + 32)이므로 sideOffset은 8이 아니라 24여야 헤더 아래 8px에 걸린다.
          ※ 트리거 높이를 바꾸면 이 값도 함께 조정해야 한다 — 2줄(37px) 시절에는 22였다.
      */}
      <DropdownMenuContent
        align="end"
        alignOffset={-20}
        sideOffset={24}
        collisionPadding={4}
        className="flex w-[240px] flex-col gap-0.5 rounded-[8px] border p-1.5 shadow-[0_4px_8px_rgba(0,0,0,0.1)] ring-0"
      >
        <DropdownMenuLabel className="flex items-center gap-2.5 p-2 font-normal">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[13px] font-medium text-foreground">
            {user.name.charAt(0)}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[13px] font-medium text-foreground">
              {user.name}
            </span>
            <span className="truncate text-[11px] font-normal text-muted-foreground">
              {subtitle}
            </span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="mx-0 my-0" />
        <DropdownMenuItem className={ITEM_CLASS}>
          <span className="flex-1">알림</span>
          <Badge className="h-auto rounded-[8px] px-1.5 py-px text-[10px] font-medium">
            {NOTIFICATION_COUNT}
          </Badge>
        </DropdownMenuItem>
        <DropdownMenuItem className={ITEM_CLASS}>내 정보</DropdownMenuItem>
        <DropdownMenuItem className={ITEM_CLASS}>프리셋 관리</DropdownMenuItem>
        <DropdownMenuItem className={ITEM_CLASS}>설정</DropdownMenuItem>
        <DropdownMenuSeparator className="mx-0 my-0" />
        <DropdownMenuItem
          className={ITEM_CLASS}
          onSelect={() => void signOut()}
        >
          로그아웃
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
