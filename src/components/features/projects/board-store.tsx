"use client";

import { useMemo, useSyncExternalStore } from "react";

import { stageTone } from "@/components/features/projects/project-palette";
import {
  scheduleFor,
  todayISO,
} from "@/components/features/projects/roadmap-utils";
import * as cache from "@/components/features/projects/workspace-cache";
import {
  createStageApi,
  createStageCommentApi,
  createTaskApi,
  deleteStageApi,
  deleteTaskApi,
  patchStageApi,
  patchTaskApi,
  reorderStagesApi,
} from "@/lib/api/workspace";
import type {
  BoardStage,
  BoardTask,
  ProjectBoardData,
} from "@/types/workspace";

// 프로젝트별 보드(단계/할일/백로그) — DB가 원본이며 workspace-cache를 통해
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
    const snapshot = cache.getSnapshot();
    const count = snapshot.boards[projectId]?.stages.length ?? 0;
    // 화면에서는 어차피 프로젝트 색에서 파생하지만(withDerivedColors),
    // API가 color를 요구하므로 같은 규칙으로 계산해 저장한다.
    const projectColor = snapshot.groups
      .flatMap((group) => group.projects)
      .find((project) => project.id === projectId)?.color;
    const color = projectColor ? stageTone(projectColor, count) : "#71717a";
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
   * 단계 삭제 — 서버(deleteStage)와 동일하게 안의 할일은 지우지 않고 백로그로
   * 옮긴다. 낙관적 값이 서버와 어긋나면 새로고침 시 할일이 사라졌다 되살아난다.
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
  /**
   * 단계를 targetId 자리로 옮긴다 — 배열 순서가 곧 화면의 단계 번호다.
   * targetId가 null이면 맨 뒤로 보낸다.
   */
  moveStage(projectId: string, stageId: string, targetId: string | null) {
    if (stageId === targetId) return;
    const stages = cache.getSnapshot().boards[projectId]?.stages ?? [];
    const from = stages.findIndex((stage) => stage.id === stageId);
    if (from === -1) return;

    // 대상 자리에 끼워 넣는다 — 대상과 그 뒤는 한 칸씩 밀린다
    const rest = stages.filter((stage) => stage.id !== stageId);
    const to =
      targetId === null
        ? rest.length
        : rest.findIndex((stage) => stage.id === targetId);
    if (to === -1) return;

    const next = [...rest.slice(0, to), stages[from], ...rest.slice(to)];
    // 순서가 그대로면 요청을 보내지 않는다 (제자리 드롭)
    if (next.every((stage, index) => stage.id === stages[index].id)) return;
    updateBoard(projectId, (board) => ({ ...board, stages: next }));
    cache.persist(
      reorderStagesApi(
        projectId,
        next.map((stage) => stage.id),
      ),
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
    // 단계에 속해 생기는 할일은 그 단계 시작일을 예정일(=마감일)로 갖는다.
    const stage = cache
      .getSnapshot()
      .boards[projectId]?.stages.find((item) => item.id === stageId);
    const scheduledDate = scheduleFor(stage?.startDate);
    updateBoard(projectId, (board) => ({
      ...board,
      stages: board.stages.map((item) =>
        item.id === stageId
          ? {
              ...item,
              tasks: [
                ...item.tasks,
                { id, name, done: false, scheduledDate, deadline: scheduledDate },
              ],
            }
          : item,
      ),
    }));
    // 담당자 기본값은 서버가 채운다 — 응답 후 서버 값으로 맞춘다
    cache.persistAndSync(
      createTaskApi({ id, projectId, stageId, name, scheduledDate }),
    );
  },
  addBacklogTask(projectId: string, name: string) {
    const id = `tk-${crypto.randomUUID()}`;
    updateBoard(projectId, (board) => ({
      ...board,
      backlog: [...board.backlog, { id, name, done: false }],
    }));
    cache.persistAndSync(createTaskApi({ id, projectId, stageId: null, name }));
  },
  /**
   * 느슨한 할일을 만든다 — 내 할일 백로그의 기본 생성 경로.
   * projectId(=본인 공통 작업)를 주면 그 프로젝트의 백로그로, 없으면(로드 전 폴백)
   * 미배정으로 만든다. 미배정은 다음 워크스페이스 로드에 공통 작업으로 이관된다.
   * assigneeId = 만든 사람. 서버도 같은 기본값을 넣지만(createdById), 낙관적
   * 항목에 미리 박아야 "내 작업" 담당자 필터에서 방금 만든 할일이 깜빡이지 않는다.
   */
  addUnassignedTask(name: string, assigneeId?: string, projectId?: string) {
    const id = `tk-${crypto.randomUUID()}`;
    const task: BoardTask = { id, name, done: false, assigneeId };
    if (projectId) {
      updateBoard(projectId, (board) => ({
        ...board,
        backlog: [...board.backlog, task],
      }));
    } else {
      cache.apply((prev) => ({
        ...prev,
        unassigned: [...prev.unassigned, task],
      }));
    }
    cache.persistAndSync(
      createTaskApi({ id, projectId: projectId ?? null, stageId: null, name }),
    );
  },
  /**
   * 예정일이 잡힌 할일을 만든다 — 캘린더에서 날짜 칸을 눌러 추가하는 경로.
   * - projectId=null → 미배정(단계도 없음).
   * - projectId 있고 stageId 있으면 → 그 날짜를 덮는 그 단계로 편입.
   * - projectId 있고 stageId 없으면 → 그 프로젝트의 백로그(단계 없음).
   * 어느 쪽이든 예정일이 있어 캘린더의 그 날짜 칸에 바로 칩으로 뜬다.
   * assigneeId=만든 사람 — addUnassignedTask와 같은 이유로 낙관적 항목에 미리 박는다.
   */
  addScheduledTask(
    projectId: string | null,
    name: string,
    scheduledDate: string,
    assigneeId?: string,
    stageId?: string | null,
  ) {
    const id = `tk-${crypto.randomUUID()}`;
    // 새로 잡은 예정일이 곧 마감일 — 서버 withDeadline 규칙을 낙관적 캐시에도 맞춘다.
    const task: BoardTask = {
      id,
      name,
      done: false,
      scheduledDate,
      deadline: scheduledDate,
      assigneeId,
    };
    if (projectId === null) {
      // 프로젝트가 없으면 단계도 없다 — 미배정으로.
      cache.apply((prev) => ({
        ...prev,
        unassigned: [...prev.unassigned, task],
      }));
    } else if (stageId) {
      // 그 날짜를 덮는 단계로 편입. 클릭 날짜가 이미 단계 범위 안이라 단계를 늘릴 필요 없다.
      updateBoard(projectId, (board) => ({
        ...board,
        stages: board.stages.map((stage) =>
          stage.id === stageId
            ? { ...stage, tasks: [...stage.tasks, task] }
            : stage,
        ),
      }));
    } else {
      // 덮는 단계가 없으면 백로그(단계 없음).
      updateBoard(projectId, (board) => ({
        ...board,
        backlog: [...board.backlog, task],
      }));
    }
    // 담당자 기본값은 서버가 채운다 — 응답 후 서버 값으로 맞춘다
    cache.persistAndSync(
      createTaskApi({
        id,
        projectId,
        stageId: stageId ?? null,
        name,
        scheduledDate,
      }),
    );
  },
  /**
   * '단계 없음'으로 옮긴다 — 단계에서 빼되 예정일은 남긴다.
   * 백로그(예정일도 단계도 없음)와 달리 '단계 없음'은 예정일이 있어 캘린더에 뜬다.
   * 기존 예정일이 있으면 유지하고, 없으면(백로그에서 끌어온 경우) 오늘로 잡는다.
   */
  moveToStageless(projectId: string, taskId: string) {
    const board = cache.getSnapshot().boards[projectId];
    const task =
      board?.stages.flatMap((stage) => stage.tasks).find((t) => t.id === taskId) ??
      board?.backlog.find((t) => t.id === taskId);
    const keep = task?.scheduledDate ?? todayISO();
    boardActions.assignTask(projectId, taskId, projectId, null, keep);
  },
  /**
   * 할일의 소속(프로젝트·단계)을 한 번에 지정한다. 프로젝트 `null`은 미배정,
   * 단계 `null`은 백로그를 뜻하며 단계 이동·프로젝트 이동·미배정 전환을 모두 다룬다.
   */
  assignTask(
    fromProjectId: string | null,
    taskId: string,
    toProjectId: string | null,
    toStageId: string | null,
    /** 예정일을 직접 지정한다 (캘린더 날짜 칸에 떨어뜨린 경우). 없으면 규칙대로 계산 */
    scheduledDateOverride?: string,
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
    const scheduledDate =
      toStageId === null
        ? (scheduledDateOverride ?? null)
        : (scheduledDateOverride ?? scheduleFor(toStage?.startDate));
    // 예정일을 새로 잡으면 마감일도 그 값(재계획) — 서버 withDeadline과 같은 규칙을
    // 낙관적 캐시에도 반영해, 편입 직후 상세에서 마감·미뤄짐이 바로 맞게 보이도록.
    const moved: BoardTask = {
      ...task,
      scheduledDate: scheduledDate ?? undefined,
      deadline: scheduledDate ?? undefined,
    };

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
  /** 할일 삭제 — 미배정이거나 백로그·단계 어디에 있든 제거한다 */
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

    // 완료날짜는 서버(updateTask)가 done 전환에 맞춰 채운다. 낙관적 값도 같은
    // 규칙으로 맞춰야 새로고침 시 날짜가 늦게 나타나거나 남아 있지 않는다.
    const completedDate = done ? todayISO() : undefined;
    const toggle = (task: BoardTask) =>
      task.id === taskId ? { ...task, done, completedDate } : task;
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
  /**
   * 캘린더 칩을 백로그로 되돌린다. 예정일(·마감일)을 비워 캘린더에서 내리고,
   * 단계에 속해 있었다면 그 프로젝트 백로그로 옮긴다. 미배정은 미배정인 채로 남는다.
   * 어느 경우든 결과적으로 백로그 목록(미배정 or 프로젝트 백로그)에 나타난다.
   */
  returnToBacklog(projectId: string | null, taskId: string) {
    const snapshot = cache.getSnapshot();
    // 단계 소속이면 assignTask로 백로그 이동 — toStageId=null이라 예정일·마감일도 함께 비워진다.
    if (projectId !== null) {
      const inStage = snapshot.boards[projectId]?.stages.some((stage) =>
        stage.tasks.some((task) => task.id === taskId),
      );
      if (inStage) {
        boardActions.assignTask(projectId, taskId, projectId, null);
        return;
      }
    }
    // 이미 백로그·미배정 — 예정일만 지운다. 서버 withDeadline이 scheduledDate:null을
    // 마감일까지 비우므로, 낙관적 캐시도 둘 다 비워 새로고침과 어긋나지 않게 한다.
    const clear = (task: BoardTask): BoardTask =>
      task.id === taskId
        ? { ...task, scheduledDate: undefined, deadline: undefined }
        : task;
    if (projectId === null) {
      cache.apply((prev) => ({ ...prev, unassigned: prev.unassigned.map(clear) }));
    } else {
      updateBoard(projectId, (board) => ({
        ...board,
        backlog: board.backlog.map(clear),
      }));
    }
    cache.persist(patchTaskApi(taskId, { scheduledDate: null }));
  },
  /** 할일 이름·내용·예정일·담당자 수정 (할일 상세 오버레이, 캘린더 드래그) */
  updateTask(
    projectId: string | null,
    stageId: string | null,
    taskId: string,
    patch: Partial<Pick<BoardTask, "name" | "description" | "scheduledDate">> & {
      /** null = 담당자 해제. 키가 없으면 담당자를 건드리지 않는다 */
      assigneeId?: string | null;
    },
  ) {
    // 로컬 상태는 BoardTask 규격(미배정 = undefined)이라 null을 맞춰 준다.
    // 서버로는 null 그대로 보내야 한다 — undefined는 JSON에서 사라져
    // 라우트의 `key in body` 검사를 통과하지 못하고 해제가 무시된다.
    const localPatch: Partial<BoardTask> =
      "assigneeId" in patch
        ? { ...patch, assigneeId: patch.assigneeId ?? undefined }
        : (patch as Partial<BoardTask>);
    const apply = (task: BoardTask) =>
      task.id === taskId ? { ...task, ...localPatch } : task;
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

/** 프로젝트 id → 프로젝트 색 */
function projectColorMap(workspace: {
  groups: { projects: { id: string; color: string }[] }[];
}): Record<string, string> {
  const map: Record<string, string> = {};
  for (const group of workspace.groups)
    for (const project of group.projects) map[project.id] = project.color;
  return map;
}

/**
 * 단계 색을 프로젝트 색에서 파생해 덮어쓴다 — DB에 저장된 색은 쓰지 않는다.
 * 저장값을 쓰면 프로젝트 색을 바꿨을 때 옛 색이 남아 다시 어긋난다.
 */
function withDerivedColors(
  board: ProjectBoardData,
  projectColor: string | undefined,
): ProjectBoardData {
  if (!projectColor) return board;
  return {
    ...board,
    stages: board.stages.map((stage, index) => ({
      ...stage,
      color: stageTone(projectColor, index),
    })),
  };
}

export function useProjectBoard(projectId: string): ProjectBoardData {
  const workspace = useSyncExternalStore(
    cache.subscribe,
    cache.getSnapshot,
    cache.getServerSnapshot,
  );
  return useMemo(() => {
    const board = workspace.boards[projectId] ?? EMPTY_BOARD;
    return withDerivedColors(board, projectColorMap(workspace)[projectId]);
  }, [workspace, projectId]);
}

/** 전체 프로젝트의 보드 상태 — 작업 현황처럼 여러 프로젝트를 집계하는 화면용 */
export function useBoardState(): BoardState {
  const workspace = useSyncExternalStore(
    cache.subscribe,
    cache.getSnapshot,
    cache.getServerSnapshot,
  );
  return useMemo(() => {
    const colors = projectColorMap(workspace);
    const next: BoardState = {};
    for (const [projectId, board] of Object.entries(workspace.boards))
      next[projectId] = withDerivedColors(board, colors[projectId]);
    return next;
  }, [workspace]);
}

/** 미배정 할일(projectId = null) — 내 할일 백로그의 기본 자리 */
export function useUnassignedTasks(): BoardTask[] {
  const workspace = useSyncExternalStore(
    cache.subscribe,
    cache.getSnapshot,
    cache.getServerSnapshot,
  );
  return workspace.unassigned;
}
