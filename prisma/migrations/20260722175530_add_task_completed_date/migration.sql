-- 작업 완료날짜: YYYY-MM-DD 문자열 (scheduledDate와 동일 규격 — TZ 이슈 회피)
ALTER TABLE "Task" ADD COLUMN "completedDate" TEXT;
