import { cn } from "@/lib/utils";
import { hexToRgba } from "@/components/features/projects/roadmap-utils";
import {
  PROJECTS,
  TODAY_DATE,
  WEEKDAYS,
  WEEKS,
} from "@/components/features/my-work/my-work-data";
import {
  CAL_WEEK_LAYOUTS,
  type PlacedOverlay,
  type ProjectBox,
} from "@/components/features/my-work/my-work-calendar-layout";

const DATE_ROW_PX = 24; // 날짜 숫자 영역
const LANE_PX = 26; // 스팬 레인 1단 높이
const STAGE_PX = 22; // 단계 막대 높이 — 겹쳐도 집어낼 수 있게 두껍게
const TASK_PX = 20; // 할일 칩 높이

function laneTop(lane: number) {
  return DATE_ROW_PX + lane * LANE_PX;
}

function colLeft(col: number) {
  return `${(col / 7) * 100}%`;
}

function colWidth(span: number) {
  return `${(span / 7) * 100}%`;
}

/** 프로젝트 박스 — 그 프로젝트의 단계 줄과 할일 줄을 함께 감싼다. */
function ProjectBoxItem({ box }: { box: ProjectBox }) {
  const { color } = PROJECTS[box.project];

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute border",
        // 주 경계에서 잘린 면은 열어 둬야 다음 주로 이어진 한 범위로 읽힌다
        box.continuesLeft ? "border-l-0" : "rounded-l-[2px]",
        box.continuesRight ? "border-r-0" : "rounded-r-[2px]",
      )}
      style={{
        left: colLeft(box.col),
        width: colWidth(box.span),
        top: laneTop(box.lane) - 3,
        height: box.lanes * LANE_PX + 4,
        backgroundColor: hexToRgba(color, 0.07),
        borderColor: hexToRgba(color, 0.3),
      }}
    >
      {box.label && (
        <span
          className="absolute right-1 top-0.5 text-[9px] font-medium"
          style={{ color: hexToRgba(color, 0.75) }}
        >
          {box.label}
        </span>
      )}
      {/* 박스 안 줄 구분선 — 실제 할일 줄 위에만 긋는다. 빈 자리에는 선이 남지 않는다 */}
      {Array.from({ length: box.taskLanes }, (_, index) => (
        <div
          key={index}
          className="absolute inset-x-0 h-px"
          style={{
            top: (index + 1) * LANE_PX + 1,
            backgroundColor: hexToRgba(color, 0.22),
          }}
        />
      ))}
    </div>
  );
}

function OverlayItem({ overlay }: { overlay: PlacedOverlay }) {
  const { color, text } = PROJECTS[overlay.project];
  const left = colLeft(overlay.col);
  const width = colWidth(overlay.span);

  if (overlay.kind === "stage") {
    return (
      <div
        className="absolute flex items-center gap-1 overflow-hidden rounded-[4px] px-1"
        style={{
          left: `calc(${left} + 4px)`,
          width: `calc(${width} - 8px)`,
          top: laneTop(overlay.lane),
          height: STAGE_PX,
          backgroundColor: hexToRgba(color, 0.18),
        }}
      >
        <span
          aria-hidden
          className="flex size-[11px] shrink-0 items-center justify-center rounded-full text-[7.5px] font-medium text-white"
          style={{ backgroundColor: color }}
        >
          {overlay.count}
        </span>
        <span className="truncate text-[10px] font-medium" style={{ color: text }}>
          {overlay.label}
        </span>
        {overlay.deadline && (
          <span
            className="ml-auto shrink-0 rounded-[3px] px-1.5 py-px text-[9px] font-medium text-white"
            style={{ backgroundColor: text }}
          >
            마감
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className="absolute flex items-center gap-1 overflow-hidden rounded-[4px] px-1"
      style={{
        left: `calc(${left} + 4px)`,
        width: `calc(${width} - 8px)`,
        top: laneTop(overlay.lane),
        height: TASK_PX,
        backgroundColor: overlay.done ? hexToRgba(text, 0.1) : undefined,
      }}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-[9px] shrink-0 items-center justify-center rounded-[2px] text-[7px] text-white",
          !overlay.done && "border-[1.2px]",
        )}
        style={overlay.done ? { backgroundColor: text } : { borderColor: text }}
      >
        {overlay.done ? "✓" : ""}
      </span>
      <span
        className={cn("truncate text-[10px] font-medium", overlay.done && "line-through")}
        style={{ color: overlay.done ? hexToRgba(text, 0.7) : text }}
      >
        {overlay.label}
      </span>
    </div>
  );
}

export function MyWorkCalendar() {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-clip rounded-[10px] border bg-card">
      <div className="flex w-full">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className={cn(
              "flex flex-1 justify-center border-b py-1.5 text-[11px] font-medium",
              day === "일"
                ? "text-[rgba(219,38,38,0.75)]"
                : day === "토"
                  ? "text-[rgba(38,99,235,0.75)]"
                  : "text-muted-foreground",
            )}
          >
            {day}
          </div>
        ))}
      </div>
      {WEEKS.map((week, weekIndex) => {
        const { boxes, overlays, laneCount } = CAL_WEEK_LAYOUTS[weekIndex];
        const minHeight = laneCount > 0 ? DATE_ROW_PX + laneCount * LANE_PX + 8 : undefined;
        return (
          <div
            key={weekIndex}
            className="relative flex w-full flex-1"
            style={{ minHeight }}
          >
            {week.map((date, dayIndex) => (
              <div
                key={dayIndex}
                className={cn(
                  "flex-1 border-b px-2 pb-1 pt-1.5",
                  dayIndex < 6 && "border-r",
                  date === null && "bg-muted",
                  date === TODAY_DATE && "bg-accent",
                )}
              >
                {date !== null && (
                  <span
                    className={cn(
                      "text-[11px] text-muted-foreground",
                      date === TODAY_DATE && "font-medium text-foreground",
                    )}
                  >
                    {date}
                  </span>
                )}
              </div>
            ))}
            {boxes.map((box) => (
              <ProjectBoxItem key={box.project} box={box} />
            ))}
            {overlays.map((overlay, overlayIndex) => (
              <OverlayItem key={overlayIndex} overlay={overlay} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
