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

/** 시드 계정의 소속 그룹 — ProjectGroup.id와 동일 축 (구 group 문자열 "Y-ONE" 대체) */
const SEED_GROUP_ID = "g-soft";

const USERS = [
  {
    username: "master01",
    role: "MASTER",
    name: "마스터",
    title: "대표",
    phone: "010-0000-0001",
    email: "master01@y-os.local",
  },
  {
    username: "step01",
    role: "STAFF",
    name: "스탭",
    title: "사원",
    phone: "010-0000-0002",
    email: "step01@y-os.local",
  },
] as const;

// prisma.config.ts 로드 이후 실행되므로 alias(@/) 없이 상대 경로 사용
import { workspaceSeedRows } from "../src/server/workspace/seed-data";

async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  const seed = workspaceSeedRows();

  // 그룹을 먼저 만든다 — User.groupId가 ProjectGroup을 참조하는 FK이므로
  // 사용자보다 그룹이 존재해야 한다. 이미 있는 그룹은 건드리지 않는다.
  const created = await db.projectGroup.createMany({
    data: seed.groups,
    skipDuplicates: true,
  });
  console.log(`그룹 시드: 신규 ${created.count} / 전체 ${seed.groups.length}`);

  // 소속 그룹은 해당 그룹 행이 실제로 있을 때만 연결한다 (FK 위반 방지)
  const seedGroup = await db.projectGroup.findUnique({
    where: { id: SEED_GROUP_ID },
  });
  const groupId = seedGroup?.id ?? null;
  if (!seedGroup) {
    console.warn(`경고: 그룹 ${SEED_GROUP_ID} 없음 — 시드 계정 소속 미지정`);
  }

  for (const user of USERS) {
    await db.user.upsert({
      where: { username: user.username },
      update: { ...user, groupId, passwordHash },
      create: { ...user, groupId, passwordHash },
    });
    console.log(`seeded: ${user.username} (${user.role}) 소속=${groupId}`);
  }

  // 프로젝트·단계·작업은 시드하지 않는다 — 실사용하며 화면에서 직접 만든다.
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
