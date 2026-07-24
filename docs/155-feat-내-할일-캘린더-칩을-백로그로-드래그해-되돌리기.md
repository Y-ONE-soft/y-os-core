# feat: 내 할일 캘린더 칩을 백로그로 드래그해 되돌리기

## 배경 / 요청

내 할일 캘린더는 백로그 → 날짜 칸 드래그로 일정을 잡는다. 그 **반대(다시 백로그로)**
가 없었다. 사용자 요청: "다시 백로그로 가게도 해줘." 캘린더 칩을 오른쪽 백로그 패널로
끌어다 놓으면 예정일을 비워 캘린더에서 내리고 백로그 목록으로 되돌린다.

## 인터랙션 설계

- 캘린더 칩의 **날짜 이동은 이미 포인터 드래그**(handleDragStart→PointerMove/Up, 캘린더
  루트에 pointer capture)로 정교하게 튜닝돼 있다. 이 위에 HTML5 DnD를 얹으면 서로
  충돌하므로, **같은 포인터 드래그**를 그대로 쓰고 손을 뗀 지점이 백로그 패널인지만
  판정한다.
- 판정은 `document.elementFromPoint(x, y).closest("[data-backlog-dropzone]")`로 한다.
  pointer capture는 이벤트 라우팅만 바꾸고 히트테스트에는 영향이 없어, 캡처가 캘린더
  루트에 걸려 있어도 백로그 요소를 정확히 집어낸다.
- 드래그 중 백로그 위에 오면 드롭존을 강조한다(`data-drop-active` 속성 토글 → 링 표시).
  단계 막대(stage)에는 적용하지 않고 **할일 칩(task)만** 대상이다.

## 변경 내용

### `src/components/features/projects/board-store.tsx`
- `returnToBacklog(projectId, taskId)` 액션 추가.
  - **단계 소속**이면 `assignTask(projectId, taskId, projectId, null)`로 그 프로젝트
    백로그로 이동 — `toStageId=null`이라 예정일·마감일도 함께 비워진다.
  - **이미 백로그·미배정**이면 예정일만 지운다. 서버 `withDeadline`이 `scheduledDate:null`
    을 마감일까지 비우므로, 낙관적 캐시도 `scheduledDate`·`deadline` 둘 다 비워
    새로고침과 어긋나지 않게 한다. (`patchTaskApi(taskId, { scheduledDate: null })`)

### `src/components/features/my-work/my-work-calendar.tsx`
- 모듈 헬퍼 `backlogDropzoneAt`, `highlightBacklog` 추가.
- 새 prop `onReturnToBacklog?(taskId)`.
- `handlePointerMove`: 할일 칩을 끌 때 백로그 드롭존 강조 토글.
- `handlePointerUp`: 할일 칩을 백로그 위에서 뗐으면 날짜 이동 대신 미리보기를 되돌리고
  `onReturnToBacklog(taskId)` 호출. 드래그 종료 시 강조 해제.
- 병렬 세션(마감 깃발·가로 간격)이 이 파일을 수정 중이라 **기존 코드를 건드리지 않고
  추가만** 했다(포인터 핸들러 2곳 +행, prop 1개, 모듈 헬퍼).

### `src/components/features/my-work/my-work-backlog.tsx`
- 백로그 `<aside>`에 `data-backlog-dropzone` 속성과 `data-drop-active`일 때 링 강조 스타일.

### `src/components/features/my-work/my-work-calendar-panel.tsx`
- `handleReturnToBacklog(taskId)`로 미배정/단계·백로그 위치를 찾아 `returnToBacklog`에
  위임하고, `MyWorkCalendar`에 `onReturnToBacklog`로 배선.

## 검증

로컬 dev(워크트리, 포트 3061) + Playwright로 실제 포인터 드래그를 재현.

- 미래의 빈 날 두 개를 자동 탐색해, (A) 미배정 칩, (B) step01이 보는 프로젝트(Y.OS core)
  1단계 소속 칩을 각각 만들고, 그 달로 이동해 칩을 백로그 패널로 드래그.
- **A: 예정일 비워짐 + 여전히 미배정(백로그 목록)** — OK
- **B: 예정일 비워짐 + 단계에서 나와 그 프로젝트 백로그로** — OK
- 스크린샷(`verify-backlog.png`): 드래그 후 캘린더가 비고, 백로그 패널에 A(프로젝트 없음)
  ·B(Y.OS core · 백로그)가 나타난다.
- 콘솔 에러 없음. `npx tsc --noEmit`·`npm run lint` 통과.

## 알려진 이슈 / 참고

- 단계 칩은 프로젝트가 뷰 필터(`applyMyWorkFilter`)에 포함될 때만 렌더된다. 검증 초안에서
  내가 멤버가 아닌 프로젝트(다른 그룹)의 단계 칩을 만들었더니 캘린더에 안 떠, 보이는
  프로젝트로 바꿔 재검증했다. (기능 이슈 아님 — 원래 그런 스코프 규칙)
- 드롭존 강조는 `data-drop-active` 속성을 캘린더가 직접 토글하는 방식이다. 컴포넌트 간
  드래그 상태를 상위로 끌어올리지 않고 국소적으로 처리하려는 선택이며, 드래그 종료·취소
  시 항상 해제한다.
