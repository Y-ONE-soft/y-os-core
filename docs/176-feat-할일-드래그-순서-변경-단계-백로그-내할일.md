# feat: 할일 드래그 순서 변경 (단계·백로그·내 할일)

Task ①(order 필드)을 토대로, **할일 카드를 다른 할일 카드 위에 끌어다 놓아 같은 컨테이너 안에서 순서를 바꾼다.** 세 곳 모두 지원: 프로젝트 보드의 단계 내(‘단계 없음’ 컬럼 포함), 프로젝트 상세 백로그, 내 할일 백로그.

## 핵심 설계 — "카드 위 드롭 = 재정렬, 그 외 = 기존 이동"

할일 카드는 원래 draggable이고, 컬럼/백로그 aside에 놓으면 컨테이너를 옮기는(assignTask) 동작이 있었다. 여기에 **카드 위에 놓으면 같은 컨테이너 재정렬**을 얹는다.

- 카드의 `onDrop`은 **끌어온 할일이 같은 컨테이너(siblingIds에 포함)일 때만** 재정렬하고 `stopPropagation` 한다.
- 다른 컨테이너에서 온 드래그는 여기서 손대지 않고 흘려보내(버블) 컬럼/aside의 기존 이동 핸들러가 처리한다. → "카드 위로 옮겨 이동"하던 기존 동작이 그대로 유지된다.
- 컨테이너 이동 시 대상 말단 order 배정은 Task ①(updateTask)에서 이미 처리했다.

## 변경 내역

### 서버 — `src/server/workspace/service.ts`
- `reorderTasks(projectId, stageId, taskIds)` 신설. reorderProjects와 같은 **슬롯 재배정**: 대상 할일들이 차지한 order 슬롯을 오름차순으로 모아 새 순서대로 다시 나눈다. 단계·백로그(전체 전달)는 전면 재배치, 내 할일(그 컨테이너의 내 담당분만 전달)은 부분 재정렬(다른 사람 할일 위치 보존). projectId·stageId는 null 가능(미배정/백로그).

### API — `src/app/api/admin/tasks/order/route.ts` (신규)
- `PATCH { projectId, stageId, taskIds }`. `tasks/[taskId]`와 같은 레벨의 정적 세그먼트라 `/tasks/order`가 우선 매칭된다.

### 프론트 — `src/lib/api/workspace.ts`, `board-store.tsx`
- `reorderTasksApi(projectId, stageId, taskIds)`.
- `boardActions.reorderTasks`: 컨테이너 배열(unassigned / backlog / stage.tasks)에서 **슬롯 재배정**(`reorderInArray`) 후 저장. 부분집합만 넘겨도 나머지는 제자리.

### 드롭 헬퍼 — `src/components/features/projects/task-reorder.ts` (신규)
- `buildTaskReorderProps({ projectId, stageId, targetTaskId, siblingIds, setDropTargetId, reorder })` → 카드에 붙일 `onDragOver/onDragLeave/onDrop`. 같은 컨테이너면 "대상 앞에 끼우기", 아니면 버블. 세 곳이 공유한다.

### UI 3곳
- `project-board.tsx`(`BoardTaskCard`): 단계 카드·‘단계 없음’ 카드. siblingIds = 그 단계의 tasks / stageless.
- `project-backlog.tsx`(`BacklogRow`): siblingIds = 그 패널에 보이는 백로그(parked).
- `my-work-backlog.tsx`: siblingIds = 그 항목과 **같은 소속(컨테이너)** 의 내 항목들(플랫 리스트라 소속별로 부분집합).
- 드롭 대상 카드는 `ring-primary`로 "앞에 끼워짐"을 표시.

## 결정 이유
- **슬롯 재배정**으로 전체(단계·백로그)와 부분집합(내 할일)을 한 함수로. 내 할일은 여러 컨테이너가 섞인 플랫 리스트라 부분 재정렬이 필수인데, 슬롯 방식이 다른 사람·다른 소속 할일을 건드리지 않는다.
- **다른 컨테이너 드롭은 버블**: 기존 "카드 위로 옮겨 다른 단계로 이동" 동작을 깨지 않으려면 카드가 같은 컨테이너만 가로채야 한다.

## 실행/검증
```bash
npm run lint / npm run build   # 통과
```
**실앱 검증 (dev + 헤드리스 Edge, 전용 테스트 데이터):**
- 서버 API: 단계에 T0..T3 → 전체 재정렬 [T3,T0,T1,T2] 반영. **부분집합** [T1,T3] 재정렬 → [T1,T0,T3,T2](슬롯 유지). → PASS
- 보드 카드 드래그: T2를 T1 카드 위로 → 서버 순서 [T2,T1,T0,T3]. → PASS
- 백로그·내 할일은 같은 `buildTaskReorderProps`·`reorderTasks` API를 쓰며, 브라우저로는 보드 경로를 대표 검증했다.
