"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

import { useSession } from "@/components/features/auth/session-context";

import {
  createRequests as createRequestsApi,
  fetchRequests,
  respondToRequest as respondApi,
} from "@/lib/api/requests";
import type { RequestKind, RequestStatus, WorkRequest } from "@/types/requests";

// 요청은 보내는 쪽(단계·할일 상세 오버레이)과 받는 쪽(내 할일 요청 알림)이
// 동시에 떠 있을 수 있어, 한 곳에서 보내면 다른 곳도 같이 갱신돼야 한다.
// 그래서 모듈 수준 스토어 하나를 구독한다.
//
// 다만 이 목록은 **보는 사람에 따라 내용이 달라진다** — 서버가 direction(받은/보낸)을
// 뷰어 기준으로 계산해 내려준다. 로그인·로그아웃은 router.replace라 전체 새로고침이
// 없고 모듈 스토어는 살아남으므로, 사용자가 바뀌면 반드시 비우고 다시 받아야 한다.

let requests: WorkRequest[] = [];
let loaded = false;
let inflight: Promise<void> | null = null;
/** 지금 담긴 목록이 어느 사용자 기준인지 — null이면 비로그인 또는 비어 있음 */
let loadedFor: string | null = null;
/** 사용자가 바뀐 뒤 뒤늦게 도착한 응답이 새 목록을 덮지 않도록 하는 세대 번호 */
let generation = 0;
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

/** 사용자가 바뀌었을 때 — 이전 사람의 목록을 즉시 버린다 */
function clear() {
  generation += 1;
  requests = [];
  loaded = false;
  loadedFor = null;
  inflight = null;
  emit();
}

async function refresh() {
  const started = generation;
  inflight ??= fetchRequests()
    .then((next) => {
      // 받아오는 사이에 사용자가 바뀌었으면 이 응답은 남의 것이다
      if (started !== generation) return;
      requests = next;
      loaded = true;
      emit();
    })
    .catch(() => {
      // 목록 조회 실패는 화면을 비우는 것으로 충분하다 (요청은 부가 기능)
      if (started !== generation) return;
      requests = [];
      loaded = true;
      emit();
    })
    .finally(() => {
      if (started === generation) inflight = null;
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
  const { user } = useSession();
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (loadedFor === userId && loaded) return;
    // 사용자가 바뀌었으면 이전 목록부터 버린다 — 남의 요청이 잠깐이라도 보이면 안 된다
    if (loadedFor !== userId) clear();
    if (!userId) return;
    loadedFor = userId;
    void refresh();
  }, [userId]);

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
