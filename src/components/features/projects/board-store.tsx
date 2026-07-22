"use client";

import { useSyncExternalStore } from "react";

import { PROJECT_COLORS } from "@/components/features/projects/project-store";
import * as cache from "@/components/features/projects/workspace-cache";
import {
  createStageApi,
  createStageCommentApi,
  createTaskApi,
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

export const boardActions = {
  addStage(projectId: string, input: NewStageInput) {
    const id = `st-${crypto.randomUUID()}`;
    const count =
      cache.getSnapshot().boards[projectId]?.stages.length ?? 0;
    const color = PROJECT_COLORS[count % PROJECT_COLORS.length];
    const now = new Date().toISOString();
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
          createdAt: now,
          updatedAt: now,
        },
      ],
    }));
    cache.persist(
      createStageApi({
        id,
        projectId,
        name: input.name,
        color,
        startDate: input.startDate || undefined,
        endDate: input.endDate || undefined,
        showDeadline: input.showDeadline,
      }),
    );
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
  /** 단계 간 이동 — `null`은 백로그를 뜻한다 (백로그 ↔ 단계 이동 포함) */
  moveTask(
    projectId: string,
    fromStageId: string | null,
    toStageId: string | null,
    taskId: string,
  ) {
    if (fromStageId === toStageId) return;
    updateBoard(projectId, (board) => {
      const task =
        fromStageId === null
          ? board.backlog.find((candidate) => candidate.id === taskId)
          : board.stages
              .find((stage) => stage.id === fromStageId)
              ?.tasks.find((candidate) => candidate.id === taskId);
      if (!task) return board;

      const backlog =
        fromStageId === null
          ? board.backlog.filter((item) => item.id !== taskId)
          : board.backlog;
      const stages = board.stages.map((stage) =>
        stage.id === fromStageId
          ? { ...stage, tasks: stage.tasks.filter((item) => item.id !== taskId) }
          : stage,
      );

      return toStageId === null
        ? { ...board, stages, backlog: [...backlog, task] }
        : {
            ...board,
            backlog,
            stages: stages.map((stage) =>
              stage.id === toStageId
                ? { ...stage, tasks: [...stage.tasks, task] }
                : stage,
            ),
          };
    });
    cache.persist(patchTaskApi(taskId, { stageId: toStageId }));
  },
  toggleTask(projectId: string, stageId: string | null, taskId: string) {
    const board = cache.getSnapshot().boards[projectId];
    const current =
      stageId === null
        ? board?.backlog.find((task) => task.id === taskId)
        : board?.stages
            .find((stage) => stage.id === stageId)
            ?.tasks.find((task) => task.id === taskId);
    if (!current) return;
    const done = !current.done;

    const toggle = (task: BoardTask) =>
      task.id === taskId ? { ...task, done } : task;
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
    cache.persist(patchTaskApi(taskId, { done }));
  },
  /** 작업 이름·내용 수정 (작업 상세 오버레이) */
  updateTask(
    projectId: string,
    stageId: string | null,
    taskId: string,
    patch: Partial<Pick<BoardTask, "name" | "description">>,
  ) {
    const apply = (task: BoardTask) =>
      task.id === taskId ? { ...task, ...patch } : task;
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
