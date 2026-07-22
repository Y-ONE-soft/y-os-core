import { cn } from "@/lib/utils";
import { hexToRgba } from "@/components/features/projects/roadmap-utils";
import {
  TODAY_DATE,
  WEEKDAYS,
  WEEKS,
} from "@/components/features/my-work/my-work-data";
import {
  CAL_WEEK_LAYOUTS,
  type PlacedOverlay,
} from "@/components/features/my-work/my-work-calendar-layout";

const DATE_ROW_PX = 24; // 날짜 숫자 영역
const LANE_PX = 20; // 스팬 레인 1단 높이

function laneTop(lane: number) {
  return DATE_ROW_PX + lane * LANE_PX;
}

function OverlayItem({ overlay }: { overlay: PlacedOverlay }) {
  const left = `${(overlay.col / 7) * 100}%`;
  const width = `${(overlay.span / 7) * 100}%`;

  if (overlay.kind === "projectBg") {
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-[2px] border"
        style={{
          left,
          width,
          top: laneTop(overlay.lane) - 3,
          height: LANE_PX + 4,
          backgroundColor: hexToRgba(overlay.color, 0.07),
          borderColor: hexToRgba(overlay.color, 0.3),
        }}
      >
        {overlay.label && (
          <span
            className="absolute right-1 top-0.5 text-[9px] font-medium"
            style={{ color: hexToRgba(overlay.color, 0.75) }}
          >
            {overlay.label}
          </span>
        )}
      </div>
    );
  }

  if (overlay.kind === "stage") {
    return (
      <div
        className="absolute flex h-[18px] items-center gap-1 overflow-hidden rounded-[4px] px-1"
        style={{
          left: `calc(${left} + 4px)`,
          width: `calc(${width} - 8px)`,
          top: laneTop(overlay.lane),
          backgroundColor: hexToRgba(overlay.color, 0.18),
        }}
      >
        <span
          aria-hidden
          className="flex size-[11px] shrink-0 items-center justify-center rounded-full text-[7.5px] font-medium text-white"
          style={{ backgroundColor: overlay.color }}
        >
          {overlay.count}
        </span>
        <span
          className="truncate text-[10px] font-medium"
          style={{ color: overlay.text }}
        >
          {overlay.label}
        </span>
        {overlay.deadline && (
          <span
            className="ml-auto shrink-0 rounded-[3px] px-1.5 py-px text-[9px] font-medium text-white"
            style={{ backgroundColor: overlay.text }}
          >
            마감
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className="absolute flex h-4 items-center gap-1 overflow-hidden rounded-[4px] px-1"
      style={{
        left: `calc(${left} + 4px)`,
        width: `calc(${width} - 8px)`,
        top: laneTop(overlay.lane),
        backgroundColor: overlay.done ? hexToRgba(overlay.text, 0.1) : undefined,
      }}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-[9px] shrink-0 items-center justify-center rounded-[2px] text-[7px] text-white",
          !overlay.done && "border-[1.2px]",
        )}
        style={
          overlay.done
            ? { backgroundColor: overlay.text }
            : { borderColor: overlay.text }
        }
      >
        {overlay.done ? "✓" : ""}
      </span>
      <span
        className={cn("truncate text-[10px] font-medium", overlay.done && "line-through")}
        style={{ color: overlay.done ? hexToRgba(overlay.text, 0.7) : overlay.text }}
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
        const { overlays, laneCount } = CAL_WEEK_LAYOUTS[weekIndex];
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
            {overlays.map((overlay, overlayIndex) => (
              <OverlayItem key={overlayIndex} overlay={overlay} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
