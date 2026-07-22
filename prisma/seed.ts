import { config } from "dotenv";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

config({ path: [".env.local", ".env"] });

// prisma.config.ts 로드 이후 실행되므로 alias(@/) 없이 상대 경로 사용
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const SEED_PASSWORD = "1111"; // 개발용 시드 비밀번호 (운영 전 반드시 변경)

const USERS = [
  {
    username: "master01",
    role: "MASTER",
    name: "마스터",
    group: "Y-ONE",
    title: "대표",
    phone: "010-0000-0001",
    email: "master01@y-os.local",
  },
  {
    username: "step01",
    role: "STAFF",
    name: "스탭",
    group: "Y-ONE",
    title: "사원",
    phone: "010-0000-0002",
    email: "step01@y-os.local",
  },
] as const;

// prisma.config.ts 로드 이후 실행되므로 alias(@/) 없이 상대 경로 사용
import { workspaceSeedRows } from "../src/server/workspace/seed-data";

async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  for (const user of USERS) {
    await db.user.upsert({
      where: { username: user.username },
      update: { ...user, passwordHash },
      create: { ...user, passwordHash },
    });
    console.log(`seeded: ${user.username} (${user.role})`);
  }

  // 워크스페이스(그룹·프로젝트·보드) — 이미 데이터가 있으면 건드리지 않는다
  const existingGroups = await db.projectGroup.count();
  if (existingGroups > 0) {
    console.log("workspace: 기존 데이터 유지 (시드 생략)");
    return;
  }
  const seed = workspaceSeedRows();
  await db.projectGroup.createMany({ data: seed.groups });
  await db.project.createMany({ data: seed.projects });
  await db.stage.createMany({ data: seed.stages });
  await db.task.createMany({ data: seed.tasks });
  console.log(
    `workspace seeded: 그룹 ${seed.groups.length} · 프로젝트 ${seed.projects.length} · 단계 ${seed.stages.length} · 작업 ${seed.tasks.length}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
