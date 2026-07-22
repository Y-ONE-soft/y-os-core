// 내 작업 캘린더 오버레이의 레인(행) 배치 규칙.
// 자리표시 데이터를 DB로 교체해도 이 배치 규칙은 그대로 재사용한다.
//
// 규칙
//  1. 프로젝트 하나가 박스 하나 — 그 프로젝트의 단계와 할일을 모두 감싼다.
//  2. 단계 줄은 단계 유무와 무관하게 항상 1줄 확보한다. 할일이 단계 자리로 올라오지 않는다.
//  3. 단계 막대는 그 한 줄로만 표현한다. 기간이 겹쳐도 나누지 않고 겹쳐 그린다.
//  4. 할일 칩은 단계 줄 아래에 붙고, 서로 겹칠 때만 줄을 나눈다.
//  5. 박스는 최소 2줄 — 단계 막대 두 개 두께. 할일이 2줄 이상이면 그만큼 두꺼워진다.
//  6. 서로 다른 프로젝트는 열 범위가 겹칠 때만 위아래로 갈라진다.

import {
  CAL_OVERLAYS,
  PROJECT_BOX_LABELS,
  WEEKS,
  type CalOverlay,
} from "@/components/features/my-work/my-work-data";

type ColRange = { col: number; span: number };

export type PlacedOverlay = CalOverlay & { lane: number };

export type ProjectBox = ColRange & {
  project: string;
  /** 박스가 시작하는 레인 */
  lane: number;
  /** 박스가 차지하는 레인 수 — 단계 줄 1 + 할일 줄, 최소 2 */
  lanes: number;
  /** 할일 줄 수. 박스 안 구분선 위치 계산에 쓴다. */
  taskLanes: number;
  label?: string;
};

export type WeekLayout = {
  boxes: ProjectBox[];
  overlays: PlacedOverlay[];
  laneCount: number;
};

function overlaps(a: ColRange, b: ColRange) {
  return a.col < b.col + b.span && b.col < a.col + a.span;
}

function union(a: ColRange, b: ColRange): ColRange {
  const col = Math.min(a.col, b.col);
  const end = Math.max(a.col + a.span, b.col + b.span);
  return { col, span: end - col };
}

/** 단계 줄은 단계가 없어도 자리를 잡는다 — 할일이 단계 자리로 올라오지 않게. */
const STAGE_LANES = 1;

/** 박스 최소 높이 — 단계 막대 두 개 두께. */
const MIN_BOX_LANES = 2;

/** 렌더 순서 — 단계 → 할일. 같은 종류면 긴 막대를 먼저 그려야 짧은 막대가 위에 겹쳐 보인다. */
const KIND_ORDER: Record<CalOverlay["kind"], number> = { stage: 0, task: 1 };

function layoutWeek(weekIndex: number, overlays: CalOverlay[]): WeekLayout {
  // 프로젝트별로 묶는다 — 등장 순서를 유지해야 배치가 데이터 순서와 어긋나지 않는다.
  const projectOrder: string[] = [];
  const members = new Map<string, CalOverlay[]>();
  for (const overlay of overlays) {
    const list = members.get(overlay.project);
    if (list) {
      list.push(overlay);
      continue;
    }
    projectOrder.push(overlay.project);
    members.set(overlay.project, [overlay]);
  }

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

  for (const project of projectOrder) {
    const own = members.get(project)!;
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

    const range = own
      .map<ColRange>((overlay) => ({ col: overlay.col, span: overlay.span }))
      .reduce(union);
    // 단계 줄 1 + 할일 줄, 단 단계 막대 두 개 두께(2줄)보다 얇아지지 않는다.
    const height = Math.max(MIN_BOX_LANES, STAGE_LANES + taskLanes.length);
    const lane = placeBlock(range, height);

    boxes.push({
      ...range,
      project,
      lane,
      lanes: height,
      taskLanes: taskLanes.length,
      label: PROJECT_BOX_LABELS.find(
        (entry) => entry.week === weekIndex && entry.project === project,
      )?.label,
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
export const CAL_WEEK_LAYOUTS: WeekLayout[] = WEEKS.map((_, weekIndex) =>
  layoutWeek(
    weekIndex,
    CAL_OVERLAYS.filter((overlay) => overlay.week === weekIndex),
  ),
);
