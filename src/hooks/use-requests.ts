"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

import {
  createRequests as createRequestsApi,
  fetchRequests,
  respondToRequest as respondApi,
} from "@/lib/api/requests";
import type { RequestKind, RequestStatus, WorkRequest } from "@/types/requests";

// 요청은 보내는 쪽(단계·할일 상세 오버레이)과 받는 쪽(내 할일 요청 알림)이
// 동시에 떠 있을 수 있어, 한 곳에서 보내면 다른 곳도 같이 갱신돼야 한다.
// 그래서 모듈 수준 스토어 하나를 구독한다.

let requests: WorkRequest[] = [];
let loaded = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => requests;
// 서버 렌더에서는 항상 빈 목록 — 스냅샷이 매번 새 배열이면 무한 루프가 된다
const EMPTY: WorkRequest[] = [];
const getServerSnapshot = () => EMPTY;

async function refresh() {
  inflight ??= fetchRequests()
    .then((next) => {
      requests = next;
      loaded = true;
      emit();
    })
    .catch(() => {
      // 목록 조회 실패는 화면을 비우는 것으로 충분하다 (요청은 부가 기능)
      requests = [];
      loaded = true;
      emit();
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export const requestActions = {
  /** 요청 발송 — 여러 명이면 사람별 1건씩. id는 클라이언트가 만든다 */
  async send(input: {
    kind: RequestKind;
    toUserIds: string[];
    message: string | null;
    taskId: string | null;
    stageId: string | null;
  }) {
    if (input.toUserIds.length === 0) return;
    const ids = input.toUserIds.map(() => `rq-${crypto.randomUUID()}`);
    await createRequestsApi({ ids, ...input });
    await refresh();
  },
  /** 수락·거절·취소 */
  async respond(id: string, status: Exclude<RequestStatus, "PENDING">) {
    await respondApi(id, status);
    await refresh();
  },
  refresh,
};

export function useRequests() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (!loaded) void refresh();
  }, []);

  return { requests: list, loading: !loaded };
}

/** 특정 대상(단계·할일)에 대해 아직 응답 대기 중인 요청 */
export function usePendingRequestsFor(target: {
  stageId?: string | null;
  taskId?: string | null;
}) {
  const { requests: list } = useRequests();
  const { stageId, taskId } = target;
  return useCallback(
    () =>
      list.filter(
        (item) =>
          item.status === "PENDING" &&
          item.direction === "sent" &&
          ((stageId != null && item.target?.type === "stage" && item.target.id === stageId) ||
            (taskId != null && item.target?.type === "task" && item.target.id === taskId)),
      ),
    [list, stageId, taskId],
  )();
}
