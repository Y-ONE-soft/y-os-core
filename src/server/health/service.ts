import { db } from "@/server/db";

export async function checkHealth() {
  await db.$queryRaw`SELECT 1`;
  return { status: "ok", db: "connected" } as const;
}
