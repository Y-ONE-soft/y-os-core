// 워크스페이스(프로젝트·보드) DTO — 서버 서비스와 클라이언트 스토어가 공유하는 규격.
// 날짜는 화면 표기 규격(YYYY-MM-DD)·ISO 문자열로 직렬화해 주고받는다.

export type Project = {
  id: string;
  name: string;
  color: string;
  /** 작업자(User.id) — 스탭 화면의 "내 프로젝트" 판정 기준. 미지정이면 null */
  ownerId: string | null;
};

export type ProjectGroup = {
  id: string;
  name: string;
  projects: Project[];
};

export type BoardTask = {
  id: string;
  name: string;
  done: boolean;
  /** 할일 상세 오버레이 '내용' */
  description?: string;
  /** YYYY-MM-DD — 캘린더에 놓일 예정일(화면 표기 "할일날짜"). 없으면 일정 미정 */
  scheduledDate?: string;
  /** YYYY-MM-DD — 완료 체크 시 서버가 기록. 체크를 풀면 사라진다 */
  completedDate?: string;
};

export type StageComment = {
  id: string;
  author: string;
  text: string;
  /** ISO 문자열 */
  at: string;
};

export type BoardStage = {
  id: string;
  name: string;
  color: string;
  /** YYYY-MM-DD */
  startDate?: string;
  /** YYYY-MM-DD */
  endDate?: string;
  showDeadline: boolean;
  tasks: BoardTask[];
  done?: boolean;
  description?: string;
  comments?: StageComment[];
  requestedCollaborators?: string[];
  /** ISO 문자열 */
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectBoardData = {
  stages: BoardStage[];
  backlog: BoardTask[];
};

/** GET /api/admin/workspace 응답 — 스토어 부트스트랩 1회 호출 규격 */
export type Workspace = {
  groups: ProjectGroup[];
  boards: Record<string, ProjectBoardData>;
  /** 어느 프로젝트에도 배정되지 않은 할일 (projectId = null) */
  unassigned: BoardTask[];
};
