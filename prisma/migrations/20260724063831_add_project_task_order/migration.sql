-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- Backfill Project.order: 그룹 안에서 createdAt(동률 시 id) 순으로 0..N-1을 매긴다.
UPDATE "Project" AS p SET "order" = sub.rn
FROM (
  SELECT "id", (ROW_NUMBER() OVER (PARTITION BY "groupId" ORDER BY "createdAt", "id") - 1)::int AS rn
  FROM "Project"
) AS sub
WHERE p."id" = sub."id";

-- Backfill Task.order: 컨테이너(projectId, stageId) 안에서 createdAt(동률 시 id) 순으로 0..N-1.
-- NULL projectId·NULL stageId는 각각 하나의 컨테이너(미배정/백로그)로 묶인다.
UPDATE "Task" AS t SET "order" = sub.rn
FROM (
  SELECT "id", (ROW_NUMBER() OVER (PARTITION BY "projectId", "stageId" ORDER BY "createdAt", "id") - 1)::int AS rn
  FROM "Task"
) AS sub
WHERE t."id" = sub."id";
