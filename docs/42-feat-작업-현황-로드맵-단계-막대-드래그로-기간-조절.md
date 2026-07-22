# feat: 작업 현황 로드맵 단계 막대 드래그로 기간 조절

## 작업 요약

작업 현황(`/projects`) 로드맵의 단계 막대를 마우스·터치로 끌어 기간을 바꿀 수 있게 했다.

- **좌측 끝 드래그** → 시작일만 이동 (앞당기기·미루기)
- **우측 끝 드래그** → 종료일만 이동 (늘리기·줄이기)
- **가운데 드래그** → 길이를 유지한 채 통째 이동
- **클릭** → 기존 동작 그대로 단계 상세 열기

지금까지 단계 기간은 단계 상세 오버레이의 `<input type="date">` 두 개로만 바꿀 수 있었다. [`project-roadmap.tsx:32`](../src/components/features/projects/project-roadmap.tsx#L32)에 "막대 드래그로 이동·기간 조절"이라는 **문구만 있고 구현은 없던** 상태였는데, 이번에 작업 현황 로드맵에 실제로 구현했다.

## 설계 결정

### 왜 작업 현황 로드맵인가

막대 드래그가 가능한 화면 후보가 셋 있었다.

| 화면 | 데이터 | 좌표계 | 판단 |
| --- | --- | --- | --- |
| 작업 현황 로드맵 (`workload-roadmap.tsx`) | 실 DB | `timeline.dayWidth` (px/일) | **채택** |
| 프로젝트 상세 로드맵 (`project-roadmap.tsx`) | 실 DB | `%` (고정 `ROADMAP` 상수) | 제외 |
| 내 작업 캘린더 (`my-work-calendar.tsx`) | 하드코딩 더미 | 주 7칸 분율 | 제외 |

작업 현황 로드맵만 **하루당 픽셀(`dayWidth`)이 명시적**이라 `px → 일수` 변환이 `Math.round(dx / dayWidth)` 한 줄로 정확히 떨어진다. 나머지 둘은 퍼센트/분율 좌표라 컨테이너 실측 폭이 필요하고, 캘린더는 애초에 DB에 연결돼 있지도 않다. 요청도 "작업현황에도"였으므로 이 화면만 대상으로 했다.

### 날짜 계산을 컴포넌트 밖으로 분리

드래그 날짜 계산을 `Bar` 컴포넌트 안에 두면 **검증할 방법이 없다**. 브라우저 자동화 도구가 없는 상태에서 날짜 경계(월말·연말·윤년)와 클램프가 맞는지 확인할 수단이 사라진다.

그래서 순수 함수 `dragStageDates(mode, startDate, endDate, delta)`를 [`roadmap-utils.ts`](../src/components/features/projects/roadmap-utils.ts)에 만들고 컴포넌트는 이를 호출만 한다. 덕분에 실제 모듈을 그대로 import해 24개 케이스를 검증할 수 있었다(아래 검증 절).

### 최소 1일 보장

시작일이 종료일을 앞지르면 막대가 뒤집히므로 클램프한다.

- `start` 모드: `delta`를 `span` 이하로 제한 (`span` = 막대 길이 - 1)
- `end` 모드: `delta`를 `-span` 이상으로 제한

끝까지 끌면 `startDate === endDate`인 1일짜리 막대가 되고 더는 줄지 않는다. 서버(`PATCH /api/admin/stages/[stageId]`)에는 날짜 검증이 없으므로 이 클램프가 유일한 방어선이다.

### 진행형(종료일 없는) 막대 처리

`endDate`가 없는 단계는 화면에 `OPEN_ENDED_DAYS`(5일) 길이로 그려진다. 모드별로 다르게 다뤘다.

| 모드 | 동작 | 이유 |
| --- | --- | --- |
| `move` | 열린 채로 이동 (`endDate` 계속 `undefined`) | 이동은 "끝을 정한다"는 의사표시가 아니다 |
| `start` | 열린 채로 시작일만 이동 | 위와 같음 |
| `end` | **종료일이 실제로 생김** (표시 길이 5일을 기준으로 계산) | 끝을 끄는 건 명시적으로 끝을 정하는 조작 |

`endDate: undefined`는 `JSON.stringify`에서 키째 빠지므로 PATCH 본문에 실리지 않는다. 즉 열린 막대를 옮겨도 종료일에 `null`이 잘못 써지는 일은 없다.

### 클릭과 드래그 구분

막대는 클릭 시 단계 상세를 여는 `<button>`이다. 드래그 후 뒤따라오는 `click`이 오버레이를 열어버리면 안 된다.

1. 포인터 이동이 `DRAG_THRESHOLD`(3px) 미만이면 드래그로 치지 않는다 → 손떨림으로 상세가 안 열리는 일 방지
2. 3px를 넘겨 드래그했다면 `draggedRef`를 세우고, 직후 `handleClick`에서 **한 번만 삼킨다**

`onClick` 자체는 그대로 두었기 때문에 **키보드 접근성이 유지된다**. 포인터 없이 Enter/Space로 버튼을 활성화하면 `draggedRef`가 `false`라 정상적으로 상세가 열린다. (드래그 자체는 포인터 전용이며, 키보드 사용자는 기존 단계 상세의 날짜 입력으로 기간을 바꾼다.)

`pointerdown`에서 `preventDefault()`는 **의도적으로 호출하지 않았다.** 호출하면 브라우저에 따라 뒤따르는 `click`이 억제되어 위 경로가 깨진다. 텍스트 선택 방지는 `select-none` 클래스로 처리했다.

### 미리보기는 로컬 state, 저장은 손 뗄 때 한 번

드래그하는 내내 PATCH를 날리면 요청이 폭주한다. `draft` state로 화면만 갱신하고, `pointerup`에서 딱 한 번 `boardActions.updateStage`를 호출한다(낙관적 반영 + 실패 시 `workspace-cache`가 서버 상태로 재동기화).

`pointerup`의 최종 값은 `draft` state가 아니라 **이벤트의 최종 좌표에서 다시 계산**한다. state를 읽으면 마지막 `setDraft`가 아직 커밋되지 않았을 때 한 틱 뒤처진 값이 저장될 수 있다.

드래그했지만 `delta`가 0으로 반올림되면(예: `주` 배율에서 5px 이동) PATCH를 보내지 않는다.

## 변경 파일

### `src/components/features/projects/roadmap-utils.ts`

1. **날짜 헬퍼 공용화** — `toISO`/`fromISO`/`addDays`를 `roadmap-window.ts`의 private 함수에서 이곳으로 옮겨 export했다. 주석으로 "로컬 시간 기준으로만 다룬다 — DB가 `YYYY-MM-DD` 문자열이라 UTC 파싱이 끼면 하루씩 밀린다"는 이유를 명시했다.
2. **`shiftISO(iso, amount)` 추가** — `YYYY-MM-DD` 문자열을 일수만큼 이동. 월·연 넘김은 `Date`가 처리한다.
3. **`DragMode`·`StageDates` 타입, `dragStageDates()` 추가** — 위 설계의 클램프·진행형 처리를 담은 순수 함수.

`roadmap-utils.ts`는 `roadmap-window.ts`가 의존하는 하위 모듈이라(역방향 의존 없음) 순환 참조가 생기지 않는다.

### `src/components/features/projects/roadmap-window.ts`

private `toISO`/`fromISO`/`addDays` 정의를 지우고 `roadmap-utils`에서 import하도록 바꿨다. 동작 변경 없는 중복 제거다.

### `src/components/features/projects/workload-roadmap.tsx`

1. **상수** — `DRAG_THRESHOLD = 3`, `HANDLE_WIDTH = 6` 추가.
2. **`Bar`에 `onCommit?: (patch: StageDates) => void` 추가** — 넘기지 않으면 드래그가 완전히 비활성이다. 프로젝트 전체 막대(`전체 N%`)는 단계들에서 파생된 값이라 넘기지 않아 **드래그 불가**로 남는다.
3. **드래그 상태** — `rootRef`(포인터 캡처 대상), `dragRef`(모드·시작 X·이동 여부), `draggedRef`(click 삼키기), `draft` state.
4. **핸들러** — `beginDrag`/`finishDrag` + `handleBodyPointerDown`/`handleStartHandlePointerDown`/`handleEndHandlePointerDown`/`handlePointerMove`/`handlePointerUp`/`handlePointerCancel`.
   처음에는 `startDrag(mode) => (event) => ...` 커링으로 짰다가 **`react-hooks/refs` 린트 에러 10건**이 났다. `startDrag("move")`를 JSX에서 호출하는 형태라 린터가 "렌더 중 ref 접근"으로 판정한 것이다. 모드별 평범한 함수로 풀어 해결했다.
5. **리사이즈 손잡이** — 막대 좌·우 끝에 `absolute inset-y-0` + `cursor-ew-resize`인 `<span aria-hidden>` 2개. 손잡이의 `pointerdown`은 `stopPropagation()`으로 본체의 이동 드래그가 같이 시작되지 않게 막는다. `<button>` 안에 들어가므로 `<div>`가 아닌 `<span>`을 썼다.
6. **포인터 캡처** — 캡처를 항상 **루트**에 건다. 손잡이에서 드래그를 시작해도 이후 `pointermove`/`pointerup`이 루트로 모여 막대 밖으로 커서가 나가도 드래그가 유지된다.
7. **터치 대응** — `touch-none`. 없으면 터치로 막대를 끌 때 타임라인 가로 스크롤이 함께 먹는다.
8. **라벨을 함수로 받을 수 있게 변경** — `label: string | ((start, end?) => string)`. 드래그 중 막대 폭만 변하고 라벨의 날짜 텍스트는 그대로여서 어긋나 보이던 문제를 고쳤다. 단계 막대는 함수를 넘겨 미리보기 날짜(`07/20~07/27`)가 실시간으로 갱신되고, 프로젝트 막대는 기존처럼 문자열을 넘긴다.
9. **드래그 중 시각 피드백** — `cursor-grab`/`active:cursor-grabbing`, 드래그 중 `z-10 shadow-sm`으로 이웃 막대 위로 띄운다.
10. **`title` 보강** — `"<단계명> — 클릭하면 단계 상세, 양 끝을 끌면 기간 조절, 가운데를 끌면 이동"`.

## 검증

### 날짜 계산 — 24개 케이스 전부 통과

실제 `roadmap-utils.ts`를 import하는 임시 스크립트를 `npx tsx`로 돌렸다(검증용이며 커밋에는 포함하지 않음).

| 그룹 | 케이스 |
| --- | --- |
| `shiftISO` 경계 | 월말 `07-31→08-01`, 연말 `12-31→2027-01-01`, 연초 `-1→2025-12-31`, 윤년 `2028-02-28→02-29`, 평년 `2026-02-28→03-01`, `delta 0` |
| 끝 드래그 | `+3` 늘리기, `-2` 줄이기, `-4`로 시작일까지, `-99` 클램프 → 1일 유지 |
| 시작 드래그 | `-3` 앞당기기, `+4`로 종료일까지, `+99` 클램프 → 1일 유지 |
| 통째 이동 | `+10`(월 넘김), 길이 보존 확인(`dayOffset` 4일 유지), `-10` 역방향 |
| 진행형 막대 | `move`·`start`는 열린 채 유지, `end`는 종료일 생성(`07-26`), 클램프 |
| `barRange` 반영 | 5일 → `end +3` 후 8일, `start +2` 후 3일 (`startDay`도 19→21로 이동) |

### 저장 경로 — 실제 API로 확인

dev 서버(포트 3007) + 실 DB로 드래그가 호출할 경로를 직접 태웠다.

```
PATCH /api/admin/stages/st-define {"startDate":"2026-07-20","endDate":"2026-07-27"} → 200 {"ok":true}
GET   /api/admin/workspace → 프로젝트 정의 2026-07-20 ~ 2026-07-27   (반영 확인)
PATCH ... {"endDate":"2026-07-24"} → 200                              (원복)
GET   /api/admin/workspace → 2026-07-20 ~ 2026-07-24                  (원복 확인)
```

**개발 DB는 전 세션 공유**이므로 확인 직후 원래 값으로 되돌렸다.

### 정적 검증

| 항목 | 결과 |
| --- | --- |
| `npm run lint` | 통과 (`react-hooks/refs` 10건 해결 후) |
| `npx tsc --noEmit` | 통과 |
| `npm run build` | 통과 |

## 알려진 이슈 · 한계

- **실제 드래그 조작은 육안 확인 미완.** 저장소에 브라우저 자동화 도구가 없고 육안 확인만을 위한 의존성 추가는 규약상 피했다. 날짜 계산(순수 함수)과 저장 경로(API)는 위와 같이 실측했으나, **포인터 이벤트 배선 자체**(손잡이 히트박스, 캡처 유지, 클릭 삼키기)는 검증하지 못했다. 사용자 검토와 프리뷰 배포로 확인 후 "사후 검증 결과 (추록)"에 보완한다.
- **좁은 배율에서 드래그가 민감하다.** `분기` 배율은 `dayWidth: 2.4px`라 1px 움직임이 약 0.4일이다. 정밀 조정은 `일`(56px/일)·`주`(20px/일) 배율에서 하는 것이 맞다. 배율별 스냅 단위를 다르게 두는 방안도 있으나(예: 분기에서는 주 단위 스냅) 요청 범위를 넘어 하지 않았다.
- **손잡이가 배지와 겹친다.** 좌측 손잡이 6px가 단계 번호 배지(11px) 위에 얹힌다. 투명해서 보이지는 않지만 배지 왼쪽 절반을 누르면 리사이즈가 시작된다. 최소 폭 32px인 짧은 막대에서는 좌우 손잡이 12px가 폭의 상당 부분을 차지해 가운데 이동 영역이 좁다.
- **서버 측 날짜 검증은 여전히 없다.** `PATCH /api/admin/stages/[stageId]`는 화이트리스트만 확인할 뿐 `endDate >= startDate`나 날짜 형식을 보지 않는다. 이번 클램프는 클라이언트 방어이며, 서버 검증은 별도 태스크로 분리하는 편이 맞다.
- **되돌리기(undo)는 없다.** 잘못 끌었으면 다시 끌거나 단계 상세에서 날짜를 고쳐야 한다.

## 병렬 작업 메모

- 베이스 `236e3f0`, 이전 커밋(태스크 1) 위에 쌓았다.
- `작업-현황-작업버튼-제거` 브랜치와 같은 화면을 건드리나 파일이 갈린다(그쪽은 `task-status-page.tsx` 추정, 이쪽은 `workload-roadmap.tsx`·`roadmap-utils.ts`·`roadmap-window.ts`). 머지 순서에 따라 리베이스한다.
- `roadmap-window.ts`·`roadmap-utils.ts`는 프로젝트 상세 로드맵도 함께 쓰는 공용 모듈이다. 이번 변경은 **기존 export를 지우지 않고 추가만** 했고 `roadmap-window`의 동작도 그대로라, 이 모듈을 쓰는 다른 브랜치가 있어도 깨지지 않는다. (main 빌드가 깨졌던 docs/13 사례가 export 제거였다.)
- 스키마·마이그레이션 변경 없음.

## 사후 검증 결과 (추록)

푸시 이후 확정된 내용을 보완한다.

- **PR**: [#34](https://github.com/Y-ONE-soft/y-os-core/pull/34)
- **최종 커밋**: `de0ce90` (최신 main `ebc05e7` 리베이스 후 해시 변경, 리베이스 전 `7bb192b`)
- **문서 번호**: `34 → 40`으로 조정했다가(커밋 `56c71a2`), 짝 문서의 39 중복 재조정에 맞춰 태스크 순서를 유지하려고 최종 `42`가 됐다.
- **리베이스 결과**: main이 `236e3f0 → ebc05e7`로 앞서 나간 뒤(보드 단계 추가 컬럼 #29, 스탭 프로젝트 생성 #31, docs 번호 정리 #32 머지) 리베이스했으나 **충돌 없음**. 리베이스 후 `npm run lint` · `npm run build` 재확인 통과. 공용 모듈(`roadmap-utils`·`roadmap-window`)을 건드렸지만 export를 지우지 않고 추가만 해서 교차 의존이 깨지지 않았다.
- **프리뷰 배포**: Vercel 체크 `pass`, `mergeable: MERGEABLE / CLEAN`.
- **포인터 조작 육안 확인은 프리뷰로도 불가.** 프리뷰가 `302` SSO 리다이렉트로 막히고, 한글 브랜치 별칭이 공유형이라 대상 배포를 특정하기도 어렵다. 손잡이 히트박스·캡처 유지·클릭 삼키기 검증은 **로컬 dev 서버 또는 머지 후 프로덕션**에서 실제로 끌어봐야 한다. 날짜 계산과 저장 경로는 본문 검증 절대로 실측을 마쳤다.
