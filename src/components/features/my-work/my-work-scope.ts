import type { BoardTask, ProjectGroup } from "@/types/workspace";

// "내 작업"에 무엇이 보이는가의 기준.
//  - 단계는 프로젝트 단위라 프로젝트 소유(ownerId === 나)로 판정한다.
//  - 백로그·미배정 할일은 낱개 작업이라 담당자(assigneeId === 나)로 판정한다.
//    할일 생성 시 서버가 만든 사람을 기본 담당자로 넣으므로, 내가 만든 할일은
//    내 assigneeId를 갖는다. 남이 만든 백로그·미배정은 여기서 걸러진다.

/** 이 낱개 할일이 내 것인가 (담당자 기준). userId가 없으면 아무것도 내 것이 아니다. */
export function isMyTask(task: BoardTask, userId: string | undefined) {
  return userId != null && task.assigneeId === userId;
}

/**
 * 내 "공통 작업"(계정 기본 프로젝트) id — 소유자가 나이고 isDefault인 프로젝트.
 * 느슨한 할일(내 할일 백로그 입력·캘린더 빈 칸 클릭)의 기본 소속으로 쓴다.
 * 아직 로드 전이거나 없으면 null(호출부는 그때 미배정으로 폴백).
 */
export function defaultProjectIdOf(
  groups: ProjectGroup[],
  userId: string | undefined,
): string | null {
  if (userId == null) return null;
  for (const group of groups) {
    const found = group.projects.find(
      (project) => project.isDefault && project.ownerId === userId,
    );
    if (found) return found.id;
  }
  return null;
}
