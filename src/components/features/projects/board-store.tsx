"use client";

import { useSyncExternalStore } from "react";

import { PROJECT_COLORS } from "@/components/features/projects/project-store";
import {
  BOARD_SEED,
  type ProjectBoardData,
} from "@/components/features/projects/project-detail-data";

// 프로젝트별 보드(단계/작업/백로그) 상태 — localStorage 영속.
// project-store와 동일한 useSyncExternalStore 패턴 (DB/API 전환 전 임시 계층).
const STORAGE_KEY = "yos.board.v2";

const EMPTY_BOARD: ProjectBoardData = { stages: [], backlog: [] };

type BoardState = Record<string, ProjectBoardData>;

let boardState: BoardState | null = null;
const listeners = new Set<() => void>();

function load(): BoardState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as BoardState;
  } catch {
    // 저장 데이터가 깨진 경우 시드로 대체
  }
  return BOARD_SEED;
}

function getSnapshot(): BoardState {
  if (boardState === null) boardState = load();
  return boardState;
}

function getServerSnapshot(): BoardState {
  return BOARD_SEED;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function update(updater: (prev: BoardState) => BoardState) {
  boardState = updater(getSnapshot());
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(boardState));
  listeners.forEach((listener) => listener());
}

function updateBoard(
  projectId: string,
  updater: (board: ProjectBoardData) => ProjectBoardData,
) {
  update((prev) => ({
    ...prev,
    [projectId]: updater(prev[projectId] ?? EMPTY_BOARD),
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
    updateBoard(projectId, (board) => ({
      ...board,
      stages: [
        ...board.stages,
        {
          id: `st-${crypto.randomUUID()}`,
          name: input.name,
          color: PROJECT_COLORS[board.stages.length % PROJECT_COLORS.length],
          startDate: input.startDate || undefined,
          endDate: input.endDate || undefined,
          showDeadline: input.showDeadline,
          tasks: [],
        },
      ],
    }));
  },
  addTask(projectId: string, stageId: string, name: string) {
    updateBoard(projectId, (board) => ({
      ...board,
      stages: board.stages.map((stage) =>
        stage.id === stageId
          ? {
              ...stage,
              tasks: [
                ...stage.tasks,
                { id: `tk-${crypto.randomUUID()}`, name, done: false },
              ],
            }
          : stage,
      ),
    }));
  },
  addBacklogTask(projectId: string, name: string) {
    updateBoard(projectId, (board) => ({
      ...board,
      backlog: [
        ...board.backlog,
        { id: `bk-${crypto.randomUUID()}`, name, done: false },
      ],
    }));
  },
  moveTask(
    projectId: string,
    fromStageId: string,
    toStageId: string,
    taskId: string,
  ) {
    if (fromStageId === toStageId) return;
    updateBoard(projectId, (board) => {
      const task = board.stages
        .find((stage) => stage.id === fromStageId)
        ?.tasks.find((candidate) => candidate.id === taskId);
      if (!task) return board;
      return {
        ...board,
        stages: board.stages.map((stage) =>
          stage.id === fromStageId
            ? {
                ...stage,
                tasks: stage.tasks.filter((item) => item.id !== taskId),
              }
            : stage.id === toStageId
              ? { ...stage, tasks: [...stage.tasks, task] }
              : stage,
        ),
      };
    });
  },
  toggleTask(projectId: string, stageId: string | null, taskId: string) {
    updateBoard(projectId, (board) =>
      stageId === null
        ? {
            ...board,
            backlog: board.backlog.map((task) =>
              task.id === taskId ? { ...task, done: !task.done } : task,
            ),
          }
        : {
            ...board,
            stages: board.stages.map((stage) =>
              stage.id === stageId
                ? {
                    ...stage,
                    tasks: stage.tasks.map((task) =>
                      task.id === taskId
                        ? { ...task, done: !task.done }
                        : task,
                    ),
                  }
                : stage,
            ),
          },
    );
  },
};

export function useProjectBoard(projectId: string): ProjectBoardData {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return state[projectId] ?? EMPTY_BOARD;
}

/** 전체 프로젝트의 보드 상태 — 작업 현황처럼 여러 프로젝트를 집계하는 화면용 */
export function useBoardState(): BoardState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
