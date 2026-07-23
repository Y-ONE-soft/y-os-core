# feat: 캘린더 날짜 클릭으로 할일 추가, 클릭 영역의 프로젝트로 자동 지정

## 요청

> 캘린더에 날짜 누르면 할일 추가할 수 있게. **영역이 어떤 프로젝트인지에 따라** 그 프로젝트로, **빈 공간이면 프로젝트 없음**으로. 빈 공간이 어느 정도 보이게 달력 크기도 커져야 함.

높이 확대는 앞 커밋(#144)에서 처리했고, 이 커밋은 **클릭 → 할일 추가 인터랙션**을 얹는다.

## 동작

- 내 할일 캘린더의 날짜 칸을 누르면 그 자리에 **인라인 입력창**이 뜬다. 이름 입력 후 Enter로 추가, Esc·바깥 클릭으로 취소.
- **소속(프로젝트) 자동 판정** — 클릭 지점을 `(열=날짜, 레인=세로위치)`로 환산해, 그 좌표를 품은 **프로젝트 색상 박스**가 있으면 그 프로젝트에, 없으면(=빈 공간) **프로젝트 없음(미배정)**으로 만든다. 미배정 묶음(회색 "미배정" 박스) 안을 눌러도 미배정.
- 만든 할일은 **예정일 = 그 날짜**로 잡혀 즉시 그 칸의 칩으로 나타난다. 프로젝트가 있으면 그 프로젝트 박스의 백로그 칩(단계 없음), 없으면 미배정 묶음 칩.
- 담당자 = 만든 사람(서버 기본값과 동일). "내 작업" 담당자 필터에서 방금 만든 할일이 사라지지 않게 낙관적 항목에도 미리 박는다.

## 설계 / 판정 규칙

캘린더는 날짜 그리드 위에 프로젝트별 색상 박스를 `레인(행) × 열`로 얹는 구조다(`my-work-calendar-layout.ts`). 박스는 열 범위 `[col, col+span)` × 레인 범위 `[lane, lane+lanes)`를 차지한다.

클릭 판정(`handleAddClick`, `my-work-calendar.tsx`):
1. `col = floor((clientX - rowLeft) / rowWidth * 7)` → 날짜.
2. 달 밖(회색) 칸이면 무시(날짜 숫자가 없어 혼란).
3. `lane = floor((clientY - rowTop - DATE_ROW_PX) / LANE_PX)`. 날짜 숫자 영역(맨 위, 어떤 박스도 안 덮음)은 `lane<0` → 소속 없음.
4. 이 주 레이아웃의 `boxes`에서 `(col, lane)`을 품은 박스를 찾는다. 있으면 그 `project`(단, 미배정 박스면 `null`), 없으면 `null`.

## 기존 인터랙션과의 조정 (프로젝트 박스)

"본문 클릭 = 그 프로젝트에 추가"가 성립하려면 박스 본문이 클릭을 흡수하면 안 된다. 그래서 **프로젝트 박스를 `pointer-events-none`(색 밴드 시각 전용)** 으로 바꾸고, 상세로 가는 링크는 **박스 이름 라벨**에만 남겼다(`pointer-events-auto`).

- 박스 본문 클릭 → 아래 날짜 칸으로 통과 → 주 행 클릭 핸들러가 소속 판정 후 추가.
- 프로젝트 이름 라벨 클릭 → 프로젝트 상세로 이동(기존 이동 경로 보존).
- 단계 막대·할일 칩·체크박스는 기존대로 각자 클릭을 처리(핸들러에서 `button, a, input`, `[data-add-input]` 위 클릭은 추가에서 제외).
- **부수 효과(정리)**: 박스가 항상 `pointer-events-none`이 되면서, "백로그 드래그 중 박스를 투명 처리해 드롭을 통과시키던" `draggingBacklog` 상태·캡처 핸들러(`onDragOverCapture`/`onDropCapture`)가 불필요해져 제거했다. 박스가 덮은 날짜 칸도 드롭을 그대로 받는다.
- **부수 수정**: 예전엔 회색 "미배정" 박스도 `/projects/__unassigned__`로 링크가 걸려 있었다(잠재 깨진 링크). 이제 미배정 박스는 라벨에 링크를 걸지 않는다.

## 읽기 전용 캘린더

작업 현황의 `TaskStatusCalendar`는 `onAddTask`를 넘기지 않는다 → `handleAddClick`이 즉시 반환, 커서 힌트·입력창 없음. **읽기 전용 유지.**

## 변경 파일

- `src/components/features/projects/board-store.tsx`
  - `addScheduledTask(projectId, name, scheduledDate, assigneeId?)` 신설 — 예정일 지정 생성. `projectId=null`이면 미배정, 아니면 그 프로젝트 백로그(단계 없음). 낙관적 추가 후 `createTaskApi({ projectId, stageId: null, name, scheduledDate })`. 예정일=마감일로 세팅.
- `src/components/features/my-work/my-work-calendar.tsx`
  - `onAddTask?` 프롭 추가.
  - `handleAddClick` 추가(열·레인 → 소속 판정), 주 행에 `onClick` 배선, 달 안 칸에 `cursor-pointer` 힌트.
  - `AddTaskInput` 컴포넌트(인라인 입력창) 추가, `adding` 상태로 위치·소속 관리.
  - `ProjectBoxItem`을 `Link` → `pointer-events-none div`로 바꾸고 이름 라벨만 링크화. `draggingBacklog` 상태·캡처 핸들러 제거.
  - `UNASSIGNED_BOX` import.
- `src/components/features/my-work/my-work-calendar-panel.tsx`
  - `onAddTask={(projectId, date, name) => boardActions.addScheduledTask(projectId, name, date, user?.id)}` 배선.

## 새 API / 스키마

- **없음.** 기존 `POST /api/admin/tasks`(`createTaskApi`)를 그대로 쓴다. `projectId`·`stageId` null 허용은 이미 스키마·서버에 있음(`Task.projectId?`, `Task.stageId?`).

## 검증

- `npm run lint` 통과.
- `npx tsc --noEmit` 통과(exit 0).
- `npm run dev`(Turbopack) 기동 성공, `/projects/my-tasks` 라우트 컴파일·응답 정상(미인증 → `/login` 리다이렉트).
- **UI 인터랙션 시각 검증**(클릭→입력→칩 생성, 영역별 프로젝트 판정, 드래그·드롭·상세 이동 회귀)은 로그인이 필요해 **푸시 후 프리뷰에서 사후 검증**한다. → 아래 "사후 검증 결과 (추록)"에 보완.

## 알려진 이슈 / 한계

- 클릭 추가는 **프로젝트 소속만** 정하고 단계에는 넣지 않는다(항상 단계 없음=백로그). 요청이 "영역=프로젝트"였고, 단계 편입은 기존 드래그·드롭(덮는 단계로 편입) 경로가 담당한다.
- 인라인 입력창 폭은 클릭한 열부터 최대 3칸(오른쪽 넘침 방지). 긴 이름은 입력창 안에서 스크롤된다.

## 사후 검증 결과 (추록)

- (푸시 후 프리뷰에서 확인해 보완)
