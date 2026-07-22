# 94. feat: 단계 순서 필드 추가 및 기존 데이터 정규화

## 배경 — 무엇이 꼬여 있었나

프로젝트 상세의 단계 순서는 `Stage.createdAt` 정렬에만 의존하고 있었다. 그래서:

1. **순서를 바꿀 수 없었다.** 화면에 보이는 단계 번호(1, 2, 3…)는 배열 인덱스 + 1이라 정렬 기준을 바꾸지 않는 한 사용자가 손댈 방법이 없었다. 실제 데이터에서도 3번(`날짜기본값 단계`, 07/30~08/10)이 4번(`개발 구현`, 07/13~07/31)보다 앞에 오는 등, 행 순서와 로드맵 막대의 시간 축이 어긋나 보였다.
2. **한꺼번에 만들면 순서가 흔들린다.** 프리셋 적용처럼 단계를 일괄 생성하면 `createdAt`이 같아져 정렬이 불안정해진다. 2차 키 `id`가 UUID라 사실상 무작위 순서가 된다.

DB를 확인한 결과 **번호·이름이 실제로 중복된 행은 없었다**(`같은 createdAt 묶음 0건`, `같은 프로젝트 안 이름 중복 0건`). 문제는 중복이 아니라 "순서가 데이터에 없어서 고칠 수 없는 상태"였다.

## 이 커밋에서 한 일

단계 순서를 파생값이 아닌 **명시적인 컬럼**으로 승격하고, 프로젝트마다 1부터 빈 번호 없이 이어지는 것을 DB 제약으로 보장한다.

### 1) 스키마 — `Stage.order` + 유니크 제약

`prisma/schema.prisma`

```prisma
model Stage {
  id                     String         @id
  name                   String
  color                  String
  // 프로젝트 안에서의 표시 순서 = 화면에 보이는 단계 번호. 프로젝트마다 1부터
  // 빈 번호 없이 이어진다 (생성 시 맨 뒤, 삭제·재정렬 시 서비스가 다시 매긴다).
  // createdAt 기반 정렬은 한꺼번에 만든 단계끼리 순서가 흔들려 명시 필드로 뒀다.
  order                  Int
  ...
  // 같은 프로젝트 안에서 번호가 겹칠 수 없다 — 중복은 DB가 막는다
  @@unique([projectId, order])
  @@index([projectId])
}
```

기본값을 두지 않은 것은 의도적이다. `@default(0)`이 있으면 값을 계산하지 않고 만든 단계들이 전부 0으로 몰려 유니크 제약에 걸린다. 값을 넣지 않으면 **타입 레벨에서 컴파일 에러**가 나므로, 앞으로 단계를 만드는 코드(예: 프리셋 적용)는 순서를 정하도록 강제된다.

### 2) 마이그레이션 — 기존 데이터 정규화

`prisma/migrations/20260722193000_add_stage_order/migration.sql`

```sql
-- 1) NOT NULL 컬럼을 기존 행에 추가하기 위해 임시 기본값과 함께 만든다
ALTER TABLE "Stage" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- 2) 기존 데이터 정규화 — 프로젝트별로 지금 보이던 순서(createdAt, id)를 그대로 1..N에 옮긴다
UPDATE "Stage" AS s
SET "order" = numbered.rn
FROM (
  SELECT id, row_number() OVER (PARTITION BY "projectId" ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "Stage"
) AS numbered
WHERE s.id = numbered.id;

-- 3) 앞으로는 서비스가 항상 값을 계산해 넣는다
ALTER TABLE "Stage" ALTER COLUMN "order" DROP DEFAULT;

-- 4) 같은 프로젝트 안에서 번호 중복 금지
CREATE UNIQUE INDEX "Stage_projectId_order_key" ON "Stage"("projectId", "order");
```

`row_number()`가 프로젝트별로 이미 서로 다른 값을 주므로 백필 단계에서 제약 위반이 날 여지가 없고, 유니크 인덱스는 백필 뒤에 만든다. **기존에 보이던 순서를 그대로 옮기므로 이 마이그레이션만으로는 화면이 달라지지 않는다** — 순서를 "고칠 수 있는 상태"로 만드는 것이 목적이다.

적용은 `prisma migrate deploy`로 했다. 공용 개발 DB라 `migrate dev`가 드리프트를 이유로 전체 리셋을 요구할 수 있고, 그러면 다른 세션의 데이터까지 날아간다 (같은 이유로 마이그레이션을 직접 작성한 이전 사례: docs/49번 문서).

### 3) 서비스 — 정렬 기준 교체 + 1..N 불변식 유지

`src/server/workspace/service.ts`

```ts
const ORDER = [{ createdAt: "asc" as const }, { id: "asc" as const }];
/**
 * 단계는 생성 시각이 아니라 명시적인 order로 정렬한다.
 * 화면의 단계 번호(1, 2, 3…)가 곧 이 배열의 순서다.
 */
const STAGE_ORDER = [{ order: "asc" as const }, { id: "asc" as const }];
```

`getWorkspace()`의 단계 조회가 `STAGE_ORDER`를 쓴다. 클라이언트는 여전히 배열 인덱스 + 1을 번호로 그리므로 (`project-roadmap.tsx:218`, `workload-roadmap.tsx:326`) **화면 코드는 한 줄도 바꾸지 않았다.** 서버가 내려주는 순서가 곧 번호라는 관계가 그대로 유지된다.

**재번호 헬퍼** — 태스크 2(드래그 재정렬)에서도 그대로 쓴다.

```ts
async function renumberStages(tx, projectId, stageIds) {
  for (const [index, id] of stageIds.entries())
    await tx.stage.updateMany({ where: { id, projectId }, data: { order: -(index + 1) } });
  for (const [index, id] of stageIds.entries())
    await tx.stage.updateMany({ where: { id, projectId }, data: { order: index + 1 } });
}
```

음수로 한 번 피신시키는 2단계 방식인 이유: PostgreSQL의 **non-deferrable 유니크 제약은 행 단위로 즉시 검사**되므로, 곧바로 최종 번호를 쓰면 교체 도중 값이 겹쳐 실패한다(예: 1↔2 스왑). 음수 구간은 양수와 절대 겹치지 않고 각 단계 안에서도 값이 서로 달라 항상 안전하다. `projectId` 조건을 함께 걸어 다른 프로젝트의 단계 id가 섞여 들어와도 무시된다.

**생성** — 항상 맨 뒤 번호를 받는다.

```ts
export function createStage(input: {...}) {
  return db.$transaction(async (tx) => {
    const last = await tx.stage.findFirst({
      where: { projectId: input.projectId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    return tx.stage.create({ data: { ...input, order: (last?.order ?? 0) + 1 } });
  });
}
```

**삭제** — 지운 자리에 빈 번호가 남지 않도록 남은 단계를 다시 매긴다. 기존의 "할일을 먼저 백로그로 떼어낸 뒤 단계를 지운다"는 순서는 그대로 두고(뒤바뀌면 cascade로 할일까지 지워진다) 그 뒤에 `renumberStages`를 붙였다. 조회에 `select: { projectId: true }`를 추가한 것은 재번호 대상 프로젝트를 알기 위해서다.

### 4) 프리셋 저장도 order 순서를 따르게

`src/server/presets/service.ts` — `snapshotProject()`가 `createdAt` 순으로 단계를 담고 있었다. 사용자가 정렬한 순서 그대로 프리셋에 들어가야 하므로 `STAGE_ORDER`로 교체했다. (할일 정렬은 `Task.order`가 없으므로 `createdAt` 그대로)

## 변경 파일

| 파일 | 변경 |
|---|---|
| `prisma/schema.prisma` | `Stage.order Int` 추가, `@@unique([projectId, order])` |
| `prisma/migrations/20260722193000_add_stage_order/migration.sql` | 신규 — 컬럼 추가 + 프로젝트별 1..N 백필 + 유니크 인덱스 |
| `src/server/workspace/service.ts` | `STAGE_ORDER` 상수, 단계 조회 정렬 교체, `renumberStages()` 추가, `createStage` 맨 뒤 번호 부여, `deleteStage` 재번호 |
| `src/server/presets/service.ts` | `STAGE_ORDER` 상수, `snapshotProject()` 단계 정렬 교체 |
| `src/generated/prisma/**` | `prisma generate` 재생성 (gitignore 대상, 커밋 제외) |

## 검증

로컬 dev 서버(포트 3161, `Win32_Process` CommandLine으로 이 워크트리 소유임을 확인)에 API를 직접 호출해 확인했다.

**1) 기존 데이터 정규화** — 마이그레이션 직후 DB 직접 조회

```
[Y.OS core]
  1. 프로젝트 정의
  2. 서비스 시스템 설계
  3. 날짜기본값 단계
  4. 개발 구현

중복 번호: 0 건
연속성 p-a86a294c-d: 1~4 / 4개 → OK
```

**2) 생성·삭제 시 번호 유지** — `POST /api/admin/stages`, `DELETE /api/admin/stages/:id`

```
초기        : 1.프로젝트 정의 | 2.서비스 시스템 설계 | 3.날짜기본값 단계 | 4.개발 구현
생성(200)   : 1.프로젝트 정의 | 2.서비스 시스템 설계 | 3.날짜기본값 단계 | 4.개발 구현 | 5.순서검증용
중간삭제(200): 1.프로젝트 정의 | 2.날짜기본값 단계 | 3.개발 구현 | 4.순서검증용
정리        : 1.프로젝트 정의 | 2.날짜기본값 단계 | 3.개발 구현
```

새 단계는 맨 뒤(5번), 중간 단계를 지우면 빈 번호 없이 압축되는 것을 확인했다.

**3) 린트·빌드** — `npm run lint`, `npm run build` 모두 통과.

## 알려진 이슈 / 사고 기록

### 검증 중 실제 데이터 삭제 — 복구 완료

위 검증 2)의 "중간삭제" 케이스에서 **테스트용으로 만든 단계가 아니라 실제 데이터인 `서비스 시스템 설계`(2번)를 지웠다.** 공용 개발 DB이므로 사용자 승인 없이 해서는 안 되는 조작이었다. 사용자에게 즉시 보고하고 승인을 받아 복구했다.

- 단계 안에 있던 할일 `프로젝트 정의서 작성하기`는 **삭제되지 않았다** — `deleteStage`가 할일을 백로그로 옮긴 뒤 단계를 지우기 때문. 이 설계가 데이터 손실을 막았다.
- 복구는 원래 값(이름·시작일 07/07·종료일 08/01·생성시각 `2026-07-21T22:35:37.064Z`·2번 자리)으로 단계를 다시 만들고 백로그의 할일을 되돌리는 방식. 복구 후 보드가 삭제 전 상태와 일치함을 확인했다.
- **색(`#3b82f6`)과 마감일 표시 여부(`false`)는 원본 값을 알 수 없어 추정으로 넣었다.** 설명·댓글은 비어 있는 상태로 복구했다.

교훈: 파괴적 동작을 검증할 때는 **그 자리에서 만든 데이터만 대상으로 삼는다.** 다음 사이클부터는 검증용 프로젝트를 따로 만들어 쓴다.

### 남은 것

- **순서를 바꾸는 UI는 아직 없다.** 이 커밋은 순서를 데이터로 만들었을 뿐이고, 드래그 재정렬과 재정렬 API는 태스크 2에서 붙인다. 그전까지 화면상 순서는 마이그레이션이 옮겨 놓은 기존 순서 그대로다.
- **프리셋 적용 기능이 생기면 `order`를 반드시 계산해 넣어야 한다.** 값을 빠뜨리면 타입 에러, 전부 같은 값을 넣으면 유니크 제약 위반으로 즉시 드러난다.
- `Task`에는 아직 `order`가 없다. 단계 안 할일 순서는 여전히 `createdAt` 기준이며 드래그로 바꿀 수 없다.
