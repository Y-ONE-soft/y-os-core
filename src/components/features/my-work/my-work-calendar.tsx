"use client";

import { useRef, useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import {
  hexToRgba,
  shiftISO,
  type DragMode,
} from "@/components/features/projects/roadmap-utils";
import {
  gridWeekdayHeaders,
  type CalendarGrid,
} from "@/components/features/my-work/my-work-month";
import {
  getTaskDragData,
  isTaskDrag,
} from "@/components/features/projects/task-drag";
import {
  UNASSIGNED_BOX,
  type CalendarProject,
} from "@/components/features/my-work/my-work-calendar-source";
import {
  type PlacedOverlay,
  type ProjectBox,
  type WeekLayout,
} from "@/components/features/my-work/my-work-calendar-layout";

const DATE_ROW_PX = 24; // 날짜 숫자 영역
const LANE_PX = 28; // 스팬 레인 1단 높이
// 주 행 최소 높이 — 내용이 없어도 이 높이는 확보해 날짜 칸이 찌그러지지 않게 한다.
// 날짜 숫자(24) + 여유 레인. 화면이 낮으면 이 높이가 유지되고 캘린더가 스크롤한다.
// 날짜 클릭으로 할일을 추가하려면 칸 아래에 눌러서 새 할일을 놓을 빈 공간이 필요하므로
// 예전(104)보다 키워, 박스가 없는 날도 넉넉한 클릭 영역을 갖게 한다.
const WEEK_MIN_PX = 140;
// 콘텐츠(박스·칩) 아래에 항상 남겨 두는 빈 레인 수. 박스가 칸을 꽉 채워도 그 아래로
// 이만큼은 "프로젝트 없음" 할일을 놓을 수 있는 빈 공간이 남는다.
const WEEK_PAD_LANES = 1;
const STAGE_PX = 22; // 단계 막대 높이 — 겹쳐도 집어낼 수 있게 두껍게
const TASK_PX = 20; // 할일 칩 높이

// 프로젝트 박스의 세로 기하. 레인 높이(28) = 할일 칩(20) + 여백 2 + 간격 4 + 여백 2로,
// 위아래 박스가 각자 여백을 갖고도 사이에 간격이 남도록 맞춰 둔 값이다.
// 이 셋과 LANE_PX·TASK_PX는 함께 움직인다 — 하나만 바꾸면 박스가 다시 겹치거나
// 내용이 테두리에 닿는다.
const BOX_PAD_PX = 2; // 테두리와 내용 사이 여백
const BOX_GAP_PX = 4; // 위아래 프로젝트 박스 사이 간격

/** 클릭과 드래그를 가르는 이동량(px) — 로드맵 막대와 같은 기준 */
const DRAG_THRESHOLD = 3;
/** 막대 양 끝 리사이즈 손잡이 폭(px) */
const HANDLE_PX = 8;

export type StageDragPhase = "move" | "commit" | "cancel";

/** 드래그 대상 — 단계는 이동·양끝 조절, 할일은 날짜 이동만 */
export type DragTarget =
  | { kind: "stage"; stageId: string; mode: DragMode }
  | { kind: "task"; taskId: string };

function laneTop(lane: number) {
  return DATE_ROW_PX + lane * LANE_PX;
}

function colLeft(col: number, columns: number) {
  return `${(col / columns) * 100}%`;
}

function colWidth(span: number, columns: number) {
  return `${(span / columns) * 100}%`;
}

/** 포인터 지점 아래의 백로그 드롭존 요소 (없으면 null). 칩을 백로그로 되돌릴 때 쓴다. */
function backlogDropzoneAt(clientX: number, clientY: number): Element | null {
  return (
    document
      .elementFromPoint(clientX, clientY)
      ?.closest("[data-backlog-dropzone]") ?? null
  );
}

/** 드래그 중 백로그 드롭존 강조를 토글 — 지금 지점의 드롭존만 활성으로 둔다. */
function highlightBacklog(zone: Element | null) {
  const prev = document.querySelector(
    "[data-backlog-dropzone][data-drop-active]",
  );
  if (prev && prev !== zone) prev.removeAttribute("data-drop-active");
  if (zone) zone.setAttribute("data-drop-active", "");
}

/** 막대 위 글자용 — 배경 틴트가 옅어 원색 그대로는 대비가 모자란다. */
function shade(hex: string, factor: number) {
  const channel = (start: number) =>
    Math.round(parseInt(hex.slice(start, start + 2), 16) * factor);
  const hex2 = (value: number) => value.toString(16).padStart(2, "0");
  return `#${hex2(channel(1))}${hex2(channel(3))}${hex2(channel(5))}`;
}

/** 프로젝트 박스 — 그 프로젝트의 단계 줄과 할일 줄을 함께 감싼다. 이름 라벨을 누르면 상세로. */
function ProjectBoxItem({
  box,
  project,
  columns,
}: {
  box: ProjectBox;
  project: CalendarProject | undefined;
  columns: number;
}) {
  const color = project?.color ?? "#71717a";
  // 미배정("__unassigned__") 묶음은 실제 프로젝트가 아니라 상세 링크를 걸지 않는다.
  const isProject = box.project !== UNASSIGNED_BOX;

  return (
    <div
      // 박스는 색 밴드(시각)만 담당하고 클릭은 받지 않는다(pointer-events-none):
      //  - 본문을 누르면 아래 날짜 칸으로 클릭이 통과해 "이 프로젝트에 할일 추가"가 된다
      //    (소속 판정은 주 행 클릭 핸들러가 열·레인으로 한다).
      //  - HTML5 드롭도 박스에 막히지 않고 날짜 칸이 그대로 받는다.
      // 상세로 가는 링크는 아래 이름 라벨(pointer-events-auto)에만 둔다.
      className={cn(
        "pointer-events-none absolute block border",
        // 주 경계에서 잘린 면은 열어 둬야 다음 주로 이어진 한 범위로 읽힌다
        box.continuesLeft ? "border-l-0" : "rounded-l-[2px]",
        box.continuesRight ? "border-r-0" : "rounded-r-[2px]",
      )}
      style={{
        left: colLeft(box.col, columns),
        width: colWidth(box.span, columns),
        // 레인 블록에서 아래쪽 간격만큼을 덜어내 다음 박스와 붙지 않게 한다.
        top: laneTop(box.lane) - BOX_PAD_PX,
        height: box.lanes * LANE_PX - BOX_GAP_PX,
        backgroundColor: hexToRgba(color, 0.07),
        borderColor: hexToRgba(color, 0.3),
      }}
    >
      {/* 프로젝트 마감 라벨 — 범위가 끝나는 조각(더 이어지지 않는 조각)의 오른쪽
          아래에 붙인다. 그 조각의 마지막 날이 곧 프로젝트 마지막일이다.
          미배정 묶음은 프로젝트가 아니라 마감 개념이 없으므로 제외한다. */}
      {!box.continuesRight && isProject && (
        <span
          className="absolute bottom-0.5 right-1 rounded-[3px] px-1 py-px text-[8px] font-medium text-white"
          style={{ backgroundColor: hexToRgba(color, 0.75) }}
        >
          마감
        </span>
      )}
      {/* 프로젝트 이름은 범위가 시작하는 주에만 — 주마다 반복하지 않는다.
          라벨만 클릭을 받아(pointer-events-auto) 상세로 이동한다. */}
      {!box.continuesLeft &&
        project &&
        (isProject ? (
          <Link
            href={`/projects/${box.project}`}
            title={`${project.name} 상세 열기`}
            // a 기본 드래그를 끈다 — 잡아끌면 링크 이미지 드래그가 시작돼 거슬린다
            draggable={false}
            className="pointer-events-auto absolute right-1 top-0.5 max-w-[45%] truncate text-[9px] font-medium hover:underline"
            style={{ color: hexToRgba(color, 0.75) }}
          >
            {project.name}
          </Link>
        ) : (
          <span
            className="absolute right-1 top-0.5 max-w-[45%] truncate text-[9px] font-medium"
            style={{ color: hexToRgba(color, 0.75) }}
          >
            {project.name}
          </span>
        ))}
    </div>
  );
}

/** 날짜 칸을 눌렀을 때 뜨는 인라인 입력창 — Enter로 추가, Esc·포커스 이탈로 취소.
 *  그 날짜를 덮는 단계가 있으면 그 단계로, 없으면 프로젝트 백로그/미배정으로 만든다. */
function AddTaskInput({
  projectName,
  stages,
  fallbackColor,
  style,
  onSubmit,
  onCancel,
}: {
  /** 붙을 프로젝트 이름 — 없으면(미배정) 플레이스홀더가 "프로젝트 없음" */
  projectName: string | null;
  /** 그 날짜를 덮는 단계들(겹치면 여러 개). 비면 단계 없음(백로그/미배정). */
  stages: { stageId: string; label: string; color: string }[];
  /** 단계가 없을 때 점 색 — 프로젝트 색(미배정이면 회색) */
  fallbackColor: string;
  style: React.CSSProperties;
  onSubmit: (name: string, stageId: string | null) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  // 덮는 단계 중 선택된 것 — 기본은 최상단(첫) 단계. 여러 개면 아래 칩으로 바꾼다.
  const [stageId, setStageId] = useState<string | null>(
    stages[0]?.stageId ?? null,
  );
  const stage = stages.find((item) => item.stageId === stageId) ?? null;
  const dotColor = stage?.color ?? fallbackColor;
  const placeholder = stage
    ? `${stage.label}에 추가`
    : projectName
      ? `${projectName}에 추가`
      : "프로젝트 없음";
  // 그 날짜를 덮는 단계가 둘 이상이면 어디에 넣을지 고르게 한다.
  const choosable = stages.length >= 2;
  return (
    <div
      // 이 위 클릭이 주 행의 추가 핸들러로 다시 흘러가 입력창이 재생성되지 않게 막는다
      data-add-input
      onClick={(event) => event.stopPropagation()}
      className="absolute z-30 flex flex-col gap-1 rounded-[4px] border bg-popover px-1.5 py-1 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.12)]"
      style={style}
    >
      <div className="flex items-center gap-1">
        <span
          aria-hidden
          className="size-[8px] shrink-0 rounded-full"
          style={{ backgroundColor: dotColor }}
        />
        <input
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              const name = value.trim();
              if (name) onSubmit(name, stageId);
            } else if (event.key === "Escape") {
              onCancel();
            }
          }}
          // 다른 곳을 누르면 취소 — Enter로 추가하면 그 전에 언마운트되므로 blur가 안 겹친다.
          // 아래 단계 칩은 onMouseDown에서 기본 포커스 이동을 막아 여기 blur가 안 난다.
          onBlur={onCancel}
          placeholder={placeholder}
          className="w-full min-w-0 bg-transparent text-[11px] outline-none placeholder:text-muted-foreground"
        />
      </div>
      {/* 겹친 단계가 여럿이면 어느 단계에 넣을지 칩으로 고른다. 입력창 포커스를
          유지하려고 onMouseDown에서 기본 동작(포커스 이동)을 막고 선택만 바꾼다. */}
      {choosable && (
        <div className="flex flex-wrap gap-1">
          {stages.map((item) => {
            const selected = item.stageId === stageId;
            return (
              <button
                key={item.stageId}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  setStageId(item.stageId);
                }}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] transition-colors",
                  selected ? "font-medium" : "text-muted-foreground",
                )}
                style={
                  selected
                    ? {
                        borderColor: hexToRgba(item.color, 0.5),
                        backgroundColor: hexToRgba(item.color, 0.12),
                        color: shade(item.color, 0.6),
                      }
                    : undefined
                }
              >
                <span
                  aria-hidden
                  className="size-[7px] shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OverlayItem({
  overlay,
  columns,
  hoveredStageId,
  onHoverStage,
  onOpenStage,
  onOpenTask,
  onToggleTask,
  onDragStart,
}: {
  overlay: PlacedOverlay;
  columns: number;
  /** 주 경계로 잘린 조각들을 한 단계로 묶어 강조하기 위한 공유 호버 상태 */
  hoveredStageId?: string | null;
  onHoverStage?: (stageId: string | null) => void;
  onOpenStage?: (projectId: string, stageId: string) => void;
  onOpenTask?: (taskId: string) => void;
  /** 칩의 체크박스 — 상세를 열지 않고 완료를 토글한다 */
  onToggleTask?: (taskId: string) => void;
  onDragStart?: (event: React.PointerEvent, target: DragTarget) => void;
}) {
  const color = overlay.color;
  const text = shade(color, 0.6);
  const left = colLeft(overlay.col, columns);
  const width = colWidth(overlay.span, columns);

  if (overlay.kind === "stage") {
    const draggable = Boolean(onDragStart);
    // CSS :hover는 커서가 놓인 조각만 잡는다 — 같은 단계의 다른 주 조각까지
    // 함께 강조하려면 상태로 묶어야 한다
    const active = hoveredStageId === overlay.stageId;
    return (
      <div
        className="absolute"
        style={{
          left: `calc(${left} + 4px)`,
          width: `calc(${width} - 8px)`,
          top: laneTop(overlay.lane),
          height: STAGE_PX,
        }}
      >
        <button
          type="button"
          onPointerDown={(event) =>
            onDragStart?.(event, {
              kind: "stage",
              stageId: overlay.stageId,
              mode: "move",
            })
          }
          onClick={() => onOpenStage?.(overlay.project, overlay.stageId)}
          onPointerEnter={() => onHoverStage?.(overlay.stageId)}
          onPointerLeave={() => onHoverStage?.(null)}
          onFocus={() => onHoverStage?.(overlay.stageId)}
          onBlur={() => onHoverStage?.(null)}
          title={overlay.label}
          className={cn(
            "flex size-full items-center gap-1 overflow-hidden rounded-[4px] px-1 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2",
            active && "ring-1",
            draggable && "cursor-grab active:cursor-grabbing",
          )}
          style={{
            // 강조 시 배경도 함께 진해져 여러 주에 걸친 한 단계가 통으로 보인다
            backgroundColor: hexToRgba(color, active ? 0.3 : 0.18),
            // ring 색을 단계 색에 맞춘다 (임의 색 클래스 대신 CSS 변수)
            ["--tw-ring-color" as string]: hexToRgba(color, 0.8),
          }}
        >
          {/* 이름·개수는 단계가 시작하는 주에만 — 주마다 반복하면 같은 단계가
              여러 개인 것처럼 읽힌다 (프로젝트 이름과 같은 규칙) */}
          {overlay.startsHere && (
            <>
              <span
                aria-hidden
                className="flex size-[11px] shrink-0 items-center justify-center rounded-full text-[7.5px] font-medium text-white"
                style={{ backgroundColor: color }}
              >
                {overlay.stageNo}
              </span>
              <span
                className="truncate text-[10px] font-medium"
                style={{ color: text }}
              >
                {overlay.label}
              </span>
            </>
          )}
          {/* 데드라인 표시가 켜진 단계의 마감 라벨 */}
          {overlay.deadline && (
            <span
              className="ml-auto shrink-0 rounded-[3px] px-1.5 py-px text-[9px] font-medium text-white"
              style={{ backgroundColor: text }}
            >
              마감
            </span>
          )}
        </button>
        {/* 기간 조절 손잡이 — 실제 시작·종료가 든 조각에만 단다 */}
        {draggable && overlay.startsHere && (
          <div
            role="presentation"
            aria-label={`${overlay.label} 시작일 조절`}
            onPointerDown={(event) =>
              onDragStart?.(event, {
                kind: "stage",
                stageId: overlay.stageId,
                mode: "start",
              })
            }
            className="absolute inset-y-0 left-0 cursor-ew-resize rounded-l-[4px]"
            style={{ width: HANDLE_PX }}
          />
        )}
        {draggable && overlay.endsHere && (
          <div
            role="presentation"
            aria-label={`${overlay.label} 종료일 조절`}
            onPointerDown={(event) =>
              onDragStart?.(event, {
                kind: "stage",
                stageId: overlay.stageId,
                mode: "end",
              })
            }
            className="absolute inset-y-0 right-0 cursor-ew-resize rounded-r-[4px]"
            style={{ width: HANDLE_PX }}
          />
        )}
      </div>
    );
  }

  // 체크박스는 그 자리에서 완료를 토글하고, 나머지 영역은 상세를 연다.
  // 버튼 중첩은 불가능하므로 컨테이너를 두고 둘을 나란히 놓는다.
  // 드래그와 클릭의 구분은 캘린더 루트의 moved 플래그가 처리한다.
  return (
    <div
      title={overlay.late ? `${overlay.label} — 마감일이 지났습니다` : undefined}
      className={cn(
        "absolute flex items-center gap-1 overflow-hidden rounded-[4px] px-1",
        onDragStart && "cursor-grab active:cursor-grabbing",
        // 마감일을 넘겨 오늘로 밀려온 미완료 할일 — 붉은 링·틴트로 구분한다.
        // (late는 완료가 아닐 때만 세팅되므로 done 배경과 겹치지 않는다)
        overlay.late && "bg-destructive/10 ring-1 ring-inset ring-destructive/60",
      )}
      style={{
        left: `calc(${left} + 4px)`,
        width: `calc(${width} - 8px)`,
        top: laneTop(overlay.lane),
        height: TASK_PX,
        backgroundColor: overlay.done ? hexToRgba(text, 0.1) : undefined,
      }}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={Boolean(overlay.done)}
        aria-label={`${overlay.label} 완료`}
        // 읽기 전용(작업 현황)에서는 완료 토글을 주지 않는다 — 눌러도 아무 일이
        // 없는 컨트롤은 고장으로 읽히므로 아예 비활성으로 표시한다
        disabled={!onToggleTask}
        // 체크박스에서 시작한 포인터는 드래그로 넘기지 않는다 — 칩을 옮기려다
        // 완료가 눌리거나, 체크하려다 일정이 움직이는 일을 막는다
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onToggleTask?.(overlay.taskId);
        }}
        className={cn(
          "flex size-[11px] shrink-0 items-center justify-center rounded-[2px] text-[7px] text-white transition-shadow focus-visible:outline-none focus-visible:ring-2",
          !overlay.done && "border-[1.2px]",
          !onToggleTask && "cursor-default",
        )}
        style={{
          ...(overlay.done
            ? { backgroundColor: text }
            : { borderColor: text }),
          ["--tw-ring-color" as string]: hexToRgba(color, 0.8),
        }}
      >
        {overlay.done ? "✓" : ""}
      </button>
      {/* flex items-center로 제목을 세로 가운데 맞춘다. 그냥 두면 이 버튼이
          물려받은 큰 폰트 기준으로 라인박스가 잡히고, 10px 제목이 그 베이스라인에
          걸려 체크박스보다 아래로 내려간다 */}
      <button
        type="button"
        title={overlay.label}
        onPointerDown={(event) =>
          onDragStart?.(event, { kind: "task", taskId: overlay.taskId })
        }
        onClick={() => onOpenTask?.(overlay.taskId)}
        className="flex min-w-0 flex-1 items-center text-left transition-shadow hover:ring-1 focus-visible:outline-none focus-visible:ring-2"
        style={{ ["--tw-ring-color" as string]: hexToRgba(color, 0.8) }}
      >
        <span
          className={cn(
            // flex 아이템은 기본 min-width가 auto라 min-w-0 없이는 truncate가 먹지 않는다
            "min-w-0 flex-1 truncate text-[10px] font-medium",
            overlay.done && "line-through",
          )}
          style={{ color: overlay.done ? hexToRgba(text, 0.7) : text }}
        >
          {overlay.label}
        </span>
      </button>
    </div>
  );
}

export function MyWorkCalendar({
  grid,
  layouts,
  projects,
  onOpenStage,
  onOpenTask,
  onToggleTask,
  onDrag,
  onDropTask,
  onReturnToBacklog,
  onAddTask,
}: {
  grid: CalendarGrid;
  layouts: WeekLayout[];
  projects: Record<string, CalendarProject>;
  onOpenStage?: (projectId: string, stageId: string) => void;
  onOpenTask?: (taskId: string) => void;
  /** 캘린더 칩 체크박스로 완료 토글 */
  onToggleTask?: (taskId: string) => void;
  /** 드래그 중(move)에는 미리보기, 손을 뗄 때(commit) 저장한다 */
  onDrag?: (
    target: DragTarget,
    deltaDays: number,
    phase: StageDragPhase,
  ) => void;
  /** 백로그에서 끌어온 할일을 날짜 칸에 떨어뜨렸을 때 (HTML5 DnD) */
  onDropTask?: (taskId: string, date: string) => void;
  /** 캘린더 칩(할일)을 백로그 패널 위에서 손을 떼 백로그로 되돌릴 때 */
  onReturnToBacklog?: (taskId: string) => void;
  /** 빈 날짜 칸을 눌러 할일을 새로 만들 때. projectId=null이면 프로젝트 없음(미배정),
   *  stageId는 그 날짜를 덮는 단계(없으면 null=백로그/미배정). */
  onAddTask?: (
    projectId: string | null,
    stageId: string | null,
    date: string,
    name: string,
  ) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  // 백로그에서 끌어온 할일이 놓일 날짜 칸 — 어디에 떨어지는지 보이게 한다
  const [dropDate, setDropDate] = useState<string | null>(null);
  // 날짜 칸을 눌러 할일을 추가하는 중일 때, 입력창을 띄울 위치와 판정된 소속.
  const [adding, setAdding] = useState<{
    week: number;
    col: number;
    lane: number;
    date: string;
    projectId: string | null;
    /** 그 날짜(열)를 덮는 단계들(겹치면 여러 개). 비어 있으면 백로그/미배정. */
    stages: { stageId: string; label: string; color: string }[];
  } | null>(null);
  const weekRefs = useRef<(HTMLDivElement | null)[]>([]);
  // 주 경계로 잘린 단계 조각을 하나로 묶어 강조한다 (CSS :hover는 조각 단위)
  const [hoveredStageId, setHoveredStageId] = useState<string | null>(null);
  const dragRef = useRef<{
    target: DragTarget;
    pointerId: number;
    startDay: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);

  const columns = grid.columns;

  /**
   * 포인터가 놓인 위치의 그리드 일자를 **연속값**으로 돌려준다 (행 × columns + 열비율).
   * 행 높이가 제각각이라 세로는 행 사각형으로 행을 찾고, 가로는 칸 비율을 반올림 없이 쓴다.
   * 델타는 (지금 − 누른 위치)를 한 번만 반올림해 구하므로, 막대의 어느 지점을 잡든 앞뒤로
   * 한 칸 넘어가는 데 필요한 이동량이 같다(대칭). 예전엔 floor로 절대 칸을 써서 잡은 위치에
   * 따라 문턱이 달라졌고, 한쪽(특히 뒤로)으로 손쉽게 튀었다.
   */
  function pointerDay(clientX: number, clientY: number) {
    const rows = weekRefs.current;
    let weekIndex = 0;
    for (let index = 0; index < rows.length; index += 1) {
      const rect = rows[index]?.getBoundingClientRect();
      if (!rect) continue;
      if (clientY < rect.bottom) {
        weekIndex = index;
        break;
      }
      weekIndex = index; // 마지막 행 아래로 벗어나면 그 행으로 본다
    }
    const rect = rows[weekIndex]?.getBoundingClientRect();
    if (!rect) return 0;
    // 열은 자르지 않는다 — 행 좌우로 끌면 앞뒤 행으로 자연스럽게 넘어간다
    const colFraction = ((clientX - rect.left) / rect.width) * columns;
    const lastDay = rows.length * columns - 1;
    return Math.min(lastDay, Math.max(0, weekIndex * columns + colFraction));
  }

  function handleDragStart(event: React.PointerEvent, target: DragTarget) {
    if (!onDrag || event.button !== 0) return;
    event.stopPropagation();
    // 캡처는 임계값을 넘어 '드래그'로 확정될 때 건다. 여기서 바로 잡으면
    // click 이벤트가 캡처 대상(루트)으로 가버려 막대 클릭이 먹지 않는다.
    dragRef.current = {
      target,
      pointerId: event.pointerId,
      startDay: pointerDay(event.clientX, event.clientY),
      originX: event.clientX,
      originY: event.clientY,
      moved: false,
    };
  }

  function handlePointerMove(event: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || !onDrag) return;
    const far =
      Math.abs(event.clientX - drag.originX) > DRAG_THRESHOLD ||
      Math.abs(event.clientY - drag.originY) > DRAG_THRESHOLD;
    if (!far && !drag.moved) return;
    if (!drag.moved) {
      // 막대·칩은 드래그 중 주 경계를 넘거나 사라질 수 있다. 그 순간 언마운트되면
      // 거기 건 캡처는 끊기므로, 안정적인 캘린더 루트로 캡처를 잡는다.
      rootRef.current?.setPointerCapture(drag.pointerId);
    }
    drag.moved = true;
    // 할일 칩을 백로그 패널 위로 끌면 드롭존을 강조한다 (놓으면 백로그로 되돌림).
    if (onReturnToBacklog && drag.target.kind === "task") {
      highlightBacklog(backlogDropzoneAt(event.clientX, event.clientY));
    }
    // 이동량(지금 − 누른 위치)을 한 번만 반올림 → 대칭. 반 칸을 넘겨야 하루가 바뀐다.
    const delta = Math.round(pointerDay(event.clientX, event.clientY) - drag.startDay);
    onDrag(drag.target, delta, "move");
  }

  function handlePointerUp(event: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || !onDrag) return;
    dragRef.current = null;
    highlightBacklog(null);
    if (!drag.moved) {
      // 움직이지 않았으면 클릭 — 미리보기를 되돌리고 버튼 onClick에 맡긴다
      onDrag(drag.target, 0, "cancel");
      return;
    }
    // 할일 칩을 백로그 패널 위에서 손을 뗐으면 날짜 이동 대신 백로그로 되돌린다.
    if (
      onReturnToBacklog &&
      drag.target.kind === "task" &&
      backlogDropzoneAt(event.clientX, event.clientY)
    ) {
      onDrag(drag.target, 0, "cancel"); // 날짜 미리보기 되돌림
      onReturnToBacklog(drag.target.taskId);
      return;
    }
    const delta = Math.round(pointerDay(event.clientX, event.clientY) - drag.startDay);
    // 끌었다가 같은 날로 돌아오면(델타 0) 저장 없이 되돌린다.
    onDrag(drag.target, delta, delta === 0 ? "cancel" : "commit");
  }

  /**
   * 빈 칸을 눌러 그 날짜에 할일을 추가한다. 클릭 지점의 열=날짜, 레인=세로위치로
   * 프로젝트 박스를 찾아 소속을 정한다 — 박스 안이면 그 프로젝트, 밖이면 프로젝트 없음.
   */
  function handleAddClick(week: number, event: React.MouseEvent) {
    if (!onAddTask) return; // 읽기 전용(작업 현황)에서는 추가하지 않는다
    const target = event.target as HTMLElement;
    // 막대·칩·링크·입력창 등 실제 컨트롤 위 클릭은 그쪽이 처리한다
    if (target.closest("button, a, input, [data-add-input]")) return;
    const rect = weekRefs.current[week]?.getBoundingClientRect();
    if (!rect) return;
    const col = Math.min(
      columns - 1,
      Math.max(
        0,
        Math.floor(((event.clientX - rect.left) / rect.width) * columns),
      ),
    );
    // 달 밖(회색) 칸에는 추가하지 않는다 — 날짜 숫자가 없어 혼란스럽다
    if (grid.rows[week]?.[col] == null) return;
    const y = event.clientY - rect.top;
    // 날짜 숫자 영역(맨 위)은 어떤 박스도 덮지 않는다 → lane<0 = 소속 없음(미배정)
    const lane = y < DATE_ROW_PX ? -1 : Math.floor((y - DATE_ROW_PX) / LANE_PX);
    const box = layouts[week].boxes.find(
      (item) =>
        col >= item.col &&
        col < item.col + item.span &&
        lane >= item.lane &&
        lane < item.lane + item.lanes,
    );
    const projectId =
      !box || box.project === UNASSIGNED_BOX ? null : box.project;
    // 그 날짜(열)를 덮는 단계들 — 이 프로젝트의 단계 오버레이 중 클릭 열을 품은 것.
    // 겹쳐 그려진 단계가 여러 개면 모두 모은다(선택은 입력창에서).
    const stages: { stageId: string; label: string; color: string }[] = [];
    if (projectId) {
      const seen = new Set<string>();
      for (const overlay of layouts[week].overlays) {
        if (overlay.kind !== "stage" || overlay.project !== projectId) continue;
        if (col < overlay.col || col >= overlay.col + overlay.span) continue;
        if (seen.has(overlay.stageId)) continue;
        seen.add(overlay.stageId);
        stages.push({
          stageId: overlay.stageId,
          label: overlay.label,
          color: overlay.color,
        });
      }
    }
    setAdding({
      week,
      col,
      lane: Math.max(0, lane),
      date: shiftISO(grid.gridStart, week * columns + col),
      projectId,
      stages,
    });
  }

  return (
    <div
      ref={rootRef}
      // 캘린더는 6주를 항상 콘텐츠 크기(각 주 최소 WEEK_MIN_PX)대로 그린다. 예전엔
      // flex-1 + overflow-y-auto라 화면 높이·아래 요청 섹션에 눌려 주가 찌그러지거나
      // 몇 주만 보였다. 이제 캘린더가 온전히 커지고, 페이지가 넘치면 바깥(main)이 스크롤한다.
      // 가로는 잘라서 둥근 모서리 유지.
      className="flex w-full shrink-0 flex-col overflow-x-clip rounded-[10px] border bg-card"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      // 프로젝트 박스가 pointer-events-none이라 박스가 덮은 날짜 칸도 드롭을 그대로
      // 받는다. 캘린더 밖으로 나가면 드롭 표시만 지운다.
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setDropDate(null);
        }
      }}
    >
      {/* 세로 스크롤 시에도 요일 헤더는 위에 고정 — bg-card로 아래 내용을 가린다.
          일 보기(1열)면 그날 요일 하나만 나온다. */}
      <div className="sticky top-0 z-20 flex w-full shrink-0 bg-card">
        {gridWeekdayHeaders(grid).map((header, index) => (
          <div
            key={index}
            className={cn(
              "flex flex-1 justify-center border-b py-1.5 text-[11px] font-medium",
              index < grid.columns - 1 && "border-r",
              header.weekday === 0
                ? "text-[rgba(219,38,38,0.75)]"
                : header.weekday === 6
                  ? "text-[rgba(38,99,235,0.75)]"
                  : "text-muted-foreground",
            )}
          >
            {header.label}
          </div>
        ))}
      </div>
      {grid.rows.map((week, weekIndex) => {
        const { boxes, overlays, laneCount } = layouts[weekIndex];
        // 주 행은 flex-1이라, 화면이 낮으면 캘린더 공간을 균등 분할해 각 칸이
        // 납작해진다(빈 달은 59px까지 찌그러져 날짜·할일이 안 보였다). 내용 유무와
        // 무관하게 최소 높이를 보장해 압축을 막고, 6주가 넘치면 캘린더가 스크롤한다.
        // 콘텐츠 아래에 WEEK_PAD_LANES만큼 빈 레인을 더해, 박스가 채워진 주에도
        // 날짜 클릭으로 할일을 놓을 빈 공간이 남게 한다.
        const minHeight = Math.max(
          WEEK_MIN_PX,
          DATE_ROW_PX + (laneCount + WEEK_PAD_LANES) * LANE_PX + 8,
        );
        return (
          <div
            key={weekIndex}
            ref={(node) => {
              weekRefs.current[weekIndex] = node;
            }}
            onClick={(event) => handleAddClick(weekIndex, event)}
            className="relative flex w-full flex-1"
            style={{ minHeight }}
          >
            {week.map((date, dayIndex) => {
              const cellDate = shiftISO(
                grid.gridStart,
                weekIndex * columns + dayIndex,
              );
              const isToday = cellDate === grid.todayISO;
              return (
              <div
                key={dayIndex}
                onDragOver={(event) => {
                  if (!onDropTask || !isTaskDrag(event)) return;
                  event.preventDefault(); // 기본값은 '드롭 금지'
                  event.dataTransfer.dropEffect = "move";
                  setDropDate(cellDate);
                }}
                onDragLeave={(event) => {
                  if (event.currentTarget.contains(event.relatedTarget as Node)) {
                    return;
                  }
                  setDropDate((prev) => (prev === cellDate ? null : prev));
                }}
                onDrop={(event) => {
                  const taskId = getTaskDragData(event);
                  setDropDate(null);
                  if (!onDropTask || !taskId) return;
                  event.preventDefault();
                  onDropTask(taskId, cellDate);
                }}
                className={cn(
                  "flex-1 border-b px-2 pb-1 pt-1.5",
                  dayIndex < columns - 1 && "border-r",
                  // 날짜 칸은 눌러서 할일을 추가할 수 있다는 힌트
                  onAddTask && date !== null && "cursor-pointer",
                  date === null && "bg-muted",
                  date !== null && isToday && "bg-accent",
                  dropDate === cellDate && "bg-primary/10 ring-1 ring-inset ring-primary",
                )}
              >
                {date !== null && (
                  <span
                    className={cn(
                      "text-[11px] text-muted-foreground",
                      isToday && "font-medium text-foreground",
                    )}
                  >
                    {date}
                  </span>
                )}
              </div>
              );
            })}
            {boxes.map((box) => {
              // meta에 없는 묶음(미배정)은 박스(배경)를 그리지 않는다 — 칩만 뜬다.
              const project = projects[box.project];
              if (!project) return null;
              return (
                <ProjectBoxItem
                  key={box.project}
                  box={box}
                  project={project}
                  columns={columns}
                />
              );
            })}
            {overlays.map((overlay) => (
              <OverlayItem
                // 조각 단위로 안정된 키 — 인덱스 키는 드래그 중 재배치에서 엉킨다
                key={`${overlay.kind === "stage" ? overlay.stageId : overlay.taskId}:${overlay.col}`}
                overlay={overlay}
                columns={columns}
                hoveredStageId={hoveredStageId}
                onHoverStage={setHoveredStageId}
                onOpenStage={onOpenStage}
                onOpenTask={onOpenTask}
                onToggleTask={onToggleTask}
                onDragStart={onDrag ? handleDragStart : undefined}
              />
            ))}
            {adding?.week === weekIndex && onAddTask && (
              <AddTaskInput
                projectName={
                  adding.projectId
                    ? (projects[adding.projectId]?.name ?? null)
                    : null
                }
                stages={adding.stages}
                fallbackColor={
                  adding.projectId
                    ? (projects[adding.projectId]?.color ?? "#71717a")
                    : "#71717a"
                }
                style={{
                  left: colLeft(adding.col, columns),
                  top: laneTop(adding.lane),
                  // 오른쪽으로 넘치지 않게 최대 3칸까지만 넓힌다
                  width: colWidth(Math.min(3, columns - adding.col), columns),
                }}
                onSubmit={(name, stageId) => {
                  onAddTask(adding.projectId, stageId, adding.date, name);
                  setAdding(null);
                }}
                onCancel={() => setAdding(null)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
