import { db } from "@/server/db";
import { workspaceSeedRows } from "@/server/workspace/seed-data";
import type {
  BoardStage,
  BoardTask,
  ProjectBoardData,
  Workspace,
} from "@/types/workspace";
import type {
  Stage,
  StageComment,
  Task,
} from "@/generated/prisma/client";

const ORDER = [{ createdAt: "asc" as const }, { id: "asc" as const }];

function toTask(task: Task): BoardTask {
  return {
    id: task.id,
    name: task.name,
    done: task.done,
    description: task.description ?? undefined,
  };
}

function toStage(
  stage: Stage & { tasks: Task[]; comments: StageComment[] },
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
    tasks: stage.tasks.map(toTask),
  };
}

/** 전체 워크스페이스 트리 — 스토어 부트스트랩 1회 호출용 */
export async function getWorkspace(): Promise<Workspace> {
  const [groups, projects, stages, backlogTasks] = await Promise.all([
    db.projectGroup.findMany({ orderBy: ORDER }),
    db.project.findMany({ orderBy: ORDER }),
    db.stage.findMany({
      orderBy: ORDER,
      include: {
        tasks: { orderBy: ORDER },
        comments: { orderBy: ORDER },
      },
    }),
    db.task.findMany({ where: { stageId: null }, orderBy: ORDER }),
  ]);

  const boards: Record<string, ProjectBoardData> = {};
  for (const project of projects) boards[project.id] = { stages: [], backlog: [] };
  for (const stage of stages) boards[stage.projectId]?.stages.push(toStage(stage));
  for (const task of backlogTasks) boards[task.projectId]?.backlog.push(toTask(task));

  return {
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

export function createProject(input: {
  id: string;
  groupId: string;
  name: string;
  color: string;
  /** 작업자 — 생성한 사용자. 배정 도메인 도입 전까지 "만든 사람 = 작업자" */
  ownerId: string | null;
}) {
  return db.project.create({ data: input });
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

export function createStage(input: {
  id: string;
  projectId: string;
  name: string;
  color: string;
  startDate?: string;
  endDate?: string;
  showDeadline: boolean;
}) {
  return db.stage.create({ data: input });
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

export function createTask(input: {
  id: string;
  projectId: string;
  stageId: string | null;
  name: string;
}) {
  return db.task.create({ data: input });
}

export type TaskPatch = Partial<{
  name: string;
  done: boolean;
  description: string | null;
  stageId: string | null;
  projectId: string;
}>;

export function deleteTask(id: string) {
  return db.task.deleteMany({ where: { id } });
}

export async function updateTask(id: string, patch: TaskPatch) {
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
 * 데이터 초기화 — 프로젝트·단계·작업을 모두 지우고 그룹 골격만 남긴다.
 * (User/Session은 무관. 그룹을 남기는 이유는 seed-data.ts 주석 참고)
 */
export async function resetWorkspace(): Promise<void> {
  const seed = workspaceSeedRows();
  await db.$transaction([
    db.projectGroup.deleteMany(), // 프로젝트·단계·작업까지 cascade 삭제
    db.task.deleteMany(), // 그룹 밖에 남을 수 있는 잔여 행 방어
    db.projectGroup.createMany({ data: seed.groups }),
  ]);
}
