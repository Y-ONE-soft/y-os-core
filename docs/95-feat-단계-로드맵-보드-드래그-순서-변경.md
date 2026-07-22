# 87. feat: 단계 로드맵·보드 드래그 순서 변경

앞 커밋(docs/86)에서 단계 순서를 `Stage.order`로 데이터화했다. 이 커밋은 그 순서를 **사용자가 드래그로 바꿀 수 있게** 한다. 프로젝트 상세의 두 화면(단계 로드맵, 보드)에서 모두 되고, 바꾼 순서가 곧 화면의 단계 번호 1, 2, 3…이 된다.

## 동작

| 화면 | 손잡이 | 드롭 자리 | 결과 |
|---|---|---|---|
| 단계 로드맵 | 왼쪽 단계 이름 칸 | 다른 단계 행 / `＋ 단계 추가` 행 | 그 행 자리에 끼워 넣고 아래로 밀어냄 / 맨 뒤로 |
| 보드 | 컬럼 헤더 | 다른 컬럼 / `＋ 단계 추가` 컬럼 | 그 컬럼 자리에 끼워 넣고 뒤로 밀어냄 / 맨 뒤로 |

두 화면은 같은 스토어를 보므로 한쪽에서 바꾸면 다른 쪽도 즉시 따라간다. 끄는 중인 단계는 흐려지고(`opacity-40`), 끼워 넣을 자리에는 파란 선이 나타난다.

**손잡이를 화면 요소 전체가 아니라 이름 칸·헤더로 한정한 이유**가 각각 다르다.

- **로드맵**: 막대(`RoadmapBar`)는 이미 포인터 드래그로 기간을 옮기고 늘린다. 행 전체를 `draggable`로 잡으면 기간 조절과 순서 변경이 같은 제스처를 두고 다툰다. 왼쪽 라벨 칸만 손잡이로 두면 "라벨을 끌면 순서, 막대를 끌면 기간"으로 갈린다.
- **보드**: 카드 영역은 할일 카드 드래그 구역이다. 컬럼 전체를 `draggable`로 잡으면 카드를 집으려던 드래그가 컬럼 드래그로 새어 나간다. 헤더만 손잡이로 둔다. (같은 이유로 단계 삭제 메뉴도 헤더 우클릭이다)

## 구현

### 1) 전용 MIME으로 두 드래그를 구분 — `stage-drag.ts` (신규)

`task-drag.ts`와 같은 규약을 단계용으로 하나 더 뒀다.

```ts
const STAGE_MIME = "application/x-yos-stage";
export function setStageDragData(event, stageId) { ... }
export function isStageDrag(event) { return event.dataTransfer.types.includes(STAGE_MIME); }
export function getStageDragData(event) { return event.dataTransfer.getData(STAGE_MIME) || null; }
```

**보드 컬럼은 두 종류의 드래그를 동시에 받는 자리**라 이 구분이 핵심이다. 같은 `<section>`의 `onDragOver`/`onDrop`에서 MIME으로 갈라, 할일을 놓으면 그 단계로 편입(`assignTask`), 단계를 놓으면 순서 변경(`moveStage`)이 된다. `dragover` 시점에는 보안상 값을 읽을 수 없고 타입 목록만 볼 수 있어서, 하이라이트 판정도 MIME으로 한다.

```tsx
onDragOver={(event) => {
  if (isStageDrag(event)) { event.preventDefault(); setOrderTargetId(stage.id); return; }
  if (!isTaskDrag(event)) return;
  event.preventDefault();
  setDropStageId(stage.id);
}}
```

두 상태(`dropStageId` = 할일 편입 대상, `orderTargetId` = 끼워 넣을 자리)를 따로 둔 것도 같은 이유다. 표시가 다르다 — 편입은 컬럼 전체 링, 순서 변경은 왼쪽 삽입선.

### 2) 재정렬 API — `PATCH /api/admin/projects/:projectId/stages/order`

부분 갱신이 아니라 **그 프로젝트의 단계 전체를 새 순서대로** 보낸다. 프로젝트 하위 리소스로 둔 이유이기도 하다.

```ts
export async function reorderStages(projectId, stageIds, opts?) {
  return db.$transaction(async (tx) => {
    const project = await tx.project.findFirst({
      where: { id: projectId, ...(opts?.ownerId ? { ownerId: opts.ownerId } : {}) },
      select: { id: true },
    });
    if (!project) return { count: 0 };

    const current = await tx.stage.findMany({ where: { projectId }, select: { id: true } });
    const requested = new Set(stageIds);
    if (
      requested.size !== stageIds.length ||        // 중복 id
      requested.size !== current.length ||         // 개수 불일치
      !current.every((stage) => requested.has(stage.id))  // 집합 불일치
    ) {
      return { count: 0 };
    }

    await renumberStages(tx, projectId, stageIds);
    return { count: stageIds.length };
  });
}
```

**부분 목록을 받아 부분만 갱신하지 않는다.** 요청한 집합이 서버의 단계 집합과 정확히 일치할 때만 반영하고 아니면 거절한다. 병렬 세션이 그 사이 단계를 추가·삭제했다면 클라이언트가 보낸 목록은 낡은 것이고, 그대로 반영하면 빠진 단계가 번호를 잃거나 순서가 뒤섞인다. 그런 상태를 만드는 것보다 거절하고 새로고침 시 서버 값으로 되돌아가는 편이 낫다.

번호를 다시 매기는 것은 docs/86에서 만든 `renumberStages`를 그대로 쓴다 — 음수 경유 2단계 방식이라 1↔2 스왑에서도 유니크 제약에 걸리지 않는다.

권한 범위는 프로젝트 색 변경·삭제와 동일하다. 마스터는 전체, 스탭은 자기가 작업자인 프로젝트만. 0건은 권한 없음과 목록 불일치를 구분하지 않고 403으로 돌려준다.

### 3) 스토어 액션 — `boardActions.moveStage`

```ts
moveStage(projectId, stageId, targetId) {
  if (stageId === targetId) return;
  const stages = cache.getSnapshot().boards[projectId]?.stages ?? [];
  const from = stages.findIndex((stage) => stage.id === stageId);
  if (from === -1) return;

  // 대상 자리에 끼워 넣는다 — 대상과 그 뒤는 한 칸씩 밀린다
  const rest = stages.filter((stage) => stage.id !== stageId);
  const to = targetId === null ? rest.length : rest.findIndex((s) => s.id === targetId);
  if (to === -1) return;

  const next = [...rest.slice(0, to), stages[from], ...rest.slice(to)];
  // 순서가 그대로면 요청을 보내지 않는다 (제자리 드롭)
  if (next.every((stage, index) => stage.id === stages[index].id)) return;

  updateBoard(projectId, (board) => ({ ...board, stages: next }));
  cache.persist(reorderStagesApi(projectId, next.map((stage) => stage.id)));
}
```

`targetId === null`은 맨 뒤로 보내는 경우(`＋ 단계 추가` 자리에 드롭). 화면 번호는 배열 인덱스 + 1이므로 배열만 바꾸면 번호는 저절로 따라온다 — **번호를 그리는 코드는 손대지 않았다.**

## 변경 파일

| 파일 | 변경 |
|---|---|
| `src/components/features/projects/stage-drag.ts` | 신규 — 단계 드래그 MIME 규약 |
| `src/app/api/admin/projects/[projectId]/stages/order/route.ts` | 신규 — 재정렬 Route Handler |
| `src/server/workspace/service.ts` | `reorderStages()` 추가 |
| `src/lib/api/workspace.ts` | `reorderStagesApi()` 추가 |
| `src/components/features/projects/board-store.tsx` | `boardActions.moveStage()` 추가 |
| `src/components/features/projects/project-board.tsx` | 헤더 드래그 손잡이, 컬럼 드롭 분기, 삽입선, 맨 뒤 드롭 자리 |
| `src/components/features/projects/project-roadmap.tsx` | 라벨 칸 드래그 손잡이, 행 드롭, 삽입선, 맨 뒤 드롭 자리 |

## 검증

로컬 dev 서버(포트 3161, `Win32_Process` CommandLine으로 이 워크트리 소유임을 확인)에서 puppeteer로 확인했다. **실제 데이터를 건드리지 않도록 검증 전용 그룹·프로젝트를 만들어 쓰고 끝나면 그룹째 삭제**했다 (docs/86의 사고 재발 방지).

React는 루트에서 이벤트를 받으므로 합성 `DragEvent`를 버블시켜 드래그를 재현했다.

```
1) 초기
   화면 로드맵: 가단계,나단계,다단계,라단계   배지: 1,2,3,4   서버: 가단계,나단계,다단계,라단계
2) 로드맵 라단계 → 1번 자리
   화면 로드맵: 라단계,가단계,나단계,다단계   배지: 1,2,3,4
3) 보드 1번 → 3번 자리
   화면 로드맵: 가단계,라단계,나단계,다단계   배지: 1,2,3,4
4) 로드맵 1번 → 4번 자리 (저장 응답 200 {"ok":true} 확인)
   화면 로드맵: 라단계,나단계,가단계,다단계   배지: 1,2,3,4
5) 새로고침
   화면 로드맵: 라단계,나단계,가단계,다단계   배지: 1,2,3,4
   서버       : 라단계,나단계,가단계,다단계
정리 완료. 에러: 0건
```

확인한 것:
- 로드맵·보드 **양쪽에서** 드래그로 순서가 바뀐다
- 한쪽에서 바꾸면 다른 쪽도 같은 순서가 된다 (같은 스토어)
- 번호는 항상 1,2,3,4 — 어떤 순서로 바꿔도 중복·빈 번호가 없다
- 새로고침 후에도 유지되고, 서버 값과 화면이 일치한다
- 콘솔·네트워크 에러 0건

`npm run lint`, `npm run build` 통과.

### 검증 과정에서 겪은 것 — 인플라이트 요청 착시

첫 시도에서 "새로고침하면 순서가 원래대로 돌아간다"는 결과가 나왔다. 확인해 보니 앱 문제가 아니라 검증 스크립트 문제였다. 드래그 직후 `page.reload()`를 하면 **전송 중이던 PATCH가 취소**되고, 같은 타이밍에 읽은 서버 값은 한 스텝 전 상태였다. `page.waitForResponse`로 저장 응답 200을 확인한 뒤 새로고침하도록 바꾸니 화면과 서버가 정확히 일치했다. 위 로그 4)의 "저장 응답" 확인 단계가 그것이다.

## 알려진 이슈

- **순서를 바꾸면 단계 색도 따라 바뀐다.** 단계 색은 DB 값이 아니라 프로젝트 색에서 위치로 파생한다(`withDerivedColors` → `stageTone(projectColor, index)`). 즉 색은 "몇 번째 단계인가"의 표현이므로 자리를 옮기면 그 자리의 톤을 갖는다. 의도된 동작이지만, 특정 단계에 특정 색을 고정하고 싶다면 별도 논의가 필요하다.
- **순서 변경은 기간을 건드리지 않는다.** 1번 단계가 4번 단계보다 늦게 시작하는 배치도 그대로 허용된다. 순서와 일정은 별개 축이라는 판단인데, "순서대로 일정도 재배치"가 필요하면 별도 기능으로 만들어야 한다.
- **낙관적 반영이 실패하면 되돌아간다.** 재정렬 요청이 거절되면(권한 없음·목록 불일치) `cache.persist`가 서버 상태로 재동기화하므로 화면이 원래 순서로 되돌아간다. 별도 토스트 안내는 없다 — 기존 다른 액션과 동일한 처리다.
- **터치 지원은 확인하지 않았다.** HTML5 드래그 앤 드롭 기반이라 모바일 브라우저에서는 동작하지 않을 수 있다. 기존 할일 카드 드래그와 같은 제약이다.
- 단계 안 **할일 순서**는 여전히 바꿀 수 없다 (`Task`에 `order` 없음).
