# feat: 타임라인 뷰에 마감 깃발 표시

요청 사이클 `타임라인-마감-깃발`의 단일 태스크.

## 배경

"프로젝트 마지막일에 깃발 표시로 마감 보이게, 단계는 데드라인 표시 설정하면 마감 깃발 보이게" 요청.

### 범위를 타임라인 뷰로 한정한 이유 (중요)

사용자가 대상 화면으로 **"캘린더 뷰와 타임라인 뷰"**(내 할일)를 지정했다. 그런데 착수 시점에 **캘린더 뷰(`my-work-calendar.tsx`)를 4개 세션이 동시에 작업 중**이었다.

- `calendar-dwm-view`(일·주·월 보기 대규모 재작성)
- `calendar-gap-x`(가로 간격)
- `calendar-stage-move-tasks`(단계 이동 시 할일 동반)
- `mywork-unassigned-drag`(미배정 할일 드래그)

캘린더에 지금 손대면 심한 충돌이 나고, 그쪽이 캘린더 구조를 바꾸므로 깃발 위치 계산도 다시 짜야 한다(CLAUDE.md의 "범위 중복 시 대기" 규칙, docs/22 폐기 사례). **타임라인 뷰(`my-work-timeline-panel.tsx`)는 어느 세션도 건드리지 않고 캘린더 소스와도 독립적**이라, 사용자 지시("대기가 원칙이되 지금 작업 가능하면 하라")에 따라 타임라인만 먼저 구현한다. **캘린더 뷰 몫은 그 4개 세션이 머지된 뒤 후속 사이클로 진행한다.**

## 결정 사항 (사용자 승인)

| 항목 | 값 |
|---|---|
| 프로젝트 마지막일 | **가장 늦은 단계 종료일** (프로젝트에 날짜 필드가 없음) |
| 단계 깃발 조건 | **`showDeadline`(데드라인 표시)이 켜진 단계만** |

## 변경 내용

### 1. `src/components/features/projects/deadline-flag.tsx` (신규)

타임 격자(`RoadmapTimeline` 좌표계) 위 특정 날짜에 깃발을 세우는 공용 컴포넌트. 나중에 캘린더 뷰에서도 재사용하려고 `projects` 아래에 뒀다.

```tsx
export function DeadlineFlag({ timeline, date, color, title }) {
  const index = dayOffset(date, timeline.start);
  if (index < 0 || index > timeline.days) return null;   // 격자 밖이면 안 그림
  const left = (index + 1) * timeline.dayWidth;          // 그 날 칸의 오른쪽 끝
  return (
    <span aria-hidden title={title}
      className="pointer-events-none absolute top-0 z-10 -translate-x-1/2"
      style={{ left, color }}>
      <Flag className="size-3 fill-current" strokeWidth={0} />
    </span>
  );
}
```

- 마감은 "그날이 **끝나는** 지점"이라 칸의 **오른쪽 끝**(`(index+1) × dayWidth`)에 깃대를 세운다.
- `pointer-events-none` — 아래 `RoadmapBar`의 드래그·클릭을 막지 않는다.
- 창(줌 범위) 밖의 마감은 표시할 자리가 없으므로 그리지 않는다.
- 색은 프로젝트/단계 색을 그대로 받아, 어느 행의 마감인지 색으로 구분된다.

### 2. `src/components/features/my-work/my-work-timeline-panel.tsx`

**프로젝트 행** — 프로젝트 막대는 이미 `marks`(단계 기간 + 할일 예정일을 모은 정렬 배열)로 범위를 그린다. 그 **끝값 `marks[last]`이 곧 프로젝트 마지막일**이라 그대로 깃발 날짜로 쓴다. 별도 계산이 필요 없었다.

```tsx
{/* 프로젝트 마감 = 가장 늦은 단계 종료일(marks의 끝). 항상 표시. */}
{marks.length > 0 && (
  <DeadlineFlag timeline={timeline} date={marks[marks.length - 1]}
    color={project.color} title={`${project.name} 마감 …`} />
)}
```

**단계 행** — `showDeadline`이 켜진 단계에만, 종료일(없으면 시작일)에 깃발.

```tsx
{stage.showDeadline && (stage.endDate ?? stage.startDate) && (
  <DeadlineFlag timeline={timeline} date={(stage.endDate ?? stage.startDate)!}
    color={stage.color} title={`${stage.name} 마감 …`} />
)}
```

두 행의 막대 컨테이너가 이미 `relative`라 절대 위치 깃발이 그대로 얹힌다.

## 검증

`npm run build` 성공, `npm run lint` 경고 0.

헤드리스 브라우저로 타임라인 뷰를 실제로 열어 확인했다. 픽스처: master 소유 프로젝트에 기본 단계("프로젝트 생성", `showDeadline=false`)와 마감 단계(`showDeadline=true`, 07-28~08-02)를 만들었다.

**프로젝트 마감 깃발** — 스크린샷에서 각 프로젝트 막대의 오른쪽 끝(마지막일)에 프로젝트 색 깃발이 세워진 것을 확인했다("한영고1 1주 차" 7/28, "내신 2주 차" 8/4 등).

**단계 깃발 — showDeadline만** — 픽스처 프로젝트의 두 단계를 y좌표 근접으로 판정:

```
마감 단계(showDeadline=true):  깃발O
프로젝트 생성(showDeadline=false): 깃발X
```

데드라인 표시가 켜진 단계에만 깃발이 뜨고 꺼진 단계에는 없다 — 요구 조건 정확히 충족.

검증용 프로젝트(`p-flag`)는 삭제했다. 다른 프로젝트는 실사용/타 세션 데이터라 건드리지 않았다.

## 변경 파일 내역

| 파일 | 구분 | 내용 |
|---|---|---|
| `src/components/features/projects/deadline-flag.tsx` | 신규 | 타임 격자 위 마감 깃발 공용 컴포넌트 |
| `src/components/features/my-work/my-work-timeline-panel.tsx` | 수정 | 프로젝트 행(마지막일)·단계 행(showDeadline)에 깃발 |

## 알려진 이슈 / 주의점

### 캘린더 뷰는 아직 안 됐다 (후속 필수)

사용자 요청은 캘린더 뷰도 포함한다. 캘린더를 4개 세션이 동시에 작업 중이라 이번엔 타임라인만 했다. **그 세션들이 머지된 뒤 캘린더 뷰에 같은 `DeadlineFlag`를 적용하는 후속 사이클이 필요하다.** 공용 컴포넌트로 만든 이유다. 다만 캘린더는 타임 격자가 아니라 월 그리드라, `DeadlineFlag`를 그대로 쓸 수 없고 그리드 좌표에 맞춘 배치가 별도로 필요할 수 있다.

### 프로젝트 마감이 항상 보인다

프로젝트 깃발은 `showDeadline` 같은 토글 없이 마지막일에 늘 표시된다. 요청이 "프로젝트 마지막일에 깃발"이라 조건 없이 붙였다. 프로젝트가 많으면 깃발도 그만큼 늘어난다(각 1개). 단계 깃발은 `showDeadline`으로 걸러지지만 프로젝트 깃발은 그렇지 않다.

### 단계 종료일이 없으면 시작일을 마감으로 본다

`endDate`가 없는 단계는 하루짜리 막대라 시작일에 깃발을 세운다. 종료일이 있는 게 정상이지만, 없는 데이터에서도 깃발이 사라지지 않게 방어했다.

### 같은 날 마감이 겹치면 깃발이 포개진다

프로젝트 마지막일과 그 프로젝트의 마감 단계 종료일이 같으면, 프로젝트 행과 단계 행은 다른 행이라 문제없다. 다만 한 행 안에서 여러 마감이 같은 날이 될 일은 현재 구조상 없다.

### TZ

깃발 위치는 저장된 `startDate`/`endDate`(YYYY-MM-DD)를 그대로 쓰므로 표시 자체엔 TZ 이슈가 없다. 다만 그 날짜들을 만드는 상류(기본 단계 생성 등)의 TZ 한계는 그대로다.
