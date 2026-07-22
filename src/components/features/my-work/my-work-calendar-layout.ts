// 내 작업 캘린더 오버레이의 레인(행) 배치 규칙.
// 데이터 출처와 무관한 순수 계산 — 어떤 소스가 오버레이를 만들든 같은 규칙을 쓴다.
//
// 규칙
//  1. 프로젝트 하나가 박스 하나 — 그 프로젝트의 단계와 할일을 모두 감싼다.
//  2. 박스 범위는 그리드 전체 기준으로 첫 항목 시작 ~ 마지막 항목 끝. 주 경계를 넘으면
//     잘라서 다음 주로 이어 그린다 (캘린더 앱의 여러 날짜 일정과 같은 방식).
//  3. 단계 줄은 단계 유무와 무관하게 항상 1줄 확보한다. 할일이 단계 자리로 올라오지 않는다.
//  4. 단계 막대는 그 한 줄로만 표현한다. 기간이 겹쳐도 나누지 않고 겹쳐 그린다.
//  5. 할일 칩은 단계 줄 아래에 붙고, 서로 겹칠 때만 줄을 나눈다.
//  6. 박스는 최소 2줄 — 단계 막대 두 개 두께. 할일이 2줄 이상이면 그만큼 두꺼워진다.
//  7. 레인은 주마다 채워지는 대로 쌓는다. 빈 레인을 예약하지 않는다.

import { DAYS_PER_WEEK } from "@/components/features/my-work/my-work-month";

type ColRange = { col: number; span: number };

/** 그리드 전체 기준 절대 일자 구간 [start, end) — `주 × 7 + 열` */
type DayRange = { start: number; end: number };

type OverlayBase = {
  week: number;
  col: number;
  span: number;
  /** 박스를 묶는 키 = Project.id */
  project: string;
  color: string;
  label: string;
};

export type CalOverlay =
  | (OverlayBase & {
      kind: "stage";
      stageId: string;
      count: number;
      deadline?: boolean;
      /** 이 조각에 단계의 실제 시작일이 들어 있다 — 시작 손잡이를 여기에만 단다 */
      startsHere?: boolean;
      /** 이 조각에 단계의 실제 종료일이 들어 있다 — 끝 손잡이를 여기에만 단다 */
      endsHere?: boolean;
    })
  // 할일 칩 — Task에 예정일이 생기면 이 종류로 만든다.
  | (OverlayBase & { kind: "task"; taskId: string; done?: boolean });

export type PlacedOverlay = CalOverlay & { lane: number };

export type ProjectBox = ColRange & {
  project: string;
  /** 박스가 시작하는 레인 */
  lane: number;
  /** 박스가 차지하는 레인 수 — 단계 줄 1 + 할일 줄, 최소 2 */
  lanes: number;
  /** 이 주의 할일 줄 수. 박스 안 구분선 위치 계산에 쓴다. */
  taskLanes: number;
  /** 앞 주에서 이어짐 — 왼쪽 면을 열어 둔다 */
  continuesLeft: boolean;
  /** 다음 주로 이어짐 — 오른쪽 면을 열어 둔다 */
  continuesRight: boolean;
};

export type WeekLayout = {
  boxes: ProjectBox[];
  overlays: PlacedOverlay[];
  laneCount: number;
};

function overlaps(a: ColRange, b: ColRange) {
  return a.col < b.col + b.span && b.col < a.col + a.span;
}

function dayStart(overlay: CalOverlay) {
  return overlay.week * DAYS_PER_WEEK + overlay.col;
}

/** 단계 줄은 단계가 없어도 자리를 잡는다 — 할일이 단계 자리로 올라오지 않게. */
const STAGE_LANES = 1;

/** 박스 최소 높이 — 단계 막대 두 개 두께. */
const MIN_BOX_LANES = 2;

/** 렌더 순서 — 단계 → 할일. 같은 종류면 긴 막대를 먼저 그려야 짧은 막대가 위에 겹쳐 보인다. */
const KIND_ORDER: Record<CalOverlay["kind"], number> = { stage: 0, task: 1 };

/** 프로젝트별 전체 기간 — 단계든 할일이든 가장 이른 시작부터 가장 늦은 끝까지. */
function collectProjectRanges(overlays: CalOverlay[]) {
  const ranges = new Map<string, DayRange>();
  for (const overlay of overlays) {
    const start = dayStart(overlay);
    const end = start + overlay.span;
    const current = ranges.get(overlay.project);
    if (!current) {
      ranges.set(overlay.project, { start, end });
      continue;
    }
    current.start = Math.min(current.start, start);
    current.end = Math.max(current.end, end);
  }
  return ranges;
}

function layoutWeek(
  weekIndex: number,
  overlays: CalOverlay[],
  projectRanges: Map<string, DayRange>,
): WeekLayout {
  const weekStart = weekIndex * DAYS_PER_WEEK;
  const weekEnd = weekStart + DAYS_PER_WEEK;

  // 이 주에 걸치는 프로젝트 — 항목이 이 주에 없어도 기간이 지나가면 박스가 이어진다.
  // 시작이 이른 것부터, 같으면 긴 것부터 앉힌다 (데이터 순서와 무관하게 결과가 안정적이도록).
  const active = [...projectRanges.entries()]
    .filter(([, range]) => range.start < weekEnd && weekStart < range.end)
    .sort(
      ([, a], [, b]) => a.start - b.start || b.end - b.start - (a.end - a.start),
    );

  const lanes: ColRange[][] = [];

  /** 열 범위가 비는 연속 레인 구간을 찾아 박스를 앉히고 시작 레인을 돌려준다. */
  function placeBlock(range: ColRange, height: number) {
    for (let start = 0; ; start += 1) {
      const free = Array.from({ length: height }, (_, i) => lanes[start + i]).every(
        (lane) => !lane || lane.every((placed) => !overlaps(placed, range)),
      );
      if (!free) continue;
      for (let i = start; i < start + height; i += 1) {
        (lanes[i] ??= []).push(range);
      }
      return start;
    }
  }

  const boxes: ProjectBox[] = [];
  const overlayLane = new Map<CalOverlay, number>();

  for (const [project, projectRange] of active) {
    const own = overlays.filter((overlay) => overlay.project === project);
    const stages = own.filter((overlay) => overlay.kind === "stage");
    const tasks = own.filter((overlay) => overlay.kind === "task");

    // 단계는 몇 개든 한 줄. 할일은 열이 겹칠 때만 줄을 나눈다.
    const taskLanes: ColRange[][] = [];
    const taskLaneOf = new Map<CalOverlay, number>();
    for (const task of tasks) {
      const range = { col: task.col, span: task.span };
      let lane = taskLanes.findIndex((placed) =>
        placed.every((other) => !overlaps(other, range)),
      );
      if (lane === -1) {
        lane = taskLanes.length;
        taskLanes.push([]);
      }
      taskLanes[lane].push(range);
      taskLaneOf.set(task, lane);
    }

    // 프로젝트 기간을 이 주로 잘라낸다.
    const clippedStart = Math.max(projectRange.start, weekStart);
    const clippedEnd = Math.min(projectRange.end, weekEnd);
    const range: ColRange = {
      col: clippedStart - weekStart,
      span: clippedEnd - clippedStart,
    };

    // 단계 줄 1 + 할일 줄, 단 단계 막대 두 개 두께(2줄)보다 얇아지지 않는다.
    const height = Math.max(MIN_BOX_LANES, STAGE_LANES + taskLanes.length);
    const lane = placeBlock(range, height);

    boxes.push({
      ...range,
      project,
      lane,
      lanes: height,
      taskLanes: taskLanes.length,
      continuesLeft: projectRange.start < weekStart,
      continuesRight: projectRange.end > weekEnd,
    });

    for (const stage of stages) overlayLane.set(stage, lane);
    for (const task of tasks) {
      overlayLane.set(task, lane + STAGE_LANES + taskLaneOf.get(task)!);
    }
  }

  const placed = overlays
    .map<PlacedOverlay>((overlay) => ({ ...overlay, lane: overlayLane.get(overlay)! }))
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || b.span - a.span);

  return { boxes, overlays: placed, laneCount: lanes.length };
}

/** 주차별 배치 결과 — 캘린더는 이 값만 읽는다. */
export function buildWeekLayouts(
  overlays: CalOverlay[],
  weekCount: number,
): WeekLayout[] {
  const projectRanges = collectProjectRanges(overlays);
  return Array.from({ length: weekCount }, (_, weekIndex) =>
    layoutWeek(
      weekIndex,
      overlays.filter((overlay) => overlay.week === weekIndex),
      projectRanges,
    ),
  );
}
