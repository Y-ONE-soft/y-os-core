# fix: 스탭 권한에서 자기 프로젝트 삭제 가능하도록 수정

## 작업 요약

스탭(`STAFF`) 계정에서 프로젝트 삭제가 동작하지 않던 문제를 수정했다. 서버와 프론트 양쪽이 모두 막혀 있었다.

스탭은 자기가 작업자(`ownerId`)인 프로젝트만 삭제할 수 있고, 마스터는 종전대로 전체 프로젝트를 삭제할 수 있다.

## 원인

### 1. 서버 — 스탭은 무조건 403

`src/app/api/admin/projects/[projectId]/route.ts`의 DELETE 핸들러가 마스터만 통과시켰다.

```ts
if (user.role !== "MASTER") return forbidden();
```

반면 생성(`POST /api/admin/projects`)은 로그인만 요구하고, 스탭이 만든 프로젝트에는 `ownerId = user.id`가 박힌다. **스탭은 프로젝트를 만들 수는 있는데 지울 수는 없는 비대칭 상태**였다.

### 2. 프론트 — 삭제 메뉴 자체가 없음

`src/components/layout/projects-nav.tsx`에서 스탭 프로젝트 행은 맨 `Link`로만 렌더됐다. 마스터 행만 `ContextMenu`로 감싸 "프로젝트 삭제" 항목을 달고 있어, 스탭은 우클릭해도 메뉴가 뜨지 않았다.

즉 서버 가드를 풀기만 해서는 UI에서 삭제를 호출할 경로가 없어 여전히 안 됐을 문제다.

## 권한 범위 결정 — "자기가 작업자인 프로젝트만"

세 가지 선택지 중 **스탭은 자기 소유 프로젝트만 삭제**로 정했다.

| 안 | 범위 | 판단 |
| --- | --- | --- |
| A (채택) | `ownerId === user.id` | 스탭 사이드바가 이미 이 조건으로 필터링하므로 화면에 보이는 것 = 지울 수 있는 것으로 일치한다 |
| B | 같은 그룹 전체 | 사이드바에 보이지도 않는 프로젝트를 지울 수 있게 되어 UI와 어긋난다 |
| C | 전체 | 마스터/스탭 구분이 사라진다 |

`projects-nav.tsx`의 기존 필터가 A와 동일한 조건이라 모델 변경 없이 일관성이 맞는다.

```ts
// 스탭: 자기가 작업자인 프로젝트만 플랫 리스트로.
.filter((project) => !!user && project.ownerId === user.id)
```

## 변경 파일 내역

### `src/server/workspace/service.ts`

`deleteProject`에 소유자 스코프 옵션을 추가하고 삭제 건수를 호출부가 쓸 수 있게 했다.

```ts
export function deleteProject(id: string, opts?: { ownerId?: string }) {
  return db.project.deleteMany({
    where: { id, ...(opts?.ownerId ? { ownerId: opts.ownerId } : {}) },
  });
}
```

`ownerId`를 **쿼리 조건에 넣는 것이 핵심**이다. "조회 후 비교"가 아니라 삭제 조건 자체에 넣어, 스탭이 남의 프로젝트 id를 직접 API로 호출해도 0건이 되어 걸러진다. 기존 호출부(마스터 경로)는 인자를 안 넘기면 종전과 동일하게 동작한다.

### `src/app/api/admin/projects/[projectId]/route.ts`

역할별 스코프를 서비스에 넘기고, 스탭 0건을 403으로 응답한다.

```ts
const isMaster = user.role === "MASTER";

const { count } = await deleteProject(
  projectId,
  isMaster ? undefined : { ownerId: user.id },
);

if (!isMaster && count === 0) return forbidden();
```

- **스탭 0건은 403** — 남의 프로젝트인 경우와 이미 없는 경우를 구분하지 않는다. 구분해서 404/403을 다르게 주면 존재 여부가 새어 나가기 때문이다.
- **마스터는 멱등 유지** — 마스터에 `count === 0` 검사를 걸지 않은 것은 의도적이다. 기존 DELETE는 없는 id에도 `ok: true`를 반환했고, 여기에 403을 붙이면 프론트의 낙관적 업데이트가 실패로 판정해(`cache.persist`의 `catch`) 불필요한 재동기화가 돈다. 마스터 쪽 기존 동작을 건드리지 않았다.

### `src/components/layout/projects-nav.tsx`

스탭 프로젝트 행을 마스터 행과 같은 형태로 `ContextMenu`로 감쌌다.

```tsx
<ContextMenu>
  <ContextMenuTrigger asChild>
    <Link href={href} ...>...</Link>
  </ContextMenuTrigger>
  <ContextMenuContent className="w-44">
    <ContextMenuItem
      variant="destructive"
      onSelect={() => deleteProject(groupId, project.id)}
    >
      프로젝트 삭제
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

- `staffProjects.map(({ project }) => ...)` → `({ project, groupId })`로 변경. 스토어의 `deleteProject(groupId, projectId)` 시그니처가 낙관적 업데이트에서 어느 그룹의 배열을 갱신할지 정하는 데 `groupId`를 쓴다. `staffProjects`가 이미 `groupId`를 함께 담고 있어 추가 조회가 필요 없었다.
- 새 컴포넌트 import는 없다. `ContextMenu` 계열은 마스터 경로에서 이미 import 중이었다.

## 방어 계층

| 계층 | 역할 |
| --- | --- |
| 사이드바 필터 | 스탭에게 자기 프로젝트만 보여줌 (`ownerId === user.id`) |
| 컨텍스트 메뉴 | 그 목록에 걸린 행에만 삭제 노출 |
| API 라우트 | 역할 판정 후 스코프 결정 |
| Prisma 쿼리 | `where`에 `ownerId` 포함 — API 직접 호출도 차단 |

UI를 우회해 `DELETE /api/admin/projects/<남의-프로젝트-id>`를 직접 호출해도 쿼리 조건에서 0건이 되어 403이다.

## 검증

- `npm run lint` — 통과
- `npm run build` — 통과

## 알려진 이슈 / 후속

- **현재 보고 있는 프로젝트를 삭제하면** `/projects/<삭제된-id>` 경로에 남는다. 마스터 경로도 동일한 기존 동작이라 이번 범위에서 다루지 않았다. 삭제 후 목록으로 리다이렉트하는 처리는 별도 작업으로 분리하는 게 맞다.
- **삭제 확인 다이얼로그가 없다.** 컨텍스트 메뉴 클릭 즉시 삭제된다. 마스터 경로와 동일한 기존 UX를 그대로 따랐다. 프로젝트 단위 삭제는 파급이 크므로 확인 단계 추가를 후속으로 검토할 만하다.
- **`ownerId`는 배정 도메인 도입 전 1인 기준**이다(스키마 주석 참고). 다중 배정이 생기면 이 삭제 권한 조건도 함께 재검토해야 한다.
- **docs 번호는 46 → 47로 조정**했다. 작성 시점에는 main의 최대 번호가 45라 46을 썼으나, 커밋 직전 `시드-데이터-정리`(PR #43)가 먼저 머지되며 46을 가져갔다. "나중에 머지되는 쪽이 번호를 올린다"는 규칙(CLAUDE.md)에 따라 이쪽을 47로 올리고 최신 main 위로 리베이스했다. `작업-미배정-예정일` 브랜치도 46을 들고 있어 그쪽 역시 조정이 필요하다.
