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
  phone: string | null;
};

/**
 * 내 정보 페이지에서 본인이 바꿀 수 있는 필드.
 * groupId는 마스터만 바꿀 수 있다(스탭 소속은 관리자 관리) — 라우트에서 역할로 가른다.
 */
export type ProfilePatch = Partial<{
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  groupId: string;
}>;
