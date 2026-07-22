import { api } from "@/lib/api/client";
import type { RequestKind, RequestStatus, WorkRequest } from "@/types/requests";

export async function fetchRequests(): Promise<WorkRequest[]> {
  const { requests } = await api.get<{ requests: WorkRequest[] }>(
    "/api/admin/requests",
  );
  return requests;
}

export function createRequests(input: {
  /** 대상 수만큼의 id — 클라이언트가 만들어 보낸다 */
  ids: string[];
  kind: RequestKind;
  toUserIds: string[];
  message: string | null;
  taskId: string | null;
  stageId: string | null;
}) {
  return api.post<{ ok: boolean }>("/api/admin/requests", { ...input });
}

export function respondToRequest(
  id: string,
  status: Exclude<RequestStatus, "PENDING">,
) {
  return api.patch<{ ok: boolean }>(`/api/admin/requests/${id}`, { status });
}
