# 32. feat: 내 작업 캘린더 프로젝트 박스 레이아웃

## 작업 요약

내 작업 페이지(`/projects/my-tasks`) 월 캘린더의 오버레이 구조를 **프로젝트 박스 단위**로 재구성했다.

- 프로젝트 하나가 박스 하나 — 그 프로젝트의 **단계와 할일을 함께 감싼다**
- 단계 막대는 박스 안에서 **한 줄**로만 표현한다. 기간이 겹쳐도 줄을 나누지 않고 겹쳐 그린다
- 겹친 막대도 집어낼 수 있도록 **레인·막대 높이를 키웠다**

docs/30에서 같은 프로젝트 단계를 한 레인에 겹치게 만든 데 이어, 이번엔 프로젝트 소속 할일까지 같은 박스에 묶고 높이를 확보했다.

## 배경

docs/30 이후 두 가지가 남아 있었다.

1. **할일이 프로젝트 밖에 떠 있었다.** 작업 칩(`task`)에는 프로젝트 소속이 없어 색만 프로젝트 색을 따랐고, 프로젝트 배경 박스는 단계만 감쌌다. W5의 `PRD`·`설계서 검토`는 어느 박스에도 들어가지 않았다.
2. **겹친 단계 막대를 집어내기 어려웠다.** 레인 20px·막대 18px에서 `개발구현`(col 0~6) 위에 `착수`(col 1~4)가 올라가면 노출 구간이 얇았다.

## 변경 내용

### 1. 프로젝트 박스를 파생값으로 (`my-work-data.ts`)

`projectBg` 오버레이 종류를 **삭제**했다. 박스의 열 범위는 데이터에 적지 않고 소속 항목(단계 + 할일)의 합집합으로 계산한다.

기존에 손으로 적혀 있던 `projectBg` 3건은 모두 소속 단계의 합집합과 정확히 일치했으므로 렌더 결과는 그대로다. 박스와 내용이 어긋날 여지가 사라졌다.

색도 오버레이 행마다 반복하지 않고 프로젝트 메타로 모았다.

```ts
export const PROJECTS: Record<string, ProjectMeta> = {
  CMS: { color: BLUE, text: BLUE_TEXT },
  YOS: { color: PURPLE, text: PURPLE_TEXT },
  YOC: { color: GREEN, text: GREEN_TEXT },
};
```

박스 라벨은 주차별로 지정한 곳에만 붙는다(`PROJECT_BOX_LABELS` — 현재 W3 CMS 1건). 기존 동작과 같다.

### 2. 할일에 프로젝트 부여

`task` 오버레이에 `project`를 추가했다. 색으로만 암시되던 소속을 명시한다.

- `PRD`·`설계서 검토` → YOS
- `회의1` → YOC

그 결과 **W5에 YOS 박스가 새로 생긴다**. 단계 없이 할일만 든 박스다.

### 3. 배치 규칙 (`my-work-calendar-layout.ts`)

```
1. 프로젝트 하나가 박스 하나 — 단계와 할일을 모두 감싼다
2. 단계 막대는 박스 안에서 한 줄. 겹쳐도 나누지 않고 겹쳐 그린다
3. 할일 칩은 단계 줄 아래에 붙고, 서로 겹칠 때만 줄을 나눈다
4. 서로 다른 프로젝트는 열 범위가 겹칠 때만 위아래로 갈라진다
```

- `ProjectBox` 타입 신설 — `{ project, col, span, lane, lanes, stageLanes, label }`
- `placeBlock()` — 프로젝트 블록은 여러 레인을 차지하므로, **연속한 빈 레인 구간**을 찾아 앉힌다 (docs/30의 단일 레인 배치에서 확장)
- 할일은 프로젝트 안에서 열 겹침 기준으로 줄을 나눈 뒤 단계 줄 아래에 붙인다
- 렌더 순서는 `단계 → 할일`, 같은 종류면 긴 막대를 먼저 그려 짧은 막대가 위에 겹친다

### 4. 높이 (`my-work-calendar.tsx`)

| 항목 | 전 | 후 |
| --- | --- | --- |
| 레인 1단 | 20px | **26px** |
| 단계 막대 | 18px | **22px** |
| 할일 칩 | 16px | **20px** |

막대가 두꺼워져 `개발구현`의 노출 구간(왼쪽 끝, `마감` 배지 쪽)과 그 위의 `착수` 모두 집어내기 쉬워졌다.

박스 안에는 줄 구분선을 그린다. 단계 줄과 할일 줄이 **한 프로젝트 안에서 나뉜 칸**으로 읽히게 하는 장치다. 색은 프로젝트 색의 22% 투명도이고, 위치는 박스 기준 `i * LANE_PX + 1`(막대 사이 여백의 가운데).

## 변경 파일

### `src/components/features/my-work/my-work-data.ts`

- `CalOverlay`에서 `projectBg` 종류 삭제 — 박스는 파생값
- `stage`·`task` 모두 `project` 필수, 행별 `color`·`text` 제거
- `ProjectMeta` 타입 + `PROJECTS` 색 메타 추가
- `PROJECT_BOX_LABELS` 추가 (주차별 박스 라벨)
- `CAL_OVERLAYS` 13건 → 9건 (`projectBg` 4건이 파생으로 흡수), 할일 3건에 `project` 부여

### `src/components/features/my-work/my-work-calendar-layout.ts`

- `ProjectBox` 타입 + `WeekLayout.boxes` 추가
- `union()` 추가 — 소속 항목에서 박스 열 범위 산출
- `placeBlock()` — 다중 레인 블록을 연속 빈 구간에 배치
- 프로젝트 내부 배치 — 단계는 한 줄 고정, 할일은 열 겹침 기준으로 줄 나눔 후 단계 줄 아래
- `layoutWeek()`가 주차 번호를 받아 박스 라벨을 붙인다

### `src/components/features/my-work/my-work-calendar.tsx`

- `ProjectBoxItem` 컴포넌트 신설 — 박스 + 라벨 + 내부 줄 구분선
- `OverlayItem`이 `PROJECTS[project]`에서 색을 읽는다 (오버레이가 색을 들고 다니지 않음)
- `LANE_PX` 20 → 26, `STAGE_PX` 22·`TASK_PX` 20 상수 도입 (클래스 고정 높이 `h-[18px]`·`h-4` 제거)
- `colLeft()`·`colWidth()` 헬퍼로 위치 계산 정리

## 결과

| 주차 | 레인 | 구성 |
| --- | --- | --- |
| W3 (7/12~18) | 1 | CMS 박스 1줄 — `통합테스트`·`운영·유지보수`가 안 겹쳐 같은 줄 |
| W4 (7/19~25) | 2 | CMS 박스 1줄(`개발구현`+`착수` 겹침) / YOS 박스 1줄 |
| W5 (7/26~8/1) | 2 | YOS 박스 1줄(할일만) / YOC 박스 2줄(단계 + 할일, 구분선) |

레인 수는 docs/30과 같지만 레인당 26px로 올라가 W4·W5 주차 높이가 84px, W3이 58px가 됐다.

## 검증

```bash
npx tsc --noEmit          # 통과 (출력 없음)
npm run lint              # 통과 (출력 없음)
npm run build             # 성공 — Compiled successfully, 정적 페이지 17/17
npm run dev -- -p 3008    # 워크트리 포트 분리
```

dev 서버 렌더 HTML로 배치를 확인했다 (`master01` 로그인 후 `/projects/my-tasks`).

- **주차 높이** — W3 `min-height:58px`(= 24 + 1×26 + 8), W4·W5 `84px`(= 24 + 2×26 + 8)
- **프로젝트 박스 5개** — W3 CMS / W4 CMS·YOS / W5 YOS·YOC
- **단계 한 줄** — W4의 CMS 단계 2건이 모두 `top:24px; height:22px` (같은 줄에 겹침), YOS만 `top:50px`
- **할일이 박스 안에** — W5 YOS 박스 `top:21px; height:30px`에 `PRD`·`설계서 검토`(`top:24px; height:20px`)가 들어감. YOC 박스는 `height:56px`로 단계(`top:24px`)와 `회의1`(`top:50px`)을 함께 감쌈
- **구분선** — YOC 박스 안 `top:27px`에 1px 선 1개 (2줄 박스에만 생김)

워크트리 환경 준비: `npm install`, `vercel link --yes --project y-os-core --scope project-hosting-center` → `vercel env pull .env.local`.

## 알려진 이슈 / 후속

- **단계가 3개 이상 겹치는 경우** — 한 줄 규칙상 가장 짧은 막대가 위로 올라오고 중간 막대의 노출 폭이 좁아질 수 있다. 자리표시 데이터에는 해당 사례가 없다. 실데이터 연결 후 재평가 대상.
- **막대 선택 동작 자체는 아직 없다.** 이번 변경은 "집어낼 수 있는 크기"까지다. 클릭 시 단계 상세로 가는 연결은 후속 과제.
- `착수` 단계의 프로젝트 귀속은 docs/30에서 정한 대로 색 기준(CMS)을 유지했다.
- `CAL_OVERLAYS`는 여전히 Figma My Work Layout(147:495) 예시 값이다. DB 전환 시 데이터만 API 경계 흐름으로 교체하면 되고, 배치 모듈과 렌더는 그대로 쓴다.

## 사후 검증 결과 (추록)

푸시 이후에만 확정되는 검증 결과.

- **PR**: [#27](https://github.com/Y-ONE-soft/y-os-core/pull/27)
- **프리뷰 배포**: `● Ready` (36s) — https://y-os-core-mjabw1as5-project-hosting-center.vercel.app
- **PR 체크**: `Vercel` pass, `Vercel Preview Comments` pass

## 병렬 작업 메모

착수 시점 main = `2335394`(docs/30 머지 직후). 동시 진행 중이던 워크트리 4개(`backlog-assign-label`·`board-stage-add`·`roadmap-timeline`·`staff-project-create`)의 작업 파일을 확인해 `my-work-calendar.tsx`·`my-work-data.ts`를 만지는 세션이 없음을 확인하고 시작했다. `backlog-assign-label`이 `my-work-backlog.tsx`를 만지지만 캘린더와 별개 파일이다.

문서 번호는 착수 시점 main 기준 31까지 사용되어 32로 잡았다.
