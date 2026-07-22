import { api } from "@/lib/api/client";
import type { DirectoryUser } from "@/types/users";

export async function fetchUsers(): Promise<DirectoryUser[]> {
  const { users } = await api.get<{ users: DirectoryUser[] }>(
    "/api/admin/users",
  );
  return users;
}
