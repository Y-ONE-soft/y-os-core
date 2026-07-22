"use client";

// 프로젝트 생성 다이얼로그 전용 날짜 선택 캘린더.
//
// 내 할일의 월 캘린더(my-work-calendar)와 의도적으로 분리했다. 그쪽은 이미 단계·할일을
// 옮기는 드래그가 걸려 있어 "기간 선택 드래그"를 얹으면 모드 구분이 필요해지고 로직이
// 서로를 침범한다. 여기서는 선택 외에 하는 일이 없다.
//
// 그리드 계산도 my-work-month의 buildMonthGrid를 쓰지 않는다 — my-work가 이미
// projects를 참조하고 있어 반대로 끌어오면 피처 간 순환이 된다.

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { addDaysISO } from "@/lib/stage-plan";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export type DateRange = { startDate: string; endDate: string };

/** 로컬 시각 기준 오늘 (YYYY-MM-DD) — UTC로 찍으면 한국 시간대에서 하루 어긋난다 */
export function todayLocalISO(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

type MonthCell = { iso: string; date: number; inMonth: boolean };

/** 그 달이 속한 주 전체를 채운 6주 이하 그리드. 이월 칸도 실제 날짜를 갖는다. */
function buildCells(year: number, month: number): MonthCell[] {
  const first = new Date(year, month, 1);
  const leading = first.getDay(); // 0 = 일요일
  const lastDate = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((leading + lastDate) / 7);

  const pad = (n: number) => String(n).padStart(2, "0");
  const gridStart = `${year}-${pad(month + 1)}-01`;

  return Array.from({ length: weeks * 7 }, (_, i) => {
    const iso = addDaysISO(gridStart, i - leading);
    const day = Number(iso.slice(8, 10));
    const isoMonth = Number(iso.slice(5, 7)) - 1;
    return { iso, date: day, inMonth: isoMonth === month };
  });
}

/** 두 날짜를 앞뒤 순서로 정렬 — 드래그는 어느 방향으로도 가능하다 */
function normalize(a: string, b: string): DateRange {
  return a <= b ? { startDate: a, endDate: b } : { startDate: b, endDate: a };
}

type Props = {
  /** "single" = 기준일 하나(프리셋 적용), "range" = 드래그로 기간(직접 만들기) */
  mode: "single" | "range";
  value: Partial<DateRange>;
  onChange: (range: DateRange) => void;
  /** 초기 표시 월 — 없으면 선택값, 그것도 없으면 이번 달 */
  initialMonth?: string;
};

export function RangeCalendar({ mode, value, onChange, initialMonth }: Props) {
  const seed = initialMonth ?? value.startDate ?? todayLocalISO();
  const [cursor, setCursor] = useState(() => ({
    year: Number(seed.slice(0, 4)),
    month: Number(seed.slice(5, 7)) - 1,
  }));
  // 드래그 시작점. null이면 드래그 중이 아니다.
  const [anchor, setAnchor] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const cells = useMemo(
    () => buildCells(cursor.year, cursor.month),
    [cursor.year, cursor.month],
  );

  // 드래그 중에는 확정값 대신 진행 중인 범위를 보여준다
  const shown: Partial<DateRange> =
    mode === "range" && anchor && hover ? normalize(anchor, hover) : value;

  const today = todayLocalISO();

  function shiftMonth(amount: number) {
    setCursor((prev) => {
      const next = new Date(prev.year, prev.month + amount, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  function commit(iso: string) {
    if (mode === "single") {
      onChange({ startDate: iso, endDate: iso });
      return;
    }
    onChange(normalize(anchor ?? iso, iso));
  }

  function handleDown(iso: string) {
    if (mode === "single") {
      commit(iso);
      return;
    }
    setAnchor(iso);
    setHover(iso);
  }

  function handleEnter(iso: string) {
    if (mode === "range" && anchor) setHover(iso);
  }

  function handleUp(iso: string) {
    if (mode !== "range" || !anchor) return;
    commit(iso);
    setAnchor(null);
    setHover(null);
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-[10px] border p-3"
      // 셀 밖에서 손을 떼면 드래그가 영원히 잠긴 채 남는다 — 여기서 확정해 준다
      onPointerUp={() => {
        if (anchor && hover) commit(hover);
        setAnchor(null);
        setHover(null);
      }}
      onPointerLeave={() => {
        if (anchor && hover) commit(hover);
        setAnchor(null);
        setHover(null);
      }}
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="이전 달"
          onClick={() => shiftMonth(-1)}
          className="rounded-[6px] p-1 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-[13px] font-semibold">
          {cursor.year}년 {cursor.month + 1}월
        </span>
        <button
          type="button"
          aria-label="다음 달"
          onClick={() => shiftMonth(1)}
          className="rounded-[6px] p-1 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px">
        {WEEKDAYS.map((label) => (
          <div
            key={label}
            className="pb-1 text-center text-[11px] font-medium text-muted-foreground"
          >
            {label}
          </div>
        ))}
        {cells.map((cell) => {
          const selected =
            !!shown.startDate &&
            cell.iso >= shown.startDate &&
            cell.iso <= (shown.endDate ?? shown.startDate);
          const isEdge =
            cell.iso === shown.startDate || cell.iso === shown.endDate;
          return (
            <button
              key={cell.iso}
              type="button"
              // 드래그 중 브라우저 기본 텍스트 선택이 끼어들지 않게 한다
              onDragStart={(event) => event.preventDefault()}
              onPointerDown={() => handleDown(cell.iso)}
              onPointerEnter={() => handleEnter(cell.iso)}
              onPointerUp={() => handleUp(cell.iso)}
              aria-pressed={selected}
              aria-label={cell.iso}
              className={cn(
                "h-8 select-none rounded-[6px] text-[12px] tabular-nums transition-colors",
                cell.inMonth ? "text-foreground" : "text-muted-foreground/50",
                // 사이 날짜는 primary의 옅은 틴트로 칠한다. bg-accent는 이 패널 배경과
                // 명도가 거의 같아 밴드가 보이지 않는다(양끝만 찍힌 것처럼 읽힌다).
                selected && !isEdge && "bg-primary/15 text-foreground",
                isEdge && "bg-primary font-semibold text-primary-foreground",
                !selected && "hover:bg-accent/60",
                cell.iso === today && !selected && "font-semibold text-primary",
              )}
            >
              {cell.date}
            </button>
          );
        })}
      </div>
    </div>
  );
}
