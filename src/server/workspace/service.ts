import { db } from "@/server/db";
import { addDaysISO } from "@/lib/stage-plan";
import { workspaceSeedRows } from "@/server/workspace/seed-data";
import type {
  BoardStage,
  BoardTask,
  ProjectBoardData,
  Workspace,
  WorkspaceMember,
} from "@/types/workspace";
import type {
  Prisma,
  Stage,
  StageComment,
  Task,
} from "@/generated/prisma/client";

const ORDER = [{ createdAt: "asc" as const }, { id: "asc" as const }];
/**
 * 단계는 생성 시각이 아니라 명시적인 order로 정렬한다.
 * 화면의 단계 번호(1, 2, 3…)가 곧 이 배열의 순서다.
 */
const STAGE_ORDER = [{ order: "asc" as const }, { id: "asc" as const }];

/**
 * 화면에 사람을 그리는 데 필요한 최소 정보만 추린다.
 * User 전체를 내려보내면 passwordHash 같은 필드가 딸려 나간다.
 */
function toMember(user: {
  id: string;
  name: string;
  title: string | null;
}): WorkspaceMember {
  return { id: user.id, name: user.name, title: user.title ?? undefined };
}

/** 대상(할일·단계)별 수락된 공동 작업자 — 대상 id → 사람 목록 */
type CollaboratorMap = Map<string, WorkspaceMember[]>;

function toTask(
  task: Task & { assignee?: { id: string; name: string; title: string | null } | null },
  collaborators?: CollaboratorMap,
): BoardTask {
  return {
    id: task.id,
    name: task.name,
    done: task.done,
    description: task.description ?? undefined,
    scheduledDate: task.scheduledDate ?? undefined,
    deadline: task.deadline ?? undefined,
    completedDate: task.completedDate ?? undefined,
    assigneeId: task.assigneeId ?? undefined,
    assignee: task.assignee ? toMember(task.assignee) : undefined,
    collaborators: collaborators?.get(task.id),
  };
}

function toStage(
  stage: Stage & {
    tasks: (Task & {
      assignee?: { id: string; name: string; title: string | null } | null;
    })[];
    comments: StageComment[];
  },
  collaborators?: CollaboratorMap,
): BoardStage {
  return {
    id: stage.id,
    name: stage.name,
    color: stage.color,
    startDate: stage.startDate ?? undefined,
    endDate: stage.endDate ?? undefined,
    showDeadline: stage.showDeadline,
    done: stage.done,
    description: stage.description ?? undefined,
    requestedCollaborators: stage.requestedCollaborators,
    createdAt: stage.createdAt.toISOString(),
    updatedAt: stage.updatedAt.toISOString(),
    comments: stage.comments.map((comment) => ({
      id: comment.id,
      author: comment.author,
      text: comment.text,
      at: comment.createdAt.toISOString(),
    })),
    collaborators: collaborators?.get(stage.id),
    tasks: stage.tasks.map((task) => toTask(task, collaborators)),
  };
}

/** 화면에 사람을 그릴 때 필요한 필드만 — User 전체를 include하지 않는다 */
const MEMBER_SELECT = { id: true, name: true, title: true } as const;

/**
 * 수락된 공동 작업자 지정 요청을 대상 id별로 묶는다.
 * 요청 도메인의 진실은 Request 테이블이므로(Stage.requestedCollaborators는
 * 요청을 보내기 전 선택값이라 다른 값이다) 여기서 직접 조회한다.
 */
async function acceptedCollaborators(): Promise<CollaboratorMap> {
  const accepted = await db.request.findMany({
    where: { kind: "ASSIGN", status: "ACCEPTED" },
    select: { taskId: true, stageId: true, toUser: { select: MEMBER_SELECT } },
    orderBy: { respondedAt: "asc" },
  });

  const map: CollaboratorMap = new Map();
  for (const request of accepted) {
    const targetId = request.taskId ?? request.stageId;
    if (!targetId) continue;
    const list = map.get(targetId) ?? [];
    // 같은 사람이 여러 번 수락된 이력이 있어도 한 번만 보여준다
    if (!list.some((member) => member.id === request.toUser.id)) {
      list.push(toMember(request.toUser));
    }
    map.set(targetId, list);
  }
  return map;
}

/** 전체 워크스페이스 트리 — 스토어 부트스트랩 1회 호출용 */
/**
 * 미완료 할일의 지난 예정일을 오늘로 이월한다 — 크론 대신 조회 시점에 한 번 보정한다.
 * 마감일(deadline)은 건드리지 않으므로 그만큼 "미뤄진 일수"가 벌어진다.
 * YYYY-MM-DD 문자열은 사전순 = 날짜순이라 문자열 비교로 지난 것을 고를 수 있다.
 */
async function rollOverOverdueTasks(): Promise<void> {
  const today = todayISO();
  await db.task.updateMany({
    where: { done: false, scheduledDate: { not: null, lt: today } },
    data: { scheduledDate: today },
  });
}

/** "{이름}의 공통 작업" 기본 프로젝트 색 — 옛 미배정과 같은 회색으로 개인 공간임을 나타낸다 */
const COMMON_PROJECT_COLOR = "#71717a";

/**
 * 계정별 기본 프로젝트 "{이름}의 공통 작업"을 보장하고, 옛 미배정 할일을 이관한다.
 * 앱에 계정 생성 훅이 없어(시드로만 생성) 워크스페이스 로드 시점에 자가치유로 처리한다 —
 * 백필(기존 계정)·신규 계정 자동 보장·미배정 이관을 한 번에.
 *  1. 기본 프로젝트가 없는 사용자(그룹 있는)에게 생성. id를 결정적(p-default-<userId>)으로
 *     두고 createMany skipDuplicates로 동시 로드 시 중복 생성을 막는다.
 *  2. 미배정(projectId=null) 할일을 그 할일 담당자의 공통 작업으로 이관(담당자 없는 건 유지).
 *     정상 상태에선 대상이 없어(신규 느슨한 할일은 처음부터 공통 작업에 생성) 매번 값싸게 끝난다.
 */
export async function ensureDefaultProjects(): Promise<void> {
  const missing = await db.user.findMany({
    where: { groupId: { not: null }, ownedProjects: { none: { isDefault: true } } },
    select: { id: true, name: true, groupId: true },
  });
  if (missing.length > 0) {
    await db.project.createMany({
      data: missing.map((user) => ({
        id: `p-default-${user.id}`,
        name: `${user.name}의 공통 작업`,
        color: COMMON_PROJECT_COLOR,
        groupId: user.groupId as string,
        ownerId: user.id,
        isDefault: true,
      })),
      skipDuplicates: true,
    });
  }

  // 담당자 있는 미배정 할일이 있을 때만 이관한다 — 정상 상태에선 0건이라 count로 건너뛴다.
  const orphanCount = await db.task.count({
    where: { projectId: null, assigneeId: { not: null } },
  });
  if (orphanCount > 0) {
    const defaults = await db.project.findMany({
      where: { isDefault: true, ownerId: { not: null } },
      select: { id: true, ownerId: true },
    });
    for (const project of defaults) {
      await db.task.updateMany({
        where: { projectId: null, assigneeId: project.ownerId },
        data: { projectId: project.id },
      });
    }
  }
}

export async function getWorkspace(): Promise<Workspace> {
  // 읽기 전에 (1) 계정별 공통 작업 보장·미배정 이관, (2) 지난 예정일 이월을 먼저 반영한다.
  await ensureDefaultProjects();
  // 워크스페이스 스냅샷을 읽기 전에 이월을 먼저 반영해, 조회 결과가 곧 오늘 기준이 되게 한다.
  await rollOverOverdueTasks();
  const [groups, projects, stages, backlogTasks, collaborators] =
    await Promise.all([
      db.projectGroup.findMany({ orderBy: ORDER }),
      db.project.findMany({
        orderBy: ORDER,
        include: { owner: { select: MEMBER_SELECT } },
      }),
      db.stage.findMany({
        orderBy: STAGE_ORDER,
        include: {
          tasks: {
            orderBy: ORDER,
            include: { assignee: { select: MEMBER_SELECT } },
          },
          comments: { orderBy: ORDER },
        },
      }),
      db.task.findMany({
        where: { stageId: null },
        orderBy: ORDER,
        include: { assignee: { select: MEMBER_SELECT } },
      }),
      acceptedCollaborators(),
    ]);

  const boards: Record<string, ProjectBoardData> = {};
  for (const project of projects) boards[project.id] = { stages: [], backlog: [] };
  for (const stage of stages)
    boards[stage.projectId]?.stages.push(toStage(stage, collaborators));

  // projectId가 null인 할일은 어느 보드에도 속하지 않으므로 별도 버킷으로 내려보낸다
  const unassigned: BoardTask[] = [];
  for (const task of backlogTasks) {
    if (task.projectId === null) unassigned.push(toTask(task, collaborators));
    else boards[task.projectId]?.backlog.push(toTask(task, collaborators));
  }

  return {
    unassigned,
    groups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      projects: projects
        .filter((project) => project.groupId === group.id)
        .map((project) => ({
          id: project.id,
          name: project.name,
          color: project.color,
          ownerId: project.ownerId,
          owner: project.owner ? toMember(project.owner) : undefined,
        })),
    })),
    boards,
  };
}

export function createGroup(input: { id: string; name: string }) {
  return db.projectGroup.create({ data: input });
}

export function deleteGroup(id: string) {
  return db.projectGroup.deleteMany({ where: { id } });
}

/** 빈 생성 시 함께 만드는 기본 단계 — 날짜가 없으면 로드맵·캘린더에 아무것도 안 보인다 */
const DEFAULT_STAGE_NAME = "프로젝트 생성";
const DEFAULT_STAGE_COLOR = "#3b82f6";
/** 오늘~모레(3일간) — endDate는 시작일 + 2일 */
const DEFAULT_STAGE_SPAN_DAYS = 2;

export async function createProject(input: {
  id: string;
  groupId: string;
  name: string;
  color: string;
  /** 작업자 — 생성한 사용자. 배정 도메인 도입 전까지 "만든 사람 = 작업자" */
  ownerId: string | null;
}) {
  // 빈 프로젝트는 단계가 없어 로드맵·캘린더에 아무것도 안 보인다.
  // 오늘부터 3일짜리 기본 단계 1개를 함께 만들어 바로 화면에 나타나게 한다.
  // 날짜는 서버 기준 — 클라이언트 시계를 신뢰하지 않는다(completedDate와 동일 규약).
  const start = todayISO();
  return db.$transaction(async (tx) => {
    const project = await tx.project.create({ data: input });
    await tx.stage.create({
      data: {
        id: `st-${crypto.randomUUID()}`,
        projectId: input.id,
        name: DEFAULT_STAGE_NAME,
        color: DEFAULT_STAGE_COLOR,
        startDate: start,
        endDate: addDaysISO(start, DEFAULT_STAGE_SPAN_DAYS),
        order: 1,
      },
    });
    return project;
  });
}

/**
 * 프로젝트 수정 — 현재는 색만. ownerId 가드는 deleteProject와 동일하게 동작한다.
 * 반환값 count로 호출부가 "권한 없음/이미 없음"을 판별한다.
 */
export function updateProject(
  id: string,
  patch: { color?: string },
  opts?: { ownerId?: string },
) {
  return db.project.updateMany({
    where: { id, ...(opts?.ownerId ? { ownerId: opts.ownerId } : {}) },
    data: patch,
  });
}

/**
 * 프로젝트 삭제. ownerId를 주면 그 작업자의 프로젝트만 지운다 — 스탭이 남의
 * 프로젝트 id를 직접 호출해도 조건에서 걸러지도록 쿼리 레벨에서 막는다.
 * 반환값 count로 호출부가 "권한 없음/이미 없음"을 판별한다.
 */
export function deleteProject(id: string, opts?: { ownerId?: string }) {
  return db.project.deleteMany({
    where: { id, ...(opts?.ownerId ? { ownerId: opts.ownerId } : {}) },
  });
}

/**
 * 프로젝트의 단계 번호를 stageIds 순서대로 1..N으로 다시 매긴다.
 * (projectId, order) 유니크 제약은 행마다 즉시 검사되므로 곧바로 최종 번호를 쓰면
 * 교체 도중 값이 겹쳐 실패한다. 음수로 한 번 피신시킨 뒤 확정한다.
 * projectId 조건을 함께 걸어 남의 프로젝트 단계 id가 섞여 들어와도 무시되게 한다.
 */
async function renumberStages(
  tx: Prisma.TransactionClient,
  projectId: string,
  stageIds: string[],
): Promise<void> {
  for (const [index, id] of stageIds.entries()) {
    await tx.stage.updateMany({
      where: { id, projectId },
      data: { order: -(index + 1) },
    });
  }
  for (const [index, id] of stageIds.entries()) {
    await tx.stage.updateMany({
      where: { id, projectId },
      data: { order: index + 1 },
    });
  }
}

/** 새 단계는 항상 맨 뒤 번호를 받는다 */
export function createStage(input: {
  id: string;
  projectId: string;
  name: string;
  color: string;
  startDate?: string;
  endDate?: string;
  showDeadline: boolean;
}) {
  return db.$transaction(async (tx) => {
    const last = await tx.stage.findFirst({
      where: { projectId: input.projectId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    return tx.stage.create({ data: { ...input, order: (last?.order ?? 0) + 1 } });
  });
}

/**
 * 단계 순서 변경 — stageIds에 준 순서대로 1..N을 다시 매긴다.
 *
 * 부분 목록을 받아 부분만 갱신하지 않는다. 요청한 순서가 그 프로젝트의 단계
 * 집합과 정확히 일치할 때만 반영하고, 아니면 0건으로 거절한다. 클라이언트가
 * 낡은 목록을 보내면(다른 세션이 그 사이 단계를 추가·삭제) 남은 단계가 빈
 * 번호를 갖거나 순서가 뒤섞이는데, 그 상태를 만들 바에는 거절하고 새로고침
 * 시 서버 값으로 되돌아가는 편이 낫다.
 *
 * opts.ownerId를 주면 해당 사용자가 작업자인 프로젝트만 바꾼다 (deleteStage와 동일한 스탭 가드).
 */
export async function reorderStages(
  projectId: string,
  stageIds: string[],
  opts?: { ownerId?: string },
): Promise<{ count: number }> {
  return db.$transaction(async (tx) => {
    const project = await tx.project.findFirst({
      where: {
        id: projectId,
        ...(opts?.ownerId ? { ownerId: opts.ownerId } : {}),
      },
      select: { id: true },
    });
    if (!project) return { count: 0 };

    const current = await tx.stage.findMany({
      where: { projectId },
      select: { id: true },
    });
    const requested = new Set(stageIds);
    if (
      requested.size !== stageIds.length ||
      requested.size !== current.length ||
      !current.every((stage) => requested.has(stage.id))
    ) {
      return { count: 0 };
    }

    await renumberStages(tx, projectId, stageIds);
    return { count: stageIds.length };
  });
}

/**
 * 단계 삭제 — 그 단계의 할일은 지우지 않고 백로그(stageId = null)로 옮긴다.
 * Task.stage가 onDelete: Cascade이므로 **반드시 할일을 먼저 떼어낸 뒤** 단계를
 * 지워야 한다. 순서가 뒤바뀌면 할일까지 함께 삭제된다.
 *
 * opts.ownerId를 주면 해당 사용자가 작업자인 프로젝트의 단계만 지운다
 * (deleteProject와 동일한 스탭 가드).
 */
export async function deleteStage(
  id: string,
  opts?: { ownerId?: string },
): Promise<{ count: number }> {
  const where = {
    id,
    ...(opts?.ownerId ? { project: { ownerId: opts.ownerId } } : {}),
  };

  return db.$transaction(async (tx) => {
    // 가드를 통과하는 단계인지 먼저 확인 — 통과하지 못하면 아무것도 건드리지 않는다
    const stage = await tx.stage.findFirst({
      where,
      select: { id: true, projectId: true },
    });
    if (!stage) return { count: 0 };

    await tx.task.updateMany({
      where: { stageId: id },
      data: { stageId: null },
    });
    const { count } = await tx.stage.deleteMany({ where: { id } });

    // 지운 자리에 빈 번호가 남지 않도록 남은 단계를 1..N으로 다시 매긴다
    const rest = await tx.stage.findMany({
      where: { projectId: stage.projectId },
      orderBy: STAGE_ORDER,
      select: { id: true },
    });
    await renumberStages(
      tx,
      stage.projectId,
      rest.map((row) => row.id),
    );
    return { count };
  });
}

export type StagePatch = Partial<
  Pick<
    Stage,
    | "name"
    | "description"
    | "done"
    | "startDate"
    | "endDate"
    | "showDeadline"
    | "requestedCollaborators"
  >
>;

export function updateStage(id: string, patch: StagePatch) {
  return db.stage.updateMany({ where: { id }, data: patch });
}

export function createStageComment(input: {
  id: string;
  stageId: string;
  author: string;
  text: string;
}) {
  return db.stageComment.create({ data: input });
}

/**
 * 할일 생성. 담당자를 지정하지 않으면 **프로젝트 소유자 → 없으면 만든 사람**으로
 * 채운다 — "내 프로젝트에 등록한 할일은 내 담당"이 기본값이어야 한다.
 * 명시적으로 `assigneeId: null`을 보내면 미배정을 뜻하므로 기본값을 적용하지 않는다.
 * (기본값은 서버에서 정한다 — 클라이언트가 빠뜨려도 미배정으로 새지 않도록)
 */
export async function createTask(input: {
  id: string;
  /** null = 미배정 — 내 할일에서 만든 할일의 기본 상태 */
  projectId: string | null;
  stageId: string | null;
  name: string;
  /** 생략 = 기본값 규칙 적용, null = 미배정으로 명시 */
  assigneeId?: string | null;
  /** 단계에 속해 생성될 때 잡히는 예정일(YYYY-MM-DD). 없으면 일정 미정으로 만든다. */
  scheduledDate?: string;
  /** 기본값의 최후 후보 — 요청한 사용자 */
  createdById: string;
}) {
  const { createdById, scheduledDate, ...rest } = input;
  // 예정일이 있으면 마감일도 같은 값으로 세팅한다 — updateTask의 withDeadline과 같은 규칙.
  // 이후 미완료인 채 하루가 지나면 예정일만 오늘로 이월되고 마감일은 이 값으로 남는다.
  const data = scheduledDate
    ? { ...rest, scheduledDate, deadline: scheduledDate }
    : rest;
  if (data.assigneeId !== undefined) {
    return db.task.create({ data });
  }
  const owner = data.projectId
    ? (
        await db.project.findUnique({
          where: { id: data.projectId },
          select: { ownerId: true },
        })
      )?.ownerId
    : null;
  return db.task.create({ data: { ...data, assigneeId: owner ?? createdById } });
}

export type TaskPatch = Partial<{
  name: string;
  done: boolean;
  description: string | null;
  stageId: string | null;
  projectId: string | null;
  scheduledDate: string | null;
  /** null = 미배정으로 되돌린다 */
  assigneeId: string | null;
  /** 서버가 done 전환에 맞춰 채운다 — 클라이언트가 직접 보내는 값은 무시된다 */
  completedDate: string | null;
  /** 서버가 scheduledDate에서 파생한다 — 클라이언트가 직접 보내는 값은 무시된다 */
  deadline: string | null;
}>;

export function deleteTask(id: string) {
  return db.task.deleteMany({ where: { id } });
}

/** 오늘 날짜(YYYY-MM-DD) — 서버 로컬 기준. scheduledDate와 같은 표기 규격 */
function todayISO() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * 완료 상태 전환에 따른 완료날짜 자동 기록.
 * 체크하면 오늘, 해제하면 null. 날짜는 **서버가 만든다** — 클라이언트 시계를
 * 신뢰하면 기기 설정만 바꿔도 임의 날짜로 완료 기록을 남길 수 있다.
 * done이 패치에 없으면 완료날짜도 건드리지 않는다.
 */
function withCompletedDate(patch: TaskPatch): TaskPatch {
  if (patch.done === undefined) return patch;
  return { ...patch, completedDate: patch.done ? todayISO() : null };
}

/**
 * 마감일은 서버가 scheduledDate에서 파생한다 — 클라이언트가 보낸 deadline은 신뢰하지 않는다.
 * 예정일을 명시적으로 지정/변경하면(이 API 경로) 그게 새 마감일이 된다(재계획). 자동 이월
 * (rollOverOverdueTasks)은 이 경로를 타지 않으므로 마감일이 보존돼 "미뤄진 일수"가 벌어진다.
 */
function withDeadline(patch: TaskPatch): TaskPatch {
  if (patch.scheduledDate === undefined) {
    // 예정일 변경이 없으면 마감일도 그대로 둔다 (클라가 실어 보낸 deadline은 버린다)
    if (!("deadline" in patch)) return patch;
    const next = { ...patch };
    delete next.deadline;
    return next;
  }
  return { ...patch, deadline: patch.scheduledDate };
}

export async function updateTask(id: string, patch: TaskPatch) {
  patch = withCompletedDate(patch);
  patch = withDeadline(patch);
  if (patch.projectId === undefined) {
    return db.task.updateMany({ where: { id }, data: patch });
  }
  // 단계는 프로젝트에 속하므로, 프로젝트를 옮길 때 단계를 함께 지정하지 않았거나
  // 지정한 단계가 대상 프로젝트 소속이 아니면 대상 프로젝트의 백로그로 보낸다.
  let stageId: string | null = null;
  if (patch.stageId) {
    const stage = await db.stage.findUnique({
      where: { id: patch.stageId },
      select: { projectId: true },
    });
    if (stage?.projectId === patch.projectId) stageId = patch.stageId;
  }
  return db.task.updateMany({ where: { id }, data: { ...patch, stageId } });
}

/**
 * 데이터 초기화 — 프로젝트·단계·할일을 모두 지우고 그룹 골격만 남긴다.
 * (User/Session은 무관. 그룹을 남기는 이유는 seed-data.ts 주석 참고)
 */
export async function resetWorkspace(): Promise<void> {
  const seed = workspaceSeedRows();
  await db.$transaction([
    db.projectGroup.deleteMany(), // 프로젝트·단계·할일까지 cascade 삭제
    db.task.deleteMany(), // 그룹 밖에 남을 수 있는 잔여 행 방어
    db.projectGroup.createMany({ data: seed.groups }),
  ]);
}
