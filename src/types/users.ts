import type { UserRole } from "@/types/auth";

/**
 * 작업자 선택 목록에 노출되는 사용자 정보 — 요청 대상 고르기에 필요한 최소 필드만.
 * passwordHash·email 등 민감·불필요 필드는 담지 않는다.
 */
export type DirectoryUser = {
  id: string;
  name: string;
  /** 직책 (없을 수 있음) */
  title: string | null;
  role: UserRole;
  /** 소속 그룹 id — 같은 그룹 우선 노출 등 필터에 쓴다 */
  groupId: string | null;
};
