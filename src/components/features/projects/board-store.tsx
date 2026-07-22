"use client";

import { useSyncExternalStore } from "react";

import { PROJECT_COLORS } from "@/components/features/projects/project-store";
import { scheduleFor } from "@/components/features/projects/roadmap-utils";
import * as cache from "@/components/features/projects/workspace-cache";
import {
  createStageApi,
  createStageCommentApi,
  createTaskApi,
  deleteStageApi,
  deleteTaskApi,
  patchStageApi,
  patchTaskApi,
} from "@/lib/api/workspace";
import type {
  BoardStage,
  BoardTask,
  ProjectBoardData,
} from "@/types/workspace";

// 프로젝트별 보드(단계/작업/백로그) — DB가 원본이며 workspace-cache를 통해
// 낙관적 업데이트 후 API 경계로 저장한다 (기존 localStorage 스토어와 동일 인터페이스).

const EMPTY_BOARD: ProjectBoardData = { stages: [], backlog: [] };

type BoardState = Record<string, ProjectBoardData>;

function updateBoard(
  projectId: string,
  updater: (board: ProjectBoardData) => ProjectBoardData,
) {
  cache.apply((prev) => ({
    ...prev,
    boards: {
      ...prev.boards,
      [projectId]: updater(prev.boards[projectId] ?? EMPTY_BOARD),
    },
  }));
}

export type NewStageInput = {
  name: string;
  startDate?: string;
  endDate?: string;
  showDeadline: boolean;
};

/** 생성 API가 받지 않는 필드 — 생성 완료 후 patch로 이어 저장한다 */
export type NewStageExtra = {
  description?: string;
  requestedCollaborators?: string[];
};

export const boardActions = {
  /** 생성된 단계 id를 돌려준다. `extra`는 생성 API가 받지 않는 필드로, 생성 완료 후 patch로 이어 저장한다 */
  addStage(
    projectId: string,
    input: NewStageInput,
    extra?: NewStageExtra,
  ): string {
    const id = `st-${crypto.randomUUID()}`;
    const count =
      cache.getSnapshot().boards[projectId]?.stages.length ?? 0;
    const color = PROJECT_COLORS[count % PROJECT_COLORS.length];
    const now = new Date().toISOString();
    const description = extra?.description?.trim() || undefined;
    const requestedCollaborators = extra?.requestedCollaborators?.length
      ? extra.requestedCollaborators
      : undefined;
    updateBoard(projectId, (board) => ({
      ...board,
      stages: [
        ...board.stages,
        {
          id,
          name: input.name,
          color,
          startDate: input.startDate || undefined,
          endDate: input.endDate || undefined,
          showDeadline: input.showDeadline,
          tasks: [],
          comments: [],
          description,
          requestedCollaborators,
          createdAt: now,
          updatedAt: now,
        },
      ],
    }));
    const created = createStageApi({
      id,
      projectId,
      name: input.name,
      color,
      startDate: input.startDate || undefined,
      endDate: input.endDate || undefined,
      showDeadline: input.showDeadline,
    });
    // 생성 완료 후에 patch해야 한다 — 두 요청을 나란히 보내면 지연이 큰 환경에서
    // patch가 먼저 도착해 대상 행이 없고, 서버는 0건 수정으로 200을 돌려줘 조용히 유실된다.
    cache.persist(
      description || requestedCollaborators
        ? created.then(() =>
            patchStageApi(id, {
              ...(description ? { description } : {}),
              ...(requestedCollaborators ? { requestedCollaborators } : {}),
            }),
          )
        : created,
    );
    return id;
  },
  /**
   * 단계 삭제 — 서버(deleteStage)와 동일하게 안의 작업은 지우지 않고 백로그로
   * 옮긴다. 낙관적 값이 서버와 어긋나면 새로고침 시 작업이 사라졌다 되살아난다.
   */
  deleteStage(projectId: string, stageId: string) {
    updateBoard(projectId, (board) => {
      const target = board.stages.find((stage) => stage.id === stageId);
      return {
        ...board,
        backlog: [...board.backlog, ...(target?.tasks ?? [])],
        stages: board.stages.filter((stage) => stage.id !== stageId),
      };
    });
    cache.persist(deleteStageApi(stageId));
  },
  updateStage(
    projectId: string,
    stageId: string,
    patch: Partial<
      Pick<
        BoardStage,
        | "name"
        | "description"
        | "done"
        | "startDate"
        | "endDate"
        | "showDeadline"
        | "requestedCollaborators"
      >
    >,
  ) {
    updateBoard(projectId, (board) => ({
      ...board,
      stages: board.stages.map((stage) =>
        stage.id === stageId
          ? { ...stage, ...patch, updatedAt: new Date().toISOString() }
          : stage,
      ),
    }));
    cache.persist(patchStageApi(stageId, patch));
  },
  addComment(projectId: string, stageId: string, author: string, text: string) {
    const id = `cm-${crypto.randomUUID()}`;
    updateBoard(projectId, (board) => ({
      ...board,
      stages: board.stages.map((stage) =>
        stage.id === stageId
          ? {
              ...stage,
              comments: [
                ...(stage.comments ?? []),
                { id, author, text, at: new Date().toISOString() },
              ],
              updatedAt: new Date().toISOString(),
            }
          : stage,
      ),
    }));
    // 작성자는 서버가 세션 사용자로 고정한다
    cache.persist(createStageCommentApi(stageId, { id, text }));
  },
  addTask(projectId: string, stageId: string, name: string) {
    const id = `tk-${crypto.randomUUID()}`;
    updateBoard(projectId, (board) => ({
      ...board,
      stages: board.stages.map((stage) =>
        stage.id === stageId
          ? { ...stage, tasks: [...stage.tasks, { id, name, done: false }] }
          : stage,
      ),
    }));
    cache.persist(createTaskApi({ id, projectId, stageId, name }));
  },
  addBacklogTask(projectId: string, name: string) {
    const id = `tk-${crypto.randomUUID()}`;
    updateBoard(projectId, (board) => ({
      ...board,
      backlog: [...board.backlog, { id, name, done: false }],
    }));
    cache.persist(createTaskApi({ id, projectId, stageId: null, name }));
  },
  /** 프로젝트 없이 작업을 만든다 — 내 작업 백로그의 기본 생성 경로 */
  addUnassignedTask(name: string) {
    const id = `tk-${crypto.randomUUID()}`;
    cache.apply((prev) => ({
      ...prev,
      unassigned: [...prev.unassigned, { id, name, done: false }],
    }));
    cache.persist(createTaskApi({ id, projectId: null, stageId: null, name }));
  },
  /**
   * 작업의 소속(프로젝트·단계)을 한 번에 지정한다. 프로젝트 `null`은 미배정,
   * 단계 `null`은 백로그를 뜻하며 단계 이동·프로젝트 이동·미배정 전환을 모두 다룬다.
   */
  assignTask(
    fromProjectId: string | null,
    taskId: string,
    toProjectId: string | null,
    toStageId: string | null,
  ) {
    const snapshot = cache.getSnapshot();
    const from = fromProjectId === null ? null : snapshot.boards[fromProjectId];
    const currentStage = from?.stages.find((stage) =>
      stage.tasks.some((candidate) => candidate.id === taskId),
    );
    const task =
      fromProjectId === null
        ? snapshot.unassigned.find((candidate) => candidate.id === taskId)
        : (currentStage?.tasks.find((candidate) => candidate.id === taskId) ??
          from?.backlog.find((candidate) => candidate.id === taskId));
    if (!task) return;
    if (
      fromProjectId === toProjectId &&
      (currentStage?.id ?? null) === toStageId
    ) {
      return;
    }

    // 출발 위치에서 제거 (미배정·단계·백로그 어느 쪽이든)
    if (fromProjectId === null) {
      cache.apply((prev) => ({
        ...prev,
        unassigned: prev.unassigned.filter((item) => item.id !== taskId),
      }));
    } else {
      updateBoard(fromProjectId, (board) => ({
        ...board,
        backlog: board.backlog.filter((item) => item.id !== taskId),
        stages: board.stages.map((stage) => ({
          ...stage,
          tasks: stage.tasks.filter((item) => item.id !== taskId),
        })),
      }));
    }
    // 단계에 편입되면 예정일이 잡힌다 — 단계 시작일과 오늘 중 더 늦은 날짜.
    // 단계를 벗어나면(백로그·미배정) 일정 미정 상태로 되돌린다.
    const toStage =
      toProjectId === null || toStageId === null
        ? undefined
        : snapshot.boards[toProjectId]?.stages.find(
            (stage) => stage.id === toStageId,
          );
    const scheduledDate = toStageId === null ? null : scheduleFor(toStage?.startDate);
    const moved: BoardTask = { ...task, scheduledDate: scheduledDate ?? undefined };

    // 대상 위치에 추가
    if (toProjectId === null) {
      cache.apply((prev) => ({
        ...prev,
        unassigned: [...prev.unassigned, moved],
      }));
    } else {
      updateBoard(toProjectId, (board) =>
        toStageId === null
          ? { ...board, backlog: [...board.backlog, moved] }
          : {
              ...board,
              stages: board.stages.map((stage) =>
                stage.id === toStageId
                  ? { ...stage, tasks: [...stage.tasks, moved] }
                  : stage,
              ),
            },
      );
    }
    cache.persist(
      patchTaskApi(taskId, {
        projectId: toProjectId,
        stageId: toStageId,
        scheduledDate,
      }),
    );
  },
  /** 작업 삭제 — 미배정이거나 백로그·단계 어디에 있든 제거한다 */
  deleteTask(projectId: string | null, taskId: string) {
    if (projectId === null) {
      cache.apply((prev) => ({
        ...prev,
        unassigned: prev.unassigned.filter((task) => task.id !== taskId),
      }));
    } else {
      updateBoard(projectId, (board) => ({
        ...board,
        backlog: board.backlog.filter((task) => task.id !== taskId),
        stages: board.stages.map((stage) => ({
          ...stage,
          tasks: stage.tasks.filter((task) => task.id !== taskId),
        })),
      }));
    }
    cache.persist(deleteTaskApi(taskId));
  },
  toggleTask(projectId: string | null, stageId: string | null, taskId: string) {
    const snapshot = cache.getSnapshot();
    const board = projectId === null ? null : snapshot.boards[projectId];
    const current =
      projectId === null
        ? snapshot.unassigned.find((task) => task.id === taskId)
        : stageId === null
          ? board?.backlog.find((task) => task.id === taskId)
          : board?.stages
              .find((stage) => stage.id === stageId)
              ?.tasks.find((task) => task.id === taskId);
    if (!current) return;
    const done = !current.done;

    const toggle = (task: BoardTask) =>
      task.id === taskId ? { ...task, done } : task;
    if (projectId === null) {
      cache.apply((prev) => ({
        ...prev,
        unassigned: prev.unassigned.map(toggle),
      }));
    } else {
      updateBoard(projectId, (prev) =>
        stageId === null
          ? { ...prev, backlog: prev.backlog.map(toggle) }
          : {
              ...prev,
              stages: prev.stages.map((stage) =>
                stage.id === stageId
                  ? { ...stage, tasks: stage.tasks.map(toggle) }
                  : stage,
              ),
            },
      );
    }
    cache.persist(patchTaskApi(taskId, { done }));
  },
  /** 작업 이름·내용·예정일 수정 (작업 상세 오버레이, 캘린더 드래그) */
  updateTask(
    projectId: string | null,
    stageId: string | null,
    taskId: string,
    patch: Partial<Pick<BoardTask, "name" | "description" | "scheduledDate">>,
  ) {
    const apply = (task: BoardTask) =>
      task.id === taskId ? { ...task, ...patch } : task;
    if (projectId === null) {
      cache.apply((prev) => ({
        ...prev,
        unassigned: prev.unassigned.map(apply),
      }));
    } else {
      updateBoard(projectId, (board) =>
        stageId === null
          ? { ...board, backlog: board.backlog.map(apply) }
          : {
              ...board,
              stages: board.stages.map((stage) =>
                stage.id === stageId
                  ? { ...stage, tasks: stage.tasks.map(apply) }
                  : stage,
              ),
            },
      );
    }
    cache.persist(
      patchTaskApi(taskId, {
        ...patch,
        description: patch.description ?? undefined,
      }),
    );
  },
};

export function useProjectBoard(projectId: string): ProjectBoardData {
  const workspace = useSyncExternalStore(
    cache.subscribe,
    cache.getSnapshot,
    cache.getServerSnapshot,
  );
  return workspace.boards[projectId] ?? EMPTY_BOARD;
}

/** 전체 프로젝트의 보드 상태 — 작업 현황처럼 여러 프로젝트를 집계하는 화면용 */
export function useBoardState(): BoardState {
  const workspace = useSyncExternalStore(
    cache.subscribe,
    cache.getSnapshot,
    cache.getServerSnapshot,
  );
  return workspace.boards;
}

/** 미배정 작업(projectId = null) — 내 작업 백로그의 기본 자리 */
export function useUnassignedTasks(): BoardTask[] {
  const workspace = useSyncExternalStore(
    cache.subscribe,
    cache.getSnapshot,
    cache.getServerSnapshot,
  );
  return workspace.unassigned;
}
