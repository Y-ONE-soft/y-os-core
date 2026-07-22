-- 할일 담당자. 작업 현황의 담당자 보드가 "누구 할일인지"로 묶으려면 필요하다.
-- 지금까지는 배정 개념이 프로젝트 소유자(Project.ownerId)뿐이라 할일 단위로는
-- 담당자를 알 수 없었다.
--
-- 추가 전용 변경이다 — nullable 컬럼이라 기존 행은 NULL(= 미배정)이 되고,
-- 이 컬럼을 모르는 기존 코드도 그대로 동작한다. (개발·프로덕션이 DB를 공유하므로
-- 파괴적 변경은 즉시 장애가 된다 — docs/33 참고)
ALTER TABLE "Task" ADD COLUMN "assigneeId" TEXT;

-- 사용자가 삭제돼도 할일은 남아야 한다 — Project.ownerId와 같은 규칙(SetNull)
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");
