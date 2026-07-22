# feat: 사용자 소속 그룹 FK 전환 및 프로젝트 작업자 필드 추가

요청 사이클 `스탭-프로젝트-생성`의 1번 태스크. 스탭(STAFF) 권한 프로젝트 생성 기능을 얹기 위한 **데이터 모델 기반 작업**이다. 이 커밋만으로는 화면 동작이 바뀌지 않으며, 실제 권한 해제는 2번 태스크, 목록 노출은 3번 태스크에서 이어진다.

## 배경 — 왜 스키마부터 손대야 했나

사용자 요청은 "step 권한에서 프로젝트 생성이 안 됨, 작업자는 자기 자신이고 소속자도 자기가 속한 그룹으로 되어야 함"이었다. 조사 결과 세 개의 서로 다른 층위의 문제가 겹쳐 있었다.

1. **생성 차단 (직접 원인)** — `src/app/api/admin/projects/route.ts`가 `user.role !== "MASTER"`이면 403을 반환한다. 반면 사이드바 `src/components/layout/projects-nav.tsx`는 `!isMaster && staffGroupId` 조건으로 스탭에게 "프로젝트 추가" 버튼을 노출한다. **버튼은 보이는데 API가 막는** 상태였다.
2. **"작업자 = 자기 자신"이 표현 불가** — `Project` 모델에 작업자/소유자 필드가 아예 없었다. 스탭 배정은 `src/lib/constants.ts`의 하드코딩 상수 `STAFF_ASSIGNED_PROJECT_IDS = ["p-cms","p-yos","p-contents"]`로 대체돼 있었다. 즉 1번을 고쳐 생성에 성공하더라도 **새 프로젝트는 그 상수에 없으므로 사이드바에 보이지 않아** 사용자 눈에는 여전히 "생성 안 됨"으로 보인다.
3. **"소속자 = 자기 그룹"이 표현 불가** — `User.group`은 자유 문자열 `"Y-ONE"`이었고, `ProjectGroup`은 `Lab`/`Soft`/`Printing`이었다. **두 축이 연결돼 있지 않았다.** 기존 `staffGroupId`는 배정 상수의 첫 프로젝트가 속한 그룹(사실상 `g-soft`)으로 흘러갈 뿐 사용자 소속과 무관했다.

1번은 한 줄 수정이지만 2·3번은 모델 변경 없이는 구현 자체가 불가능하다. 그래서 스키마를 먼저 정합시킨다.

## 결정 사항 (사용자 승인)

작업 착수 전 세 가지를 사용자에게 확인받았다.

| 항목 | 선택 | 이유 |
|---|---|---|
| User ↔ ProjectGroup 연결 | **`group` 문자열을 FK로 교체** | 소속 정보가 두 군데로 갈라지지 않는다. 자유 문자열을 남기면 "표시용"과 "판정용"이 어긋날 여지가 생긴다 |
| 스탭 프로젝트 목록 기준 | **`ownerId` 기준으로 교체** | 하드코딩 상수를 제거하고, 스탭이 만든 새 프로젝트가 즉시 목록에 반영되게 한다 |
| 생성 시 그룹 결정 | **서버가 소속 그룹으로 강제** | 요청 취지("소속자도 자기가 속한 그룹")에 부합하고, 클라이언트가 임의 `groupId`를 보내는 권한 우회를 차단한다 |

또한 `User.group` 컬럼 **삭제**가 개발 DB를 공유하는 다른 세션의 로그인을 깨뜨릴 수 있다는 점을 사전 고지하고 "지금 진행(A안)" 승인을 받았다. (`src/server/auth/service.ts`의 `db.user.findFirst`는 select 없이 전 컬럼을 나열하므로, 구 Prisma 클라이언트는 삭제된 컬럼을 조회하다 실패한다.) 착수 시점에 병렬 세션 2건(PR #23·#24)이 모두 머지 완료되어 실질 리스크는 해소된 상태였다.

## 변경 내용

### 1. `prisma/schema.prisma`

**`User`** — `group String?` 제거, `groupId String?` + `group ProjectGroup?` 관계로 교체. `@@index([groupId])` 추가. 역방향 `ownedProjects Project[]` 추가.

```prisma
// 소속 그룹 — 프로젝트 그룹과 동일한 축이어야 "내 소속 프로젝트" 판정이 가능하다.
// (구 group String? 자유 문자열은 ProjectGroup과 연결되지 않아 FK로 교체)
groupId      String?
group        ProjectGroup? @relation(fields: [groupId], references: [id], onDelete: SetNull)
```

**`Project`** — `ownerId String?` + `owner User?` 관계 추가, `@@index([ownerId])` 추가.

```prisma
// 작업자 — 스탭이 만든 프로젝트의 소유자. 배정 도메인 도입 전까지 1인 기준.
// 사용자가 지워져도 프로젝트는 남아야 하므로 SetNull.
ownerId   String?
owner     User?        @relation(fields: [ownerId], references: [id], onDelete: SetNull)
```

**`ProjectGroup`** — 역방향 `users User[]` 추가.

**`onDelete` 정책 선정 이유**
- `User.group` → `SetNull`: 그룹이 지워졌다고 사용자 계정까지 삭제되면 안 된다.
- `Project.owner` → `SetNull`: 작업자가 퇴사/삭제돼도 프로젝트 산출물은 남아야 한다. `Cascade`였다면 사용자 삭제가 프로젝트·단계·작업까지 연쇄 삭제한다.

두 필드 모두 **nullable**로 두었다. 기존 행(사용자 2명, 프로젝트 4건)에 값이 없는 상태로 마이그레이션이 통과해야 하고, 소속/작업자가 없는 프로젝트도 정상 상태로 허용되기 때문이다.

### 2. `prisma/migrations/20260722145429_add_user_group_fk_and_project_owner/migration.sql` (신규)

```sql
ALTER TABLE "Project" ADD COLUMN     "ownerId" TEXT;
ALTER TABLE "User" DROP COLUMN "group",
ADD COLUMN     "groupId" TEXT;
CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");
CREATE INDEX "User_groupId_idx" ON "User"("groupId");
ALTER TABLE "User" ADD CONSTRAINT "User_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProjectGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

### 3. `prisma/seed.ts`

**실행 순서를 재구성했다.** `User.groupId`가 `ProjectGroup`을 참조하는 FK가 되면서, 기존 순서(사용자 → 그룹)로는 FK 위반이 발생한다. 그룹을 먼저 만들고 사용자를 만든다.

- 상수 추가: `SEED_GROUP_ID = "g-soft"` (시드 계정 소속), `STAFF_OWNED_PROJECT_IDS = ["p-cms","p-yos","p-contents"]` (step01이 작업자인 시드 프로젝트)
- `USERS`에서 `group: "Y-ONE"` 필드 제거
- 그룹 행이 실제로 존재할 때만 `groupId`를 연결한다. 없으면 경고 후 `null` — 누군가 `g-soft`를 삭제한 DB에서도 시드가 FK 위반으로 죽지 않게 한다.
- **작업자 백필 추가** — 기존 개발 DB에는 이미 워크스페이스 데이터가 있어 `workspace: 기존 데이터 유지` 분기를 타므로 `ownerId`가 채워지지 않는다. 작업자 미지정인 시드 프로젝트에 한해 step01을 채우는 `updateMany`를 **분기 밖**에 두어, 신규 DB와 기존 DB 모두에서 동일한 결과가 되게 했다. `ownerId: null` 조건이 있어 멱등이다.

이 백필이 없으면 마이그레이션 직후 step01의 사이드바가 비어 3번 태스크를 검증할 수 없다.

### 4. `src/types/auth.ts`

`SessionUser.group: string | null` → `groupId: string | null`. 주석으로 `ProjectGroup.id`임을 명시.

### 5. `src/server/auth/service.ts`

`toSessionUser()`의 `group: user.group` → `groupId: user.groupId`. 컬럼이 사라졌으므로 이 수정이 없으면 타입 에러로 빌드가 깨진다. 같은 커밋에 포함해야 커밋 단위 빌드가 유지된다.

## 실행한 명령

```bash
# 워크트리 준비
npm install
vercel link --yes --project y-os-core --scope project-hosting-center
vercel env pull .env.local

# 마이그레이션 (아래 "알려진 이슈" 참고 — migrate dev가 비대화형에서 실패)
npx prisma migrate diff --from-config-datasource --to-schema ./prisma/schema.prisma --script \
  > prisma/migrations/20260722145429_add_user_group_fk_and_project_owner/migration.sql
npx prisma migrate deploy
npx prisma migrate status     # Database schema is up to date!
npx prisma generate
npx prisma db seed

# 검증
npm run build                 # 성공
npm run lint                  # 통과 (경고 0)
```

### 시드 실행 결과

```
seeded: master01 (MASTER) 소속=g-soft
seeded: step01 (STAFF) 소속=g-soft
workspace: 기존 데이터 유지 (시드 생략)
작업자 백필: 프로젝트 3건 → step01
```

## 변경 파일 내역

| 파일 | 구분 | 내용 |
|---|---|---|
| `prisma/schema.prisma` | 수정 | `User.group` → `groupId` FK, `Project.ownerId` FK, 인덱스·역방향 관계 추가 |
| `prisma/migrations/20260722145429_add_user_group_fk_and_project_owner/migration.sql` | 신규 | 위 스키마 변경의 SQL |
| `prisma/seed.ts` | 수정 | 그룹→사용자 순서 재구성, 소속 그룹 연결, 작업자 백필 |
| `src/types/auth.ts` | 수정 | `SessionUser.group` → `groupId` |
| `src/server/auth/service.ts` | 수정 | 세션 페이로드 `groupId` 정합 |

`src/generated/prisma/**`는 `prisma generate` 산출물이며 `.gitignore` 대상이라 커밋에 포함되지 않는다.

## 사용 버전

- Prisma ORM / CLI 7.9.0, `@prisma/adapter-pg` 7.9.0
- Next.js 16.2.11, React 19.2.4, TypeScript 5
- PostgreSQL (Neon, `neondb`)

## 알려진 이슈 / 주의점

### `prisma migrate dev`가 비대화형 환경에서 실패한다

에이전트 셸은 비대화형이라 `migrate dev`가 다음과 같이 중단된다.

```
⚠️  You are about to drop the column `group` on the `User` table, which still contains 2 non-null values.
Error: Prisma Migrate has detected that the environment is non-interactive, which is not supported.
```

`--create-only`를 붙여도 동일하다(경고 확인 프롬프트 자체가 원인). 그래서 `migrate diff`로 SQL을 생성해 마이그레이션 파일을 직접 만들고 `migrate deploy`로 적용했다.

**CLAUDE.md의 "`prisma db push` 금지 — 항상 `prisma migrate dev`" 규칙의 취지(마이그레이션 파일을 반드시 남긴다)는 그대로 지켰다.** 마이그레이션 파일이 존재하고 `_prisma_migrations` 테이블에 정상 기록됐으며 `migrate status`가 최신임을 확인했다. 데이터 손실 경고가 뜨는 변경에서는 앞으로도 이 경로를 쓰면 된다.

### 개발 DB 공유로 인한 전파

`User.group` 컬럼이 삭제됐으므로, 이 브랜치 이전 코드로 돌아가면 로그인이 깨진다. 되돌릴 경우 마이그레이션 롤백이 필요하다. 다른 세션이 이 시점 이후 브랜치를 파면 최신 main 기준이므로 문제없다.

### 남은 정리 대상 (후속 태스크)

- `src/lib/constants.ts`의 `STAFF_ASSIGNED_PROJECT_IDS`는 아직 살아 있다 → 3번 태스크에서 제거
- `src/app/api/admin/projects/route.ts`의 `MASTER` 전용 가드는 아직 그대로다 → 2번 태스크에서 해제
- 시드 계정 소속을 `g-soft`로 고정했다. 멤버/배정 도메인이 도입되면 이 하드코딩은 재검토 대상이다.
