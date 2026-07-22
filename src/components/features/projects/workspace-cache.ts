// 워크스페이스(그룹·프로젝트·보드) 클라이언트 캐시 — 서버(DB)가 원본이고,
// 이 모듈은 화면용 스냅샷 + 낙관적 업데이트만 담당한다.
// project-store / board-store가 함께 구독하는 단일 소스.

import { fetchWorkspace } from "@/lib/api/workspace";
import type { Workspace } from "@/types/workspace";

const EMPTY: Workspace = { groups: [], boards: {}, unassigned: [] };

let state: Workspace = EMPTY;
let status: "idle" | "loading" | "ready" = "idle";
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): Workspace {
  return state;
}

export function getServerSnapshot(): Workspace {
  return EMPTY;
}

/** 최초 1회 부트스트랩 (ProjectStoreProvider 마운트 시) */
export async function ensureLoaded() {
  if (status !== "idle") return;
  status = "loading";
  await refresh();
}

export async function refresh() {
  try {
    state = await fetchWorkspace();
    status = "ready";
    emit();
  } catch (error) {
    status = "idle"; // 다음 시도에서 재로드 가능하게
    console.error("[workspace] 불러오기 실패", error);
  }
}

/** 낙관적 로컬 반영 */
export function apply(updater: (prev: Workspace) => Workspace) {
  state = updater(state);
  emit();
}

/** 서버 반영 — 실패 시 서버 상태로 재동기화해 로컬 어긋남을 복구한다 */
export function persist(operation: Promise<unknown>) {
  operation.catch((error) => {
    console.error("[workspace] 저장 실패 — 서버 상태로 재동기화", error);
    status = "loading";
    void refresh();
  });
}
