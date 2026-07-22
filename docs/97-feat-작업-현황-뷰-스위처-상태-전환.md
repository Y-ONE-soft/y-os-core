# 97. feat: 작업 현황 뷰 스위처 상태 전환

## 배경

작업 현황 화면의 뷰 스위처(`로드맵` / `담당자` / `캘린더`)는 **자리표시**였다.
버튼은 그려져 있지만 `ACTIVE_VIEW = "로드맵"` 상수로 활성 표시만 고정돼 있고
클릭해도 아무 일이 없었다.

```tsx
const ACTIVE_VIEW = "로드맵";   // 이전 — 상수라 바뀌지 않는다
...
<button aria-pressed={view === ACTIVE_VIEW}>   // onClick 없음
```

## 왜 별도 초소형 PR인가

`담당자` 뷰와 `캘린더` 뷰를 **서로 다른 세션이 동시에** 만들고 있다.
둘 다 이 파일에서 같은 일을 먼저 해야 한다 — 상수를 상태로 바꾸고 뷰 분기를
추가하는 것. 각자 자기 기능 브랜치에서 하면 **같은 줄을 양쪽이 고쳐 충돌이
확정적**이고, 나중에 머지되는 쪽이 남의 뷰 분기를 다시 붙이게 된다.

그래서 공통 기반만 떼어 먼저 머지한다. 이후 두 세션은 각자 자기 탭의 분기 한
줄만 얹으면 되고 서로 닿지 않는다. CLAUDE.md의 "부수 변경은 초소형 PR로 분리"를
기능 선행 기반에 적용한 것이다.

## 구현

상수를 상태로 바꾸고, 탭에 `onClick`을 붙이고, 아직 화면이 없는 뷰에는
자리표시를 렌더한다. **이번 PR은 어떤 뷰도 새로 만들지 않는다** — 로드맵은
그대로고 나머지 둘은 "준비 중" 안내다.

```tsx
type TaskStatusView = (typeof VIEW_OPTIONS)[number];
const [view, setView] = useState<TaskStatusView>("로드맵");
```

```tsx
{view === "로드맵" ? (
  <WorkloadRoadmap sections={sections} onOpenStage={...} />
) : (
  <ViewPlaceholder view={view} />
)}
```

`ViewPlaceholder`는 점선 테두리에 "〈뷰〉 뷰는 준비 중입니다."만 표시한다.
담당자·캘린더 세션은 이 삼항의 가지를 자기 뷰로 갈아 끼우면 된다.

변수명은 `view`(현재 상태) / `option`(순회 중인 탭)으로 나눴다 — 기존 코드가
`view`로 순회하고 있어 상태를 도입하면 가려지기 때문이다.

## 검증

`localhost:3041`에서 puppeteer로 실제 클릭 확인.

| 검증 | 결과 |
| --- | --- |
| 초기 활성 탭이 로드맵 (`aria-pressed`) | PASS |
| 초기에 로드맵 렌더 | PASS |
| 담당자 탭 클릭 → 활성 전환 | PASS |
| 담당자 탭에서 자리표시 표시 | PASS |
| 담당자 탭에서 로드맵은 사라짐 | PASS |
| 캘린더 탭 클릭 → 활성 전환 + 자리표시 | PASS |
| 로드맵으로 복귀 → 다시 렌더 | PASS |
| 스탭 계정에서도 탭 전환 동작 | PASS |

`npm run build`, `npm run lint` 통과. 콘솔 에러 없음.

## 변경 파일

- `src/components/features/projects/task-status-page.tsx`

## 다음

- `담당자` 뷰 — Figma `Task Status Layout — Master · Assignee`(`207:892`), 보드 본체
  `207:1189`. 담당자별 컬럼. **`Task`에 담당자 필드가 없어 마이그레이션이 선행**된다.
- `캘린더` 뷰 — 별도 세션(`작업현황-캘린더-뷰`) 진행 중.
