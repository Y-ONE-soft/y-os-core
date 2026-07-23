-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "deadline" TEXT;

-- 기존 데이터 백필: 일정이 잡혀 있던 할일은 그 예정일을 최초 마감일로 본다.
-- 이후 첫 조회에서 미완료·지난 할일의 scheduledDate는 오늘로 이월되지만 deadline은
-- 여기서 채운 원래 날짜로 남아, 곧바로 "며칠 미뤄짐"이 올바르게 표시된다.
UPDATE "Task" SET "deadline" = "scheduledDate" WHERE "scheduledDate" IS NOT NULL;
