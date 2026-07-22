# refactor: 스탭 프로젝트 목록을 작업자 기준으로 전환

요청 사이클 `스탭-프로젝트-생성`의 3번(마지막) 태스크. 스탭 화면의 프로젝트 목록을 하드코딩 상수가 아니라 **`Project.ownerId`** 기준으로 판정하도록 바꾼다.

이 커밋으로 사용자 요청이 완결된다. 2번 태스크에서 생성 자체는 성공하게 됐지만, 목록이 상수로 걸러지고 있어 **새로 만든 프로젝트가 화면에 나타나지 않았다.**

## 문제

`src/lib/constants.ts`에 배정 목록이 상수로 박혀 있었다.

```ts
// 스탭에게 배정된 프로젝트 — 배정(멤버) 도메인 도입 전 자리표시.
export const STAFF_ASSIGNED_PROJECT_IDS = ["p-cms", "p-yos", "p-contents"];
```

소비자는 두 곳이었다.

- `src/components/layout/projects-nav.tsx` — 사이드바 스탭 프로젝트 플랫 리스트
- `src/components/features/projects/task-status-page.tsx` — 작업 현황 페이지의 프로젝트 칩 풀

시드 프로젝트 3개의 id를 그대로 나열한 값이라, 스탭이 새 프로젝트를 만들어도 **정의상 목록에 낄 수 없었다.**

추가로 사이드바의 `staffGroupId`는 이렇게 계산됐다.

```ts
const staffGroupId = staffProjects[0]?.groupId ?? groups[0]?.id;
```

"배정 상수 첫 프로젝트가 속한 그룹, 없으면 아무 그룹" — 사용자 소속과 무관한 값이다. 1번 태스크에서 `User.groupId`가 생겼으므로 이 우회는 더 이상 필요 없다.

## 변경 내용

### 1. `src/types/workspace.ts` — DTO에 작업자 노출

```ts
export type Project = {
  id: string;
  name: string;
  color: string;
  /** 작업자(User.id) — 스탭 화면의 "내 프로젝트" 판정 기준. 미지정이면 null */
  ownerId: string | null;
};
```

`ownerId`를 옵셔널(`?`)이 아니라 **필수 + nullable**로 두었다. 옵셔널이면 매핑 누락이 타입 검사를 통과해버려, 작업자 정보가 조용히 빠진 채 목록이 비는 사고가 난다. 필수로 두면 응답을 만드는 모든 경로가 값을 채우도록 컴파일러가 강제한다.

### 2. `src/server/workspace/service.ts` — 응답에 `ownerId` 포함

`getWorkspace()`의 프로젝트 매핑에 `ownerId: project.ownerId` 한 줄 추가. Prisma는 이미 전체 컬럼을 조회하고 있어 쿼리 변경은 없다.

### 3. `src/lib/constants.ts` — 상수 제거

`STAFF_ASSIGNED_PROJECT_IDS` 및 주석 삭제. `SESSION_COOKIE`·`TEAM_MEMBERS`는 유지.

### 4. `src/components/layout/projects-nav.tsx`

```ts
// 스탭: 자기가 작업자인 프로젝트만 플랫 리스트로.
const staffProjects = groups.flatMap((group) =>
  group.projects
    .filter((project) => !!user && project.ownerId === user.id)
    .map((project) => ({ project, groupId: group.id })),
);
// 생성 시 소속 그룹은 서버가 세션 기준으로 강제한다. 여기서 넘기는 값은
// 낙관적 업데이트로 새 프로젝트를 어느 그룹에 끼울지 정하는 용도.
const staffGroupId = user?.groupId ?? undefined;
```

`staffGroupId`를 세션의 소속 그룹에서 직접 가져온다. "프로젝트 추가" 버튼 노출 조건(`!isMaster && staffGroupId`)은 그대로 두었고, 이제 **소속 그룹이 없는 스탭에게는 버튼이 안 보인다** — 2번 태스크에서 서버가 400으로 막는 경우와 UI가 일치한다.

`STAFF_ASSIGNED_PROJECT_IDS` import 제거.

### 5. `src/components/features/projects/task-status-page.tsx`

프로젝트 칩 풀 필터를 동일하게 바꾸고 import 제거.

```ts
: groups
    .flatMap((group) => group.projects)
    .filter((project) => !!user && project.ownerId === user.id);
```

### 6. `src/components/features/projects/project-store.tsx` — 낙관적 업데이트 정합

`Project`에 `ownerId`가 필수가 되면서 `addProject`의 낙관적 삽입도 값을 채워야 한다. 서버가 "만든 사람 = 작업자"로 정하므로 클라이언트도 같은 값을 쓴다.

```ts
// 작업자는 서버가 "만든 사람"으로 정한다 — 낙관적 값도 동일하게 맞춘다
projects: [...group.projects, { id, name, color, ownerId: user?.id ?? null }],
```

`ProjectStoreProvider`는 `src/app/(main)/layout.tsx`에서 `SessionProvider` **안쪽**에 마운트되므로 `useSession()`을 안전하게 쓸 수 있다(확인 후 적용). `addProject(groupId, name)` 시그니처는 그대로 유지해 호출부 변경을 만들지 않았다.

이 값이 서버와 어긋나면 새로고침 전까지 새 프로젝트가 목록에서 사라져 보인다. 낙관적 값과 서버 규칙을 한 규칙("생성자")으로 묶어둔 이유다.

## 검증

`npm run build` 성공(타입 검사 포함), `npm run lint` 경고 0. dev 서버(포트 3011)로 end-to-end 확인했다.

### 스탭이 만든 프로젝트가 목록에 들어오는가 (핵심)

**`groupId`를 아예 보내지 않고** 생성했다 — 2번 태스크 이후 스탭에게 불필요한 필드임을 함께 확인.

```bash
curl -b step.txt -X POST /api/admin/projects \
  -d '{"id":"p-e2e-staff","name":"스탭이 만든 프로젝트","color":"#06b6d4"}'
# {"ok":true} [HTTP 200]
```

이어서 `GET /api/admin/workspace` 응답:

```
세션: step01 | id: cmrvd0b320001yoms9einz79v | 소속: g-soft

  [g-soft     ] p-yos          owner=cmrvd0b320  YOS   ← 내 프로젝트
  [g-soft     ] p-contents     owner=cmrvd0b320  Y.OS CONTENTS   ← 내 프로젝트
  [g-soft     ] p-e2e-staff    owner=cmrvd0b320  스탭이 만든 프로젝트   ← 내 프로젝트
  [g-printing ] p-4f0d0cd9-...  owner=null        123
```

- 새 프로젝트가 소속 그룹 `g-soft`에 들어갔다(요청에 그룹을 안 보냈는데도)
- `ownerId`가 세션 사용자와 일치 → 사이드바 필터 `project.ownerId === user.id`에 걸린다
- 작업자가 없는 타 그룹 프로젝트는 걸러진다

### 페이지 렌더 회귀

| 계정 | 경로 | 결과 |
|---|---|---|
| step01 | `/` · `/projects` · `/projects/my-tasks` | 200 |
| master01 | `/` · `/projects` | 200 |

검증용 `p-e2e-staff`는 삭제했다(count = 1).

## 변경 파일 내역

| 파일 | 구분 | 내용 |
|---|---|---|
| `src/types/workspace.ts` | 수정 | `Project.ownerId` 추가 (필수 + nullable) |
| `src/server/workspace/service.ts` | 수정 | `getWorkspace` 응답에 `ownerId` 포함 |
| `src/lib/constants.ts` | 수정 | `STAFF_ASSIGNED_PROJECT_IDS` 제거 |
| `src/components/layout/projects-nav.tsx` | 수정 | 스탭 목록을 `ownerId` 기준으로, `staffGroupId`를 세션 소속으로 |
| `src/components/features/projects/task-status-page.tsx` | 수정 | 프로젝트 칩 풀을 `ownerId` 기준으로 |
| `src/components/features/projects/project-store.tsx` | 수정 | 낙관적 삽입에 `ownerId` 반영, `useSession` 사용 |

## 알려진 이슈 / 주의점

### 배정이 아니라 소유다

지금 판정은 "내가 **작업자**인 프로젝트"이며 1인 소유 모델이다. 여러 명이 한 프로젝트에 배정되는 상황은 표현할 수 없다. `Stage.requestedCollaborators`, `TEAM_MEMBERS` 자리표시가 이미 있는 것으로 보아 배정(멤버) 도메인이 예정돼 있고, 그때 `ownerId` 단일 판정은 배정 테이블 조인으로 대체돼야 한다.

### 작업자 없는 기존 프로젝트는 어느 스탭에게도 안 보인다

`ownerId`가 `null`인 프로젝트(예: `p-wise`, 마스터가 만든 프로젝트)는 스탭 목록에 나타나지 않는다. 1번 태스크의 시드 백필이 시드 3건을 step01에 붙여둔 이유다. 운영 데이터에서는 작업자 지정 UI가 필요하다.

### `lib/api/workspace.ts`의 `createProjectApi`는 여전히 `groupId`를 필수로 받는다

마스터 경로가 이 값을 쓰므로 시그니처는 유지했다. 스탭 경로에서는 세션 소속 그룹을 넘기고 서버가 다시 세션 기준으로 덮어쓴다(이중 안전장치). 타입상 스탭에게 불필요한 인자가 남아 있는 셈이라, 배정 도메인 작업 시 마스터/스탭 호출을 분리하면 더 깔끔해진다.

### 공유 개발 DB 상태

2번 태스크 문서에 적은 대로, 검증 중 시드 프로젝트 `p-cms`·`p-wise`가 외부 요인으로 삭제된 상태였다. 이번 검증은 남아 있는 `p-yos`·`p-contents`와 새로 만든 프로젝트로 수행했으며 결론에 영향은 없다.

---

## 사후 검증 결과 (추록)

push 이후에만 확정되는 항목을 보완한다. 이 요청 사이클(브랜치 `스탭-프로젝트-생성`) 전체에 해당한다.

### 최신 main 리베이스

PR 생성 직전 확인 시 main이 `60b712d`(PR #24) → `2ff02ce`(PR #28)로 앞서가 있었다. 병렬 세션의 PR #25~#28이 먼저 머지된 결과다.

- `git rebase origin/main` — **충돌 없이 성공**. 특히 `src/server/workspace/service.ts`는 다른 세션이 `updateTask`를 재작성했고 이 브랜치는 `createProject`·`getWorkspace`를 수정했는데, 함수가 분리돼 있어 자동 병합됐다.
- 리베이스 후 `npm install` → `npx prisma generate` → `npm run build` 성공, `npm run lint` 경고 0
- 리베이스 후 런타임 재검증: 스탭 생성 → 워크스페이스 응답에 `ownerId` 포함, 소속 그룹 `g-soft`에 배치 확인

### 문서 번호 재조정

PR #25~#28이 `docs/30`~`docs/33`을 선점해, "나중에 머지되는 쪽이 번호를 올린다"는 규칙에 따라 `30~32` → `34~36`으로 조정했다(별도 docs 커밋).

### 프리뷰 배포

- 커밋 `5766b37` 기준 Vercel 체크 **pass** (`Deployment has completed`)
- 프리뷰 URL: `https://y-os-core-8tm0yvnck-project-hosting-center.vercel.app`
- **주의**: 프리뷰 배포는 Vercel Authentication(SSO)이 켜져 있어 외부에서 API를 직접 호출할 수 없다(`401 Protected deployment`). 따라서 프리뷰에서의 기능 검증은 수행하지 못했고, 빌드 성공까지만 확인했다. 기능 검증은 로컬 dev 서버(포트 3011) 결과로 갈음한다.

### 프로덕션 DB 마이그레이션 적용 여부 (중요)

빌드 스크립트는 `prebuild: prisma generate`만 실행하며 **`prisma migrate deploy`를 하지 않는다.** 따라서 프로덕션이 별도 DB였다면 머지 즉시 `User.groupId`/`Project.ownerId` 부재로 런타임이 깨진다. 다음을 확인했다.

- Vercel의 `DATABASE_URL`·`DATABASE_URL_UNPOOLED` 등은 **Production·Preview·Development 공용 단일 값**으로 설정돼 있다
- `vercel env pull`로 받은 로컬 값의 호스트가 `ep-red-breeze-awsaj2pk`이며, 이 DB에 1번 태스크의 마이그레이션을 이미 적용했다(`migrate status` = up to date)

즉 프로덕션은 마이그레이션이 적용된 동일 DB를 바라보므로 추가 조치가 필요 없다. **다만 이는 현재 환경 구성에 의존한 결론이다.** 운영 DB를 분리하는 시점에는 배포 파이프라인에 `prisma migrate deploy` 단계를 반드시 추가해야 한다.

### 머지 후 프로덕션 배포

머지가 트리거한 프로덕션 배포 결과는 아래 "머지 후 프로덕션 배포 확인" 절에 기록한다.
