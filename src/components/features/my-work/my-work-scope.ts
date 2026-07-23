import type { BoardTask } from "@/types/workspace";

// "내 작업"에 무엇이 보이는가의 기준.
//  - 단계는 프로젝트 단위라 프로젝트 소유(ownerId === 나)로 판정한다.
//  - 백로그·미배정 할일은 낱개 작업이라 담당자(assigneeId === 나)로 판정한다.
//    할일 생성 시 서버가 만든 사람을 기본 담당자로 넣으므로, 내가 만든 할일은
//    내 assigneeId를 갖는다. 남이 만든 백로그·미배정은 여기서 걸러진다.

/** 이 낱개 할일이 내 것인가 (담당자 기준). userId가 없으면 아무것도 내 것이 아니다. */
export function isMyTask(task: BoardTask, userId: string | undefined) {
  return userId != null && task.assigneeId === userId;
}
