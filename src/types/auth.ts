export type UserRole = "MASTER" | "STAFF";

/** 세션으로 노출되는 사용자 정보 — passwordHash 등 민감 필드는 절대 포함하지 않는다. */
export type SessionUser = {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  /** 소속 그룹 id — ProjectGroup.id (구 group 자유 문자열 대체) */
  groupId: string | null;
  title: string | null;
  email: string | null;
};
