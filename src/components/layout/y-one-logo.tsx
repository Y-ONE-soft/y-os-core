import { cn } from "@/lib/utils";

/**
 * Figma: Y.ONE Logo(92:158) — 네이비 스퀘어 + 화이트 Y.ONE 와이드 트래킹.
 * 크기 변형: 헤더 28 · 로그인 40 (텍스트·라운딩·트래킹은 디자인 노드 값 그대로).
 */
const SIZES = {
  28: { box: "size-7 rounded-[4px]", text: "text-[6.5px] tracking-[0.91px]" },
  40: { box: "size-10 rounded-[6px]", text: "text-[9px] tracking-[1.26px]" },
} as const;

export function YOneLogo({ size = 28 }: { size?: keyof typeof SIZES }) {
  const variant = SIZES[size];
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center bg-primary",
        variant.box,
      )}
    >
      <span
        className={cn("font-medium text-primary-foreground", variant.text)}
      >
        Y.ONE
      </span>
    </span>
  );
}
