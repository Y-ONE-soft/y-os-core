export type UserRole = "MASTER" | "STAFF";

/** 세션으로 노출되는 사용자 정보 — passwordHash 등 민감 필드는 절대 포함하지 않는다. */
export type SessionUser = {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  group: string | null;
  title: string | null;
  email: string | null;
};
