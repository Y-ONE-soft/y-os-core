// 내 작업 캘린더 오버레이의 레인(행) 배치 규칙.
// 자리표시 데이터를 DB로 교체해도 이 배치 규칙은 그대로 재사용한다.
//
// 규칙
//  1. 같은 프로젝트의 단계 막대는 기간이 겹쳐도 한 레인에 겹쳐 그린다 (두 줄로 나누지 않는다).
//  2. 서로 다른 프로젝트는 열 범위가 겹칠 때만 레인을 나눈다.
//  3. 작업 칩은 프로젝트 레인을 배치한 뒤 빈 자리에 채운다.

import { CAL_OVERLAYS, WEEKS, type CalOverlay } from "@/components/features/my-work/my-work-data";

type ColRange = { col: number; span: number };

export type PlacedOverlay = CalOverlay & { lane: number };

export type WeekLayout = {
  overlays: PlacedOverlay[];
  laneCount: number;
};

function overlaps(a: ColRange, b: ColRange) {
  return a.col < b.col + b.span && b.col < a.col + a.span;
}

/** 렌더 순서 — 배경 → 단계 → 작업 칩. 같은 종류면 긴 막대를 먼저 그려야 짧은 막대가 위에 겹쳐 보인다. */
const KIND_ORDER: Record<CalOverlay["kind"], number> = {
  projectBg: 0,
  stage: 1,
  task: 2,
};

function layoutWeek(overlays: CalOverlay[]): WeekLayout {
  const lanes: ColRange[][] = [];

  /** 열 범위가 비는 첫 레인에 넣고 그 레인 번호를 돌려준다. */
  function place(range: ColRange) {
    for (let lane = 0; lane < lanes.length; lane += 1) {
      if (lanes[lane].every((placed) => !overlaps(placed, range))) {
        lanes[lane].push(range);
        return lane;
      }
    }
    lanes.push([range]);
    return lanes.length - 1;
  }

  // 프로젝트별로 단계·배경을 아우르는 열 범위를 먼저 구한다.
  const projectOrder: string[] = [];
  const projectRange = new Map<string, ColRange>();
  for (const overlay of overlays) {
    if (overlay.kind === "task") continue;
    const current = projectRange.get(overlay.project);
    if (!current) {
      projectOrder.push(overlay.project);
      projectRange.set(overlay.project, { col: overlay.col, span: overlay.span });
      continue;
    }
    const start = Math.min(current.col, overlay.col);
    const end = Math.max(current.col + current.span, overlay.col + overlay.span);
    current.col = start;
    current.span = end - start;
  }

  // 프로젝트 1개 = 레인 1개. 그 프로젝트의 단계는 전부 이 레인에 겹친다.
  const projectLane = new Map<string, number>();
  for (const project of projectOrder) {
    projectLane.set(project, place(projectRange.get(project)!));
  }

  const taskLane = new Map<CalOverlay, number>();
  for (const overlay of overlays) {
    if (overlay.kind !== "task") continue;
    taskLane.set(overlay, place({ col: overlay.col, span: overlay.span }));
  }

  const placed = overlays.map<PlacedOverlay>((overlay) => ({
    ...overlay,
    lane: overlay.kind === "task" ? taskLane.get(overlay)! : projectLane.get(overlay.project)!,
  }));

  placed.sort(
    (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || b.span - a.span,
  );

  return { overlays: placed, laneCount: lanes.length };
}

/** 주차별 배치 결과 — 캘린더는 이 값만 읽는다. */
export const CAL_WEEK_LAYOUTS: WeekLayout[] = WEEKS.map((_, weekIndex) =>
  layoutWeek(CAL_OVERLAYS.filter((overlay) => overlay.week === weekIndex)),
);
