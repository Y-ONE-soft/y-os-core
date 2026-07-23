# feat: 보드 할일 카드를 백로그로 드래그해 단계에서 빼기

## 작업 요약

보드(단계 컬럼)의 할일 카드를 **백로그 영역(aside)으로 끌어다 놓으면 백로그로 되돌아가게** 했다.

백로그 패널에는 이미 안내문구 "보드 카드를 이 영역으로 드래그하면 백로그로 이동합니다."가 있었지만, 정작 aside에 드롭 핸들러가 없어 **문구만 있고 동작하지 않는 상태**였다. Task ①에서 보드 카드를 draggable로 만든 데 이어, 이 커밋에서 백로그 드롭을 배선해 문구와 실제 동작을 일치시킨다.

## 변경 파일 내역

### `src/components/features/projects/project-backlog.tsx`

1. **임포트 확장** — `task-drag`에서 기존 `setTaskDragData`에 더해 `getTaskDragData`, `isTaskDrag`를 가져온다(보드 컬럼과 동일한 드롭 판정 규약).
2. **드롭 하이라이트 상태** — `dropActive` state 신설. 카드가 백로그 위로 올라오면 aside에 링을 둘러 놓일 자리를 보여준다(보드 컬럼의 `dropStageId` 하이라이트와 같은 방식).
3. **aside에 드롭 핸들러 배선**:
   - `onDragOver` → `isTaskDrag`면 `preventDefault` + `dropEffect="move"` + `setDropActive(true)`.
   - `onDragLeave` → `contains(relatedTarget)` 가드로 영역을 실제로 벗어났을 때만 하이라이트 해제(자식 위 이동 시 오작동 방지).
   - `onDrop` → `getTaskDragData`로 taskId를 읽어 `boardActions.assignTask(projectId, taskId, projectId, null)` 호출(단계 `null` = 백로그).
4. **하이라이트 클래스** — `dropActive`일 때 `ring-2 ring-primary ring-offset-1`, `transition-shadow` 추가.

동작 흐름: 보드 카드 드래그(Task ①이 실어 준 `application/x-yos-task`) → 백로그 aside가 `isTaskDrag`로 하이라이트 → 드롭 시 `assignTask(..., null)`이 카드를 단계에서 빼 백로그에 넣고 예정일을 일정 미정으로 되돌린다 → 낙관적 업데이트 + `PATCH /api/admin/tasks/[taskId]`(`stageId: null`, `scheduledDate: null`) 저장.

## 결정 이유

- **기존 규약 재사용**: 보드 컬럼 드롭과 완전히 같은 `isTaskDrag`/`getTaskDragData` 패턴을 썼다. 단계 이동 로직 `assignTask`가 단계 `null`(백로그)을 이미 처리하므로 추가 로직이 없다.
- **같은 자리 드롭 no-op**: 백로그 카드끼리도 aside 드롭에 걸리지만, `assignTask`의 자체 가드(`fromProjectId === toProjectId && (currentStage?.id ?? null) === toStageId`)가 "이미 백로그면 아무 것도 안 함"으로 걸러낸다. 별도 방어 코드 불필요.
- **하이라이트를 aside 전체로**: 안내문구가 "이 영역"으로 지시하므로, 특정 내부 존이 아니라 aside 전체를 드롭 타깃·하이라이트 범위로 잡았다.
- **드래그오버 단계의 한계 수용**: `dragover`에서는 보안상 데이터 값을 못 읽어 "백로그 카드인지 보드 카드인지" 구분이 불가능하다. 그래서 백로그 카드를 끌 때도 하이라이트가 켜지지만, 이는 보드 컬럼도 동일하게 갖는 기존 동작이라 일관성 차원에서 그대로 뒀다(드롭 자체는 no-op).
- **안내문구는 그대로**: 이미 정확한 문구라 손대지 않았다 — 이제 실제로 동작한다.

## 실행/검증

```bash
npm run lint    # 통과
npm run build   # 통과 (타입 포함)
```

- 정적 분석: 린트/타입/프로덕션 빌드 모두 통과.
- 수동 검증(권장 시나리오): 프로젝트 상세 → 단계 컬럼의 카드를 백로그 패널로 드래그 → 백로그로 이동, 예정일이 사라져 "일정 미정"이 되는지 확인. 백로그 카드를 백로그에 다시 놓아도 변화 없음(no-op) 확인. 새로고침 후 유지 확인.

## 알려진 이슈 / 범위 밖

- **백로그 내 순서 변경(정렬)은 범위 밖**: aside 드롭은 백로그 목록 맨 뒤에 편입한다. 백로그 안에서 순서를 바꾸는 기능은 없다.
- **`dragover` 시 자기 자신 하이라이트**: 위 결정 이유대로, 백로그 카드를 끌 때도 백로그가 하이라이트된다. 보드 컬럼과 동일한 기존 한계이며 드롭은 no-op이라 기능상 문제는 없다.
