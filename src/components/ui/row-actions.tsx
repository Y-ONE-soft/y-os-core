"use client";

import { MoreVertical } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// 행 위에 올리면 나타나는 ⋮ 버튼 — 누르면 그 행의 동작 메뉴가 열린다.
// 우클릭 컨텍스트 메뉴는 그대로 두고, 발견하기 쉬운 진입점을 하나 더 두는 것이 목적이다.
//
// 프로젝트·단계·할일이 모두 쓰므로 어느 도메인에도 속하지 않는다.
// 도메인 로직 없이 dropdown-menu 프리미티브를 얇게 조합하기만 한다.

export type RowAction = {
  label: string;
  onSelect: () => void;
  /** 삭제처럼 되돌리기 어려운 동작 */
  destructive?: boolean;
};

export function RowActions({
  label,
  actions,
  className,
}: {
  /** aria-label에 쓰인다. 예: "할일" → "할일 메뉴 열기" */
  label: string;
  actions: RowAction[];
  className?: string;
}) {
  if (actions.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${label} 메뉴 열기`}
          // 행 자체가 클릭(상세 열기)·드래그 대상이라 둘 다 막는다
          draggable={false}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-[6px] text-muted-foreground",
            "opacity-0 transition-opacity hover:bg-accent/60 hover:text-foreground",
            // 부모 행의 group-hover로 나타난다. 메뉴가 열린 동안과 키보드 포커스
            // 상태에서는 커서가 행을 벗어나도 사라지면 안 된다.
            "group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100",
            className,
          )}
        >
          <MoreVertical className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.label}
            variant={action.destructive ? "destructive" : "default"}
            onSelect={action.onSelect}
          >
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
