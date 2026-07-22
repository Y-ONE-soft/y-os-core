-- 작업 미배정 상태: projectId를 nullable로 (null = 어느 프로젝트에도 속하지 않음)
ALTER TABLE "Task" ALTER COLUMN "projectId" DROP NOT NULL;

-- 작업 예정일: YYYY-MM-DD 문자열 (Stage.startDate와 동일 규격 — TZ 이슈 회피)
ALTER TABLE "Task" ADD COLUMN "scheduledDate" TEXT;
