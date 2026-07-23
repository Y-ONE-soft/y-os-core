"use client";

import { useSyncExternalStore } from "react";

import type { ProjectGroup, Project } from "@/types/workspace";

// 내 할일 뷰 필터 — 화면(캘린더·타임라인)에만 적용되고 데이터는 건드리지 않는다.
// 필터 바(MyWorkFilters)는 클라이언트 컴포넌트인데 MyWorkPage는 서버 컴포넌트라
// props로 내려줄 수 없다. 그래서 모듈 스토어를 두고 양쪽이 구독한다.

export type MyWorkFilter = {
  /** 선택된 그룹 id. null = 전체. 마스터만 지정할 수 있다 */
  groupIds: string[] | null;
  /** 선택된 담당자(프로젝트 소유자) id. null = 기본(로그인 사용자) */
  assigneeIds: string[] | null;
  /** 선택된 프로젝트 id. null = 전체 */
  projectIds: string[] | null;
};

const EMPTY: MyWorkFilter = {
  groupIds: null,
  assigneeIds: null,
  projectIds: null,
};

let state: MyWorkFilter = EMPTY;
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

const getSnapshot = () => state;
// 서버 렌더에서는 항상 같은 참조를 돌려줘야 무한 루프가 나지 않는다
const getServerSnapshot = () => EMPTY;

/** 배열이 비면 null(=제한 없음)로 되돌린다 — 아무것도 안 보이는 상태를 만들지 않는다 */
function normalize(ids: string[]): string[] | null {
  return ids.length === 0 ? null : ids;
}

export const myWorkFilterActions = {
  toggleGroup(id: string, current: string[]) {
    const next = current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id];
    state = { ...state, groupIds: normalize(next) };
    emit();
  },
  toggleAssignee(id: string, current: string[]) {
    const next = current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id];
    state = { ...state, assigneeIds: normalize(next) };
    emit();
  },
  toggleProject(id: string, current: string[]) {
    const next = current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id];
    state = { ...state, projectIds: normalize(next) };
    emit();
  },
  reset() {
    state = EMPTY;
    emit();
  },
};

export function useMyWorkFilter() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * 필터를 그룹 트리에 적용해 화면에 보일 프로젝트 목록을 만든다.
 * 그룹 소속을 알아야 그룹 필터를 걸 수 있어 flat 목록이 아니라 groups를 받는다.
 * 담당자 미지정이면 기본값인 로그인 사용자 소유 프로젝트만 본다 ("내 할일"의 원래 기준).
 */
export function applyMyWorkFilter(
  groups: ProjectGroup[],
  filter: MyWorkFilter,
  currentUserId: string | undefined,
): Project[] {
  const owners = filter.assigneeIds ?? (currentUserId ? [currentUserId] : []);
  return groups
    .filter(
      (group) => filter.groupIds === null || filter.groupIds.includes(group.id),
    )
    .flatMap((group) => group.projects)
    .filter(
      (project) =>
        owners.includes(project.ownerId ?? "") &&
        (filter.projectIds === null || filter.projectIds.includes(project.id)),
    );
}
