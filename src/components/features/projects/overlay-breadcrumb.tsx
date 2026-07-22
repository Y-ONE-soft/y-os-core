import { cn } from "@/lib/utils";

// 상세 오버레이 헤더의 경로 표기 — 단계는 "프로젝트 › 단계",
// 할일은 "프로젝트 › 단계 › 할일"로 같은 규칙을 쓴다.
// 마지막 항목이 지금 보고 있는 대상이라 진하게 표시한다.

export function OverlayBreadcrumb({
  items,
  className,
}: {
  items: string[];
  className?: string;
}) {
  return (
    <nav
      aria-label="위치"
      className={cn(
        "flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground",
        className,
      )}
    >
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <span key={`${index}-${item}`} className="flex min-w-0 items-center gap-1.5">
            {index > 0 && (
              <span aria-hidden className="shrink-0 text-muted-foreground/60">
                ›
              </span>
            )}
            <span
              className={cn(
                "truncate",
                last && "font-medium text-foreground",
              )}
              title={item}
            >
              {item}
            </span>
          </span>
        );
      })}
    </nav>
  );
}
