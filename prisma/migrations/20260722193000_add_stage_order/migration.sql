-- 단계 표시 순서(= 화면의 단계 번호)를 명시 필드로 승격한다.
-- 기존에는 createdAt 정렬에 의존해 순서를 바꿀 수 없었고, 한꺼번에 만든 단계끼리는
-- 타임스탬프가 같아 순서가 흔들릴 수 있었다.

-- 1) NOT NULL 컬럼을 기존 행에 추가하기 위해 임시 기본값과 함께 만든다
ALTER TABLE "Stage" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- 2) 기존 데이터 정규화 — 프로젝트별로 지금 보이던 순서(createdAt, id)를 그대로 1..N에 옮긴다
UPDATE "Stage" AS s
SET "order" = numbered.rn
FROM (
  SELECT
    id,
    row_number() OVER (PARTITION BY "projectId" ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "Stage"
) AS numbered
WHERE s.id = numbered.id;

-- 3) 앞으로는 서비스가 항상 값을 계산해 넣는다 (기본값 0으로 몰려 겹치는 것을 막는다)
ALTER TABLE "Stage" ALTER COLUMN "order" DROP DEFAULT;

-- 4) 같은 프로젝트 안에서 번호 중복 금지
CREATE UNIQUE INDEX "Stage_projectId_order_key" ON "Stage"("projectId", "order");
