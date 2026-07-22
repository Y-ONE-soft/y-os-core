import { api } from "@/lib/api/client";
import type { Workspace } from "@/types/workspace";

export const fetchWorkspace = () => api.get<Workspace>("/api/admin/workspace");

export const resetWorkspaceApi = () =>
  api.post<{ ok: boolean }>("/api/admin/workspace/reset");

export const createGroupApi = (input: { id: string; name: string }) =>
  api.post<{ ok: boolean }>("/api/admin/groups", input);

export const deleteGroupApi = (groupId: string) =>
  api.del<{ ok: boolean }>(`/api/admin/groups/${groupId}`);

export const createProjectApi = (input: {
  id: string;
  groupId: string;
  name: string;
  color: string;
}) => api.post<{ ok: boolean }>("/api/admin/projects", input);

export const patchProjectApi = (projectId: string, patch: { color: string }) =>
  api.patch<{ ok: boolean }>(`/api/admin/projects/${projectId}`, patch);

export const deleteProjectApi = (projectId: string) =>
  api.del<{ ok: boolean }>(`/api/admin/projects/${projectId}`);

/**
 * 프리셋 적용 생성 — 프로젝트+단계+할일을 서버가 한 트랜잭션으로 만든다.
 * groupId는 마스터만 보낸다(스탭은 서버가 세션 그룹으로 강제).
 */
export const createProjectFromPresetApi = (input: {
  id: string;
  groupId?: string;
  name: string;
  color: string;
  presetId: string;
  /** 프리셋 오프셋의 기준일 (YYYY-MM-DD) */
  baseDate: string;
}) => api.post<{ ok: boolean }>("/api/admin/projects/from-preset", input);

/** 직접 만들기 — 기간을 stageCount개로 균등 분할한 단계와 함께 만든다 */
export const createProjectWithEvenStagesApi = (input: {
  id: string;
  groupId?: string;
  name: string;
  color: string;
  startDate: string;
  endDate: string;
  stageCount: number;
}) => api.post<{ ok: boolean }>("/api/admin/projects/even-stages", input);

export const createStageApi = (input: {
  id: string;
  projectId: string;
  name: string;
  color: string;
  startDate?: string;
  endDate?: string;
  showDeadline: boolean;
}) => api.post<{ ok: boolean }>("/api/admin/stages", input);

export const deleteStageApi = (stageId: string) =>
  api.del<{ ok: boolean }>(`/api/admin/stages/${stageId}`);

export const patchStageApi = (
  stageId: string,
  patch: Record<string, unknown>,
) => api.patch<{ ok: boolean }>(`/api/admin/stages/${stageId}`, patch);

/** 단계 순서 변경 — 그 프로젝트의 단계 전체를 새 순서대로 보낸다 */
export const reorderStagesApi = (projectId: string, stageIds: string[]) =>
  api.patch<{ ok: boolean }>(`/api/admin/projects/${projectId}/stages/order`, {
    stageIds,
  });

export const createStageCommentApi = (
  stageId: string,
  input: { id: string; text: string },
) =>
  api.post<{ ok: boolean }>(`/api/admin/stages/${stageId}/comments`, input);

export const createTaskApi = (input: {
  id: string;
  /** null = 미배정 */
  projectId: string | null;
  stageId: string | null;
  name: string;
  /** null = 미배정 */
  assigneeId?: string | null;
}) => api.post<{ ok: boolean }>("/api/admin/tasks", input);

export const patchTaskApi = (taskId: string, patch: Record<string, unknown>) =>
  api.patch<{ ok: boolean }>(`/api/admin/tasks/${taskId}`, patch);

export const deleteTaskApi = (taskId: string) =>
  api.del<{ ok: boolean }>(`/api/admin/tasks/${taskId}`);
