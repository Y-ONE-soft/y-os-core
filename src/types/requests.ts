/** 요청 종류 — 공동 작업자 지정(할일 요청)과 도움 요청 두 가지뿐이다. */
export type RequestKind = "ASSIGN" | "HELP";

export type RequestStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELED";

/** 요청 대상 — 할일 또는 단계 중 하나 */
export type RequestTarget = {
  /** "task" | "stage" */
  type: "task" | "stage";
  id: string;
  /** 화면 표기용 이름 (할일명·단계명) */
  name: string;
  /** 소속 프로젝트명 — 없으면(미배정 할일) null */
  projectName: string | null;
};

/** 내 할일 "요청 알림" 카드 1건 */
export type WorkRequest = {
  id: string;
  kind: RequestKind;
  status: RequestStatus;
  message: string | null;
  /** ISO 문자열 */
  createdAt: string;
  from: { id: string; name: string };
  to: { id: string; name: string };
  target: RequestTarget | null;
  /** 로그인 사용자 기준 방향 — 목록을 한 번에 받아 화면에서 분기한다 */
  direction: "received" | "sent";
};
