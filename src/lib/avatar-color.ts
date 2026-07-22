// 사용자 아바타 색 — User 테이블에는 색 컬럼이 없으므로 id에서 결정적으로 파생한다.
// (자리표시 TEAM_MEMBERS가 쓰던 팔레트를 그대로 유지해 기존 화면 톤이 바뀌지 않게 했다)
const AVATAR_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
] as const;

/** 같은 id면 항상 같은 색 — 렌더마다 색이 바뀌지 않아야 한다. */
export function avatarColor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 100_000;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
