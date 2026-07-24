# feat: 캘린더 클릭 추가를 그 날짜를 덮는 단계로 편입

## 요청

> 할 일 추가하면 **그 프로젝트의 영역에 포함된 단계로**, 그리고 **날짜가 그 날로** 만들어지게. 지금은 (날짜·프로젝트만 있어) 백로그로 빠진다.

캘린더 날짜 클릭 추가(#136)는 프로젝트만 정하고 `stageId=null`(백로그)로 만들었다. 이 커밋은 클릭한 날짜를 **덮는 단계가 있으면 그 단계로 편입**하도록 바꾼다. 예정일은 그대로 클릭한 날.

(덮는 단계가 여러 개일 때의 선택 UI는 후속 태스크 `feat: 캘린더 할일 추가 시 겹친 단계 중 선택`에서. 이 커밋은 여러 개면 **최상단(첫) 단계를 기본**으로 넣는다.)

## 동작

- 날짜 칸 클릭 → 인라인 입력창. 클릭 지점이 **어느 프로젝트 박스 안이고, 그 날짜를 덮는 단계가 있으면** 그 단계로, 없으면 프로젝트 백로그로, 프로젝트 밖(빈 공간)이면 미배정으로 만든다.
- 입력창 플레이스홀더가 대상을 알려준다: `"<단계명>에 추가"` / `"<프로젝트명>에 추가"` / `"프로젝트 없음"`. 앞의 점 색도 대상(단계 색 → 없으면 프로젝트 색 → 미배정 회색)에 맞춘다.
- 만든 할일의 예정일 = 클릭한 날. 클릭 날짜가 이미 단계 범위 안이라 단계를 늘릴 필요는 없다.

## 덮는 단계 판정 (계산 방식)

캘린더는 이미 단계를 `layouts[행].overlays`(kind `"stage"`, `{project, stageId, label, color, col, span}`)로 그린다. 클릭 (행,열)에서:

```
그 프로젝트(projectId)의 stage 오버레이 중, 클릭 열이 [overlay.col, overlay.col+span) 안에 드는 것
```

을 모아 **그 열을 덮는 단계들**을 얻는다(같은 stageId는 dedupe). 화면에 보이는 막대 기준이라, 사용자가 "보고 누른 그 단계"와 일치한다. 겹쳐 그려진 단계가 여러 개면 모두 모인다(선택은 후속 태스크).

## 변경 파일

- `src/components/features/projects/board-store.tsx`
  - `addScheduledTask(projectId, name, scheduledDate, assigneeId?, **stageId?**)` — 인자 `stageId` 추가. `projectId` 있고 `stageId` 있으면 그 단계의 `tasks`에 추가, 없으면 백로그, `projectId=null`이면 미배정. API 호출도 `stageId: stageId ?? null`.
- `src/components/features/my-work/my-work-calendar.tsx`
  - `onAddTask` 시그니처에 `stageId` 추가: `(projectId, stageId, date, name)`.
  - `adding` 상태에 `stages`(덮는 단계 목록) 추가.
  - `handleAddClick`: 클릭 열을 덮는 단계들을 오버레이에서 계산해 `adding.stages`에 담는다.
  - `AddTaskInput`: `stages`·`fallbackColor`를 받아 대상(단계/프로젝트/미배정)을 플레이스홀더·점 색으로 표시. `onSubmit(name, stageId)`. 여러 단계면 최상단 기본(선택 UI는 후속).
- `src/components/features/my-work/my-work-calendar-panel.tsx`
  - `onAddTask={(projectId, stageId, date, name) => boardActions.addScheduledTask(projectId, name, date, user?.id, stageId)}`.

## 새 API / 스키마

- **없음.** 기존 `POST /api/admin/tasks`가 이미 `stageId`를 받는다(`addTask`가 사용 중). `stageId` 지정만 추가.

## 검증

- `npm run lint` — 통과(에러·경고 없음).
- `npx tsc --noEmit` — 통과(exit 0).
- dev 컴파일·시각 검증은 태스크 ② 이후 앱에서 함께.

## 알려진 이슈 / 한계

- 덮는 단계가 여러 개면 지금은 최상단(첫) 단계로 들어간다 — 선택 UI는 후속 태스크에서.
- 종료일 없는(진행형) 단계는 캘린더에 기본 길이 막대로 그려지는데, 그 막대 위를 누르면 그 단계로 편입한다(보이는 대로 동작). 드래그·드롭의 "덮는 단계" 규칙(시작일만 덮음)과는 다르지만, 클릭 추가는 "보고 누른 막대"를 따르는 게 자연스럽다.
- #3(프로젝트 없음 → "단계 없음" 단계로 유지)은 `미배정-영역-제거` 머지 후 별도 사이클.
