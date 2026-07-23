# 145. feat: 내 할일 캘린더에 일·주·월 보기와 오늘로 돌아가기

## 작업 요약

내 할일 캘린더에 **일 / 주 / 월** 보기 세그먼트를 넣고, 기존 "오늘" 버튼을 **"오늘로 돌아가기"** 로 바꿨다. 로드맵의 레인지 스위처와 같은 조작감이다.

| 보기 | 그리드 |
| --- | --- |
| 월 | 7열 × 여러 주 (기존) |
| 주 | 7열 × 1주 (그 주, 월 경계 넘어도 실제 날짜 표시) |
| 일 | 1열 × 1일 |

## 설계 — 그리드를 열 수로 일반화

캘린더의 소스·레이아웃·렌더가 모두 `DAYS_PER_WEEK = 7` 고정에 묶여 있어 일 보기(1열)를 넣을 수 없었다. 그리드에 **`columns`(한 행의 칸 수)** 를 실어 파이프라인 전체가 뷰와 무관하게 돌게 했다.

- 월·주: `columns = 7`
- 일: `columns = 1`

주/월 그리드는 같은 7열이라 렌더가 그대로 재사용되고, 일 그리드만 1열로 좁아진다. 그리드 밖 항목은 기존처럼 자동 클리핑되므로 주/일 보기는 그 기간에 걸치는 단계·할일만 보여준다.

## 변경 내용

### `src/components/features/my-work/my-work-month.ts`

- `MonthGrid` → **`CalendarGrid`** 로 일반화. `columns`·`rows`·`rowCount`·`todayISO` 필드. (`MonthGrid`는 별칭으로 남겨 기존 import 호환)
  - `weeks`→`rows`, `weekCount`→`rowCount` (행 수), `todayDate`(일자 숫자)→`todayISO`(실제 날짜 문자열). 주·일 보기가 월 경계를 넘을 때 일자 숫자 비교는 어긋날 수 있어 실제 날짜로 비교한다
- `buildWeekGrid(base, today)` 추가 — 그 주 일요일부터 7일, 실제 날짜(다른 달이어도 그대로)
- `buildDayGrid(base, today)` 추가 — 하루 1칸
- `gridWeekdayHeaders(grid)` 추가 — 열 헤더 라벨을 그리드 첫 칸부터 columns개 만든다(일 보기는 그날 요일 하나)
- `gridDayCount = rowCount × columns`

### `my-work-calendar-source.ts` / `my-work-calendar-layout.ts`

- `DAYS_PER_WEEK` 상수 참조를 **`grid.columns`** / 레이아웃에 넘긴 `columns` 인자로 교체
- `buildWeekLayouts(overlays, rowCount, columns)` — 열 수를 받아 `week`/`col` 계산에 쓴다

### `my-work-calendar.tsx`

- `colLeft`·`colWidth`가 `columns`를 받아 `%`를 계산 (7 고정 제거)
- 요일 헤더를 `gridWeekdayHeaders`로 — 일 보기면 한 칸
- 오늘 강조를 `cellDate === grid.todayISO`로 (일자 숫자 비교 폐기)
- 드래그 히트테스트(`dayFromPointer`)와 셀 우측 보더를 `columns` 기준으로
- `ProjectBoxItem`·`OverlayItem`에 `columns` 전달

### `my-work-calendar-panel.tsx`

- `monthAnchor`(달 1일) → `view` + `anchorISO`(기준 하루). 뷰에 따라 `buildDayGrid`/`buildWeekGrid`/`buildMonthGrid`
- ◀▶ 이동을 뷰 단위로(`shiftPeriod`: 일=1일, 주=7일, 월=한 달)
- 제목을 `grid.title`로, "이 달/이 주/이 날 N건"으로
- 헤더에 `MyWorkCalendarToolbar`(세그먼트 + 오늘로 돌아가기)

### `my-work-calendar-toolbar.tsx` (신규)

`[일 | 주 | 월]` 세그먼트 + `오늘로 돌아가기` 버튼. 스타일은 로드맵 레인지 스위처와 같은 규격(`bg-muted p-[3px]`, 활성만 `bg-background` + 미세 그림자).

### `task-status-calendar.tsx`

작업 현황 캘린더도 같은 그리드를 쓴다 — `grid.weekCount`/`year`/`month` 참조를 `rowCount`/`columns`/`grid.title`로 맞췄다. 이 화면은 월 보기만 쓴다(뷰 세그먼트 없음).

## 검증

```bash
npx tsc --noEmit          # 통과 (출력 없음)
npm run lint              # 통과
npm run build             # 성공 — Compiled successfully
```

### 계산 계층 확인 (tsx)

브라우저 렌더는 도구가 없어 못 하지만, 그리드·소스·레이아웃 순수 계산을 직접 돌려 확인했다(기준 7/30, 단계 7/28~8/3).

| 보기 | 결과 |
| --- | --- |
| 일 | columns=1, 1칸 `[30]`, 헤더 `목`, 단계 조각 `w0c0s1`(그날 덮음) |
| 주 | columns=7, `[26,27,28,29,30,31,1]`(월 경계 넘어 실제 날짜), 단계 `w0c2s5`, 오늘 7/30 강조 |
| 월 | columns=7, 5행 그리드(기존과 동일), 단계 `w4c2s5` |

**미검증** — 실제 화면 렌더·드래그·세그먼트 전환은 프리뷰에서 확인해야 한다. 브라우저 자동화 도구가 없다.

## 알려진 이슈 / 후속

- **일 보기의 드래그 범위는 좁다.** 보이는 날이 하루뿐이라 그 안에서만 이동한다. 여러 날 이동은 주·월 보기에서 한다.
- "오늘" 버튼을 "오늘로 돌아가기"로 바꿨다(요청). 세그먼트의 "일"은 별개(그날 하루 보기)다.

## 병렬 작업 메모

착수 시점 main = `eb100b4`. 같은 작업을 진행 중이던 다른 워크트리(`캘린더-일주월-보기`, 미커밋)를 사용자 지시로 폐기하고 새로 구현했다. `my-work-calendar-*`·`task-status-calendar.tsx`를 만지는 다른 세션이 없음을 확인했다. 문서 번호는 144까지 사용되어 145로 잡았다.
