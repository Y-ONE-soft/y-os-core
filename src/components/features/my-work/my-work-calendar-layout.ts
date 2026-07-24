// 내 할일 캘린더 오버레이의 레인(행) 배치 규칙.
// 데이터 출처와 무관한 순수 계산 — 어떤 소스가 오버레이를 만들든 같은 규칙을 쓴다.
//
// 규칙
//  1. 프로젝트 하나가 박스 하나 — 그 프로젝트의 단계와 할일을 모두 감싼다.
//  2. 박스 범위는 그리드 전체 기준으로 첫 항목 시작 ~ 마지막 항목 끝. 주 경계를 넘으면
//     잘라서 다음 주로 이어 그린다 (캘린더 앱의 여러 날짜 일정과 같은 방식).
//  3. 단계 줄은 단계 유무와 무관하게 항상 최소 1줄 확보한다. 할일이 단계 자리로 올라오지 않는다.
//  4. 단계 막대도 기간이 겹치면 줄을 나눠 쌓는다(할일과 같은 규칙). 한 줄에 겹쳐 그리면
//     뒤 단계가 앞 단계를 가려, 가려진 단계를 클릭·드래그할 수 없다. 레인은 그리드 전체
//     기준으로 배정해 한 단계가 여러 주에 걸쳐도 같은 줄에 머문다.
//  5. 할일 칩은 단계 줄들 아래에 붙고, 서로 겹칠 때만 줄을 나눈다.
//  6. 박스는 최소 2줄 — 단계 막대 두 개 두께. 할일이 2줄 이상이면 그만큼 두꺼워진다.
//  7. 레인은 주마다 채워지는 대로 쌓는다. 빈 레인을 예약하지 않는다.

/**
 * 프로젝트 없는(미배정) 할일 칩을 표시하는 배치 키.
 * 실제 프로젝트가 아니므로 박스로 묶지 않는다 — 이 키를 가진 칩은 박스 배치에서
 * 빠지고, 그 날짜 열이 비는 첫 레인에 하나씩 자유 배치된다(별도 영역을 만들지 않음).
 */
export const UNASSIGNED_BOX = "__unassigned__";

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
      /** 배지에 표시하는 단계 순번 (1-based, 그 프로젝트 보드 기준) */
      stageNo: number;
      deadline?: boolean;
      /** 이 조각에 단계의 실제 시작일이 들어 있다 — 시작 손잡이를 여기에만 단다 */
      startsHere?: boolean;
      /** 이 조각에 단계의 실제 종료일이 들어 있다 — 끝 손잡이를 여기에만 단다 */
      endsHere?: boolean;
    })
  // 할일 칩 — Task에 예정일이 생기면 이 종류로 만든다.
  // late = 마감일을 넘겨 자동 이월된 미완료 할일(예정일 > 마감일). 캘린더에서 강조한다.
  | (OverlayBase & {
      kind: "task";
      taskId: string;
      done?: boolean;
      late?: boolean;
    });

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

function dayStart(overlay: CalOverlay, columns: number) {
  return overlay.week * columns + overlay.col;
}

/** 단계 줄 최소 수 — 단계가 없어도 1줄은 잡아 할일이 단계 자리로 올라오지 않게. */
const STAGE_LANES = 1;

/**
 * 프로젝트별 단계 레인 배정. 겹치는 단계는 서로 다른 줄에 두어 가려지지 않게 한다.
 * 레인은 **그리드 전체 구간** 기준으로 배정하므로, 한 단계가 여러 주에 걸쳐도 같은 줄에 머문다.
 * (주마다 배정하면 주 경계에서 막대가 위아래로 튄다.)
 */
function assignStageLanes(overlays: CalOverlay[], columns: number) {
  // 단계별 전역 구간 [start, end) — 여러 주 조각을 하나로 합친다.
  const byStage = new Map<string, { project: string; start: number; end: number }>();
  for (const overlay of overlays) {
    if (overlay.kind !== "stage") continue;
    const start = dayStart(overlay, columns);
    const end = start + overlay.span;
    const current = byStage.get(overlay.stageId);
    if (!current) {
      byStage.set(overlay.stageId, { project: overlay.project, start, end });
    } else {
      current.start = Math.min(current.start, start);
      current.end = Math.max(current.end, end);
    }
  }

  const byProject = new Map<
    string,
    { stageId: string; start: number; end: number }[]
  >();
  for (const [stageId, range] of byStage) {
    const list = byProject.get(range.project) ?? [];
    list.push({ stageId, start: range.start, end: range.end });
    byProject.set(range.project, list);
  }

  const laneOf = new Map<string, number>(); // stageId → 레인
  const laneCountOf = new Map<string, number>(); // project → 단계 레인 수(최소 1)
  for (const [project, list] of byProject) {
    // 시작이 이른 것부터, 같으면 긴 것부터 — 그리디 구간 분할이 안정적이도록.
    list.sort((a, b) => a.start - b.start || b.end - a.end);
    const laneEnd: number[] = []; // 각 레인이 마지막으로 찬 지점(다음은 그 이후에만)
    for (const stage of list) {
      let lane = laneEnd.findIndex((end) => end <= stage.start);
      if (lane === -1) {
        lane = laneEnd.length;
        laneEnd.push(0);
      }
      laneEnd[lane] = stage.end;
      laneOf.set(stage.stageId, lane);
    }
    laneCountOf.set(project, Math.max(STAGE_LANES, laneEnd.length));
  }
  return { laneOf, laneCountOf };
}

/** 박스 최소 높이 — 단계 막대 두 개 두께. */
const MIN_BOX_LANES = 2;

/** 렌더 순서 — 단계 → 할일. 같은 종류면 긴 막대를 먼저 그려야 짧은 막대가 위에 겹쳐 보인다. */
const KIND_ORDER: Record<CalOverlay["kind"], number> = { stage: 0, task: 1 };

/** 프로젝트별 전체 기간 — 단계든 할일이든 가장 이른 시작부터 가장 늦은 끝까지. */
function collectProjectRanges(overlays: CalOverlay[], columns: number) {
  const ranges = new Map<string, DayRange>();
  for (const overlay of overlays) {
    const start = dayStart(overlay, columns);
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
  stageLanes: ReturnType<typeof assignStageLanes>,
  columns: number,
): WeekLayout {
  const weekStart = weekIndex * columns;
  const weekEnd = weekStart + columns;

  // 이 주에 걸치는 프로젝트 — 항목이 이 주에 없어도 기간이 지나가면 박스가 이어진다.
  // 시작이 이른 것부터, 같으면 긴 것부터 앉힌다 (데이터 순서와 무관하게 결과가 안정적이도록).
  // 미배정 칩은 박스로 묶지 않는다 — 박스 배치 뒤 빈 레인에 하나씩 따로 앉힌다.
  const active = [...projectRanges.entries()]
    .filter(([project]) => project !== UNASSIGNED_BOX)
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

    // 겹치는 단계만큼 단계 줄 수가 늘어난다(전역 배정). 그 아래 할일 줄, 최소 2줄.
    const stageLaneCount = stageLanes.laneCountOf.get(project) ?? STAGE_LANES;
    const height = Math.max(MIN_BOX_LANES, stageLaneCount + taskLanes.length);
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

    // 단계는 전역 배정된 줄에(겹치면 서로 다른 줄), 할일은 단계 줄들 아래에 놓는다.
    for (const stage of stages) {
      overlayLane.set(
        stage,
        lane + (stageLanes.laneOf.get(stage.stageId) ?? 0),
      );
    }
    for (const task of tasks) {
      overlayLane.set(task, lane + stageLaneCount + taskLaneOf.get(task)!);
    }
  }

  // 미배정 칩 — 박스 없이, 그 날짜 열이 비는 첫 레인에 하나씩 앉힌다. 프로젝트 박스가
  // 이미 레인을 잡았으므로 그 아래 빈 레인으로 자연히 채워지고, 프로젝트가 없는 날은
  // 맨 위 레인부터 쓴다. 별도로 예약된 영역(빈 단계줄·최소 높이)을 만들지 않는다.
  for (const chip of overlays) {
    if (chip.project !== UNASSIGNED_BOX) continue;
    const range: ColRange = { col: chip.col, span: chip.span };
    let lane = 0;
    while (lanes[lane]?.some((placed) => overlaps(placed, range))) lane += 1;
    (lanes[lane] ??= []).push(range);
    overlayLane.set(chip, lane);
  }

  const placed = overlays
    .map<PlacedOverlay>((overlay) => ({ ...overlay, lane: overlayLane.get(overlay)! }))
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || b.span - a.span);

  return { boxes, overlays: placed, laneCount: lanes.length };
}

/** 행(주)별 배치 결과 — 캘린더는 이 값만 읽는다. columns는 한 행의 칸 수(일=1, 주·월=7). */
export function buildWeekLayouts(
  overlays: CalOverlay[],
  rowCount: number,
  columns: number,
): WeekLayout[] {
  const projectRanges = collectProjectRanges(overlays, columns);
  const stageLanes = assignStageLanes(overlays, columns);
  return Array.from({ length: rowCount }, (_, weekIndex) =>
    layoutWeek(
      weekIndex,
      overlays.filter((overlay) => overlay.week === weekIndex),
      projectRanges,
      stageLanes,
      columns,
    ),
  );
}
