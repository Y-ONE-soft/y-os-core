# feat: 프로젝트 보드에서 할일 카드를 드래그해 다른 단계로 이동

## 작업 요약

프로젝트 상세 보드에서 할일 카드를 집어 **다른 단계 컬럼으로 끌어다 놓아 이동**할 수 있게 했다.

핵심은 "빠진 조각 하나"였다. 단계 간 이동에 필요한 나머지는 이미 다 있었다.

- **이동 로직**: `boardActions.assignTask(fromProjectId, taskId, toProjectId, toStageId)`는 이미 미배정·백로그·단계 간 이동을 모두 처리한다. 같은 자리 드롭은 자체적으로 no-op으로 걸러낸다(`board-store.tsx:271-276`). 단계에 편입되면 예정일을 `max(단계 시작일, 오늘)`로 잡아 준다.
- **드롭 수신**: 보드 컬럼(`<section>`)은 이미 `isTaskDrag`를 받아 하이라이트하고, 드롭 시 `assignTask`를 호출한다(`project-board.tsx` onDragOver/onDrop). 주석도 "백로그·다른 단계 어디서 왔든 이 단계로 편입한다"라고 이미 명시돼 있었다.
- **빠져 있던 것**: 정작 **보드 안의 할일 카드에 `draggable`/`onDragStart`가 없어** 집어 올릴 수가 없었다. 백로그 카드에는 있었다(`project-backlog.tsx:65-68`).

따라서 이 커밋은 보드 카드를 백로그 카드와 동일한 드래그 규약(`setTaskDragData`)으로 draggable하게 만드는, 최소 변경이다.

## 변경 파일 내역

### `src/components/features/projects/project-board.tsx`

1. **임포트 추가** — `task-drag`에서 `setTaskDragData`를 추가로 가져온다(기존 `getTaskDragData`, `isTaskDrag`와 동일 모듈).
2. **드래그 상태 추가** — `draggingTaskId` state 신설. 끌고 있는 원본 카드를 흐리게 해 어디서 끌려나왔는지 보이게 한다(단계 순서 변경 드래그의 `draggingStageId`와 같은 패턴).
3. **할일 카드에 드래그 시작 배선** — 카드 `<div>`에 다음을 추가:
   - `draggable`
   - `onDragStart` → `setTaskDragData(event, task.id)` + `setDraggingTaskId(task.id)`
   - `onDragEnd` → `setDraggingTaskId(null)`
4. **어포던스/피드백**:
   - 커서를 `cursor-pointer` → `cursor-grab active:cursor-grabbing`으로 변경(백로그 카드와 동일).
   - `draggingTaskId === task.id`일 때 `opacity-40`로 원본 흐림.

동작 흐름: 보드 카드 드래그 시작 → `application/x-yos-task` MIME에 taskId 실림 → 대상 단계 컬럼이 `isTaskDrag`로 하이라이트 → 드롭 시 컬럼의 기존 `onDrop`이 `assignTask(projectId, taskId, projectId, stage.id)` 호출 → 낙관적 업데이트 + `PATCH /api/admin/tasks/[taskId]` 저장.

## 결정 이유

- **새 로직·새 API 없음**: 단계 간 이동은 `assignTask`가 이미 완결적으로 처리하고 컬럼도 이미 드롭을 받으므로, 카드를 draggable로만 만들면 된다. 중복 구현을 피했다.
- **백로그 카드와 동일 규약 재사용**: 별도 MIME·핸들러를 만들지 않고 `task-drag.ts`의 공용 `setTaskDragData`를 그대로 썼다. 단계 드래그(`stage-drag.ts`)와는 MIME이 달라 컬럼에서 "할일=편입 / 단계=순서변경"이 자연히 구분된다.
- **같은 단계에 도로 놓기**: `assignTask`의 자체 no-op 가드로 안전. 추가 방어 코드 불필요.
- **로드맵과의 간섭 없음 확인**: 로드맵 행/막대의 드롭 핸들러는 `isStageDrag`만 받으므로(`project-roadmap.tsx:203-224`, `291-308`), 카드를 draggable로 만들어도 로드맵에는 떨어지지 않는다.
- **컨텍스트 메뉴 공존**: 카드는 `ContextMenuTrigger asChild`로 감싸져 있는데, 백로그가 이미 동일 구조(draggable + 우클릭 메뉴)로 문제없이 쓰고 있어 그대로 따랐다.

## 실행/검증

```bash
npm run lint    # 통과 (경고·에러 없음)
npm run build   # 통과 (타입 체크 포함, 전체 라우트 정상 생성)
```

- 정적 분석: 린트/타입/프로덕션 빌드 모두 통과.
- 수동 검증(권장 시나리오): 프로젝트 상세 → 1단계 카드를 2단계 컬럼으로 드래그 → 2단계로 이동, 예정일이 단계 시작일 기준으로 잡히는지 확인. 새로고침 후에도 유지되는지 확인(서버 저장).

## 알려진 이슈 / 범위 밖

- **단계 내 순서 변경(정렬)은 범위 밖**: 컬럼 드롭은 대상 단계의 할일 목록 맨 뒤에 편입한다. 같은 단계 안에서 카드 순서를 바꾸는 기능은 이 커밋에 없다.
- **백로그로 빼기(카드 → 백로그 aside)**: 백로그 안내문구가 이를 예고하지만 aside에 드롭 핸들러가 없어 아직 비동작이다. 다음 태스크(docs/136)에서 배선한다.
