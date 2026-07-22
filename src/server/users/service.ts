import { db } from "@/server/db";
import type { DirectoryUser } from "@/types/users";

/**
 * 작업자 선택 목록용 사용자 조회.
 * 이름 오름차순(동률 시 id)으로 고정해 목록 순서가 렌더마다 흔들리지 않게 한다.
 */
export async function listUsers(): Promise<DirectoryUser[]> {
  const users = await db.user.findMany({
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, name: true, title: true, role: true, groupId: true },
  });
  return users;
}
