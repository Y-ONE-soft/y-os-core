# 153. feat: 작업 현황 캘린더에 일·주·월 보기와 오늘로 돌아가기

## 작업 요약

작업 현황 캘린더에도 내 할일 캘린더와 **같은 일 / 주 / 월 보기 세그먼트 + 오늘로 돌아가기** 를 넣었다. docs/151에서 내 할일 캘린더에 넣은 것을 그대로 이어받는다.

## 배경

작업 현황 캘린더(`TaskStatusCalendar`)는 내 할일 캘린더와 같은 렌더·소스·레이아웃을 쓴다(드래그·완료 토글만 빼고 읽기 전용). docs/151에서 그리드를 일·주·월로 일반화하고 세그먼트 툴바(`MyWorkCalendarToolbar`)를 만들었으므로, 여기서는 그것을 재사용하기만 하면 된다.

## 변경 내용

### `src/components/features/projects/task-status-calendar.tsx`

- 상태를 `monthAnchor`(달 1일) → **`view` + `anchorISO`**(내 할일 패널과 동일). 뷰에 따라 `buildDayGrid`/`buildWeekGrid`/`buildMonthGrid`
- ◀▶ 이동을 뷰 단위로(`shiftPeriod`: 일=1일, 주=7일, 월=한 달)
- 헤더의 `오늘` 버튼 자리에 **`MyWorkCalendarToolbar`**(`[일 | 주 | 월]` + `오늘로 돌아가기`). 새 컴포넌트를 만들지 않고 내 할일 것을 그대로 쓴다
- 건수 문구를 `이 달/이 주/이 날 N건`으로

읽기 전용 성격(드래그·완료·드롭 없음)은 그대로다 — `MyWorkCalendar`에 그 핸들러를 넘기지 않는 것으로 유지된다.

## 검증

```bash
npx tsc --noEmit          # 통과 (출력 없음)
npm run lint              # 통과
npm run build             # 성공 — Compiled successfully
```

그리드·소스·레이아웃 계산 계층은 docs/151에서 세 뷰 모두 검증했고, 이 파일은 그 파이프라인을 그대로 부른다(범위만 `projects`, 미배정 제외).

**미검증** — 화면 렌더·세그먼트 전환은 프리뷰에서 확인해야 한다. 브라우저 자동화 도구가 없다.

## 병렬 작업 메모

착수 시점 main = `0d58205`. `task-status-calendar.tsx`를 만지는 다른 세션이 없음을 확인하고 진행했다. 문서 번호는 152까지 사용되어 153으로 잡았다.
