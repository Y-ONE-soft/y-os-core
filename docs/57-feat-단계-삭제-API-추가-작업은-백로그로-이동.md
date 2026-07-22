# feat: 단계 삭제 API 추가 (작업은 백로그로 이동)

요청 사이클 `보드-단계-우클릭-삭제`의 1번 태스크. "프로젝트 상세에서 점 세개를 없애고 우클릭 삭제로 바꿔달라"는 요청을 처리하려면 **단계 삭제 기능 자체가 먼저 있어야 한다.** 이 커밋은 서버·클라이언트 API 계층만 만든다. 화면 전환은 2번 태스크.

## 배경 — 단계 삭제는 어느 계층에도 없었다

조사 결과 프로젝트 상세 보드의 점 세개([project-board.tsx:69](../src/components/features/projects/project-board.tsx))는 `aria-label`만 있고 `onClick`이 없는 **아무 동작도 하지 않는 껍데기**였다. 바로 아래 작업 카드는 이미 우클릭 삭제가 구현돼 있어 붙일 패턴은 옆에 있었지만, 단계 쪽은 전 계층이 비어 있었다.

- `service.ts` — `deleteStage` 없음 (`createStage`·`updateStage`만)
- `app/api/admin/stages/[stageId]/route.ts` — `PATCH`만 있고 `DELETE` 없음
- `lib/api/workspace.ts` — `deleteStageApi` 없음
- `board-store.tsx` — 스토어 액션 없음 (2번 태스크에서 추가)

## 결정 사항 (사용자 승인)

| 항목 | 선택 | 이유 |
|---|---|---|
| 단계 안의 작업 처리 | **백로그로 이동** | 실수로 지워도 작업이 보존된다. 백로그가 이미 "단계 미지정"(`stageId = null`) 자리라 의미도 맞는다 |
| 스탭 권한 | **자기가 작업자인 프로젝트의 단계만** | 프로젝트 삭제 가드와 동일한 규칙. 인증만 요구하면 스탭이 남의 보드를 헤집을 수 있다 |

**cascade를 그대로 두지 않은 이유** — 스키마상 `Task.stage`가 `onDelete: Cascade`라, 단계를 지우면 그 작업이 전부 DB에서 삭제된다. 프로젝트 삭제는 "프로젝트가 통째로 사라진다"는 게 자명하지만, 단계는 보드 안의 한 컬럼일 뿐이라 우클릭 한 번에 작업 여러 건이 조용히 날아가는 건 체감이 다르다.

## 변경 내용

### 1. `src/server/workspace/service.ts` — `deleteStage`

```ts
export async function deleteStage(
  id: string,
  opts?: { ownerId?: string },
): Promise<{ count: number }> {
  const where = {
    id,
    ...(opts?.ownerId ? { project: { ownerId: opts.ownerId } } : {}),
  };

  return db.$transaction(async (tx) => {
    // 가드를 통과하는 단계인지 먼저 확인 — 통과하지 못하면 아무것도 건드리지 않는다
    const stage = await tx.stage.findFirst({ where, select: { id: true } });
    if (!stage) return { count: 0 };

    await tx.task.updateMany({
      where: { stageId: id },
      data: { stageId: null },
    });
    const { count } = await tx.stage.deleteMany({ where: { id } });
    return { count };
  });
}
```

설계에서 중요한 세 가지.

**① 순서가 곧 정확성이다.** `Task.stage`가 `onDelete: Cascade`이므로 **작업을 먼저 떼어낸 뒤** 단계를 지워야 한다. 순서가 뒤바뀌면 DB가 작업까지 함께 삭제한다. 코드에 주석으로 못박아 두었다.

**② 트랜잭션이 필수다.** 작업 분리와 단계 삭제가 따로 커밋되면, 중간에 실패했을 때 "단계는 남았는데 작업만 백로그로 빠진" 상태가 된다. 되돌릴 방법이 없으므로 한 트랜잭션으로 묶었다.

**③ 가드를 먼저 확인한다.** 권한이 없으면 `findFirst`에서 걸러져 `updateMany`가 아예 실행되지 않는다. 이 순서가 아니면 **삭제는 거부되는데 작업만 백로그로 빠져나가는 부분 적용**이 발생한다. 실제로 이 시나리오를 검증했다(아래 검증 4).

`opts.ownerId`는 `deleteProject(id, opts?)`와 같은 형태로 맞췄다. 다만 프로젝트는 자기 자신의 `ownerId`를 보지만 단계는 `project: { ownerId }`로 한 단계 건너 본다.

### 2. `src/app/api/admin/stages/[stageId]/route.ts` — `DELETE` 추가

기존 `PATCH` 옆에 붙였다. 가드 구조는 `projects/[projectId]/route.ts`와 동일하게 맞췄다.

```ts
const { count } = await deleteStage(
  stageId,
  isMaster ? undefined : { ownerId: user.id },
);

// 스탭이 0건이면 남의 단계이거나 이미 없는 것 — 존재 여부를 흘리지 않도록
// 구분 없이 403. 마스터는 멱등하게 ok (없는 id 삭제도 성공 취급).
if (!isMaster && count === 0) return forbidden();
```

**"없는 단계"와 "남의 단계"를 구분하지 않는다.** 구분해서 404/403을 나눠 주면 스탭이 id를 훑어 남의 단계 존재 여부를 알아낼 수 있다. 프로젝트 삭제가 이미 이 방침이라 그대로 따랐다.

import에 `forbidden`, `deleteStage`를 추가했다.

### 3. `src/lib/api/workspace.ts` — `deleteStageApi`

```ts
export const deleteStageApi = (stageId: string) =>
  api.del<{ ok: boolean }>(`/api/admin/stages/${stageId}`);
```

`deleteProjectApi`와 동일한 형태. `patchStageApi` 바로 위에 두어 단계 관련 함수끼리 모았다.

## 검증

`npm run build` 성공(타입 검사 포함), `npm run lint` 경고 0.

dev 서버(포트 3041)에 실제 HTTP 요청을 보내 검증했다. 3001·3002·3011은 다른 세션 점유 중이었다. **다른 세션 데이터를 건드리지 않도록 전용 픽스처(프로젝트·단계·작업)를 새로 만들어 검증하고 전부 삭제했다.**

### 1. 핵심 — 작업이 백로그로 살아남는가

스탭 소유 프로젝트에 단계 1개와 작업 2건을 만든 뒤 단계를 삭제했다.

```
=== 삭제 전 ===
  단계: 지울 단계(작업 A,작업 B)
  백로그: (없음)
=== 스탭이 자기 프로젝트 단계 삭제 ===
  {"ok":true}  DELETE=[200]
=== 삭제 후 ===
  단계: (없음)
  백로그: 작업 A, 작업 B
  → 단계만 삭제되고 작업 2건 백로그 보존: 정상
```

cascade에 맡겼다면 작업 2건이 사라졌을 자리다.

### 2. 스탭 권한 가드

| 시나리오 | 결과 |
|---|---|
| 스탭이 **마스터 소유** 프로젝트의 단계 삭제 | **403** `권한이 없습니다.` |
| 비로그인 삭제 | **401** `인증이 필요합니다.` |
| 마스터가 같은 단계 삭제 | **200** `{"ok":true}` |

### 3. 존재하지 않는 id — 정보 노출 차단

| 역할 | 결과 |
|---|---|
| 마스터 | **200** (멱등 — 없는 id 삭제도 성공 취급) |
| 스탭 | **403** (남의 단계인지 없는 단계인지 구분 불가) |

### 4. 거부된 요청이 데이터를 건드리지 않는가 (부분 적용 검사)

가드 순서가 잘못됐다면 "삭제는 403인데 작업은 이미 백로그로 빠진" 상태가 생긴다. 마스터 소유 단계에 작업 1건을 넣고 스탭이 삭제를 시도했다.

```
스탭 삭제 시도: [403]
  단계 남아있음: true
  작업이 단계에 그대로: 보호된 작업
  백로그로 새어나감: 없음
  → 거부된 요청이 데이터를 건드리지 않음: 정상
```

### 정리

검증용 프로젝트 2건(`p-stgtest`·`p-mstest`)을 삭제했고, 잔여 프로젝트 0건·잔여 작업 0건을 DB에서 직접 확인했다.

## 변경 파일 내역

| 파일 | 구분 | 내용 |
|---|---|---|
| `src/server/workspace/service.ts` | 수정 | `deleteStage` 추가 — 트랜잭션으로 가드 확인 → 작업 백로그 이동 → 단계 삭제 |
| `src/app/api/admin/stages/[stageId]/route.ts` | 수정 | `DELETE` 핸들러 추가, `forbidden`·`deleteStage` import |
| `src/lib/api/workspace.ts` | 수정 | `deleteStageApi` 추가 |

## 알려진 이슈 / 주의점

### 이 커밋만으로는 화면에서 쓸 수 없다

스토어 액션과 UI가 없어 사용자가 단계를 지울 방법이 아직 없다. 2번 태스크에서 점 세개를 제거하고 우클릭 메뉴를 붙여야 완결된다.

### 백로그로 옮겨진 작업의 순서

`createdAt` 기준 정렬이라 백로그 안에서 원래 생성 순서대로 섞여 들어간다. "방금 옮겨진 작업"을 따로 묶어 보여주지는 않는다. 단계에서 나왔다는 표시도 없다.

### 작업자 없는 프로젝트의 단계는 스탭이 못 지운다

`ownerId`가 `null`인 프로젝트(마스터가 만든 것, 또는 시드 정리 이전 데이터)는 스탭 가드를 통과하지 못한다. 프로젝트 삭제와 동일한 제약이라 별도로 다루지 않았다. 배정(멤버) 도메인이 들어오면 함께 재검토할 부분이다.

### 단계 삭제에는 확인 다이얼로그가 없다

작업이 백로그로 보존되므로 프로젝트 삭제만큼 파괴적이지 않다고 판단해 넣지 않았다. 다만 단계 자체(이름·기간·설명·댓글)는 복구되지 않는다. docs/55에서 추가한 `alert-dialog`를 재사용하면 붙이기는 쉽다.
