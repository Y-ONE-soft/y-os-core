# 30. fix: 내 작업 캘린더 같은 프로젝트 단계 막대 겹침 표시

## 작업 요약

내 작업 페이지(`/projects/my-tasks`) 월 캘린더에서 **같은 프로젝트의 단계 막대가 기간이 겹치면 두 줄로 갈라지던 것을 한 레인에 겹쳐 그리도록** 바꿨다.

레인(행) 번호를 자리표시 데이터에 손으로 박아 두던 방식을 없애고, 열 범위로 배치를 계산하는 모듈(`my-work-calendar-layout.ts`)을 새로 뒀다. 데이터를 DB로 교체해도 배치 규칙은 그대로 재사용된다.

## 문제

`my-work-data.ts`의 `CAL_OVERLAYS`가 `lane`·`lanes` 값을 하드코딩하고 있었고, 주차별 행 높이도 `WEEK_LANES = [0, 0, 2, 4, 2]`로 따로 박혀 있었다.

W4(7/19~25)의 CMS 프로젝트가 대표 사례다. 같은 CMS인데도

- `개발구현` (col 0, span 6) → `lane: 0`
- `착수` (col 1, span 3) → `lane: 1`

로 갈라져 있었다. 두 단계 기간이 겹치니 레인을 나눠 아래로 밀어낸 것인데, 결과적으로 한 프로젝트가 캘린더에서 두 줄을 차지했다.

## 배치 규칙 (신규)

`src/components/features/my-work/my-work-calendar-layout.ts`

1. **같은 `project`의 단계 막대는 기간이 겹쳐도 한 레인에 겹쳐 그린다.** 프로젝트 1개 = 레인 1개.
2. 서로 다른 프로젝트는 **열 범위가 겹칠 때만** 레인을 나눈다. 안 겹치면 같은 레인을 공유한다.
3. 작업 칩(`task`)은 프로젝트 레인을 배치한 뒤 빈 자리에 채운다.
4. 렌더 순서는 `배경 → 단계 → 작업 칩`, 같은 종류면 **긴 막대를 먼저** 그린다. 짧은 막대가 위에 올라와야 겹침이 드러난다.

겹친 구간의 시각 처리는 별도 장식을 넣지 않고 **기존 반투명 배경(`rgba(color, 0.18)`)의 누적**에 맡겼다. 두 막대가 포개지는 구간만 자연히 진해져 겹침이 읽힌다.

프로젝트별 열 범위는 그 프로젝트의 단계·배경 오버레이를 모두 아우르는 합집합으로 구한다.

## 변경 파일

### `src/components/features/my-work/my-work-calendar-layout.ts` (신규)

- `PlacedOverlay` = `CalOverlay & { lane: number }`, `WeekLayout` = `{ overlays, laneCount }`
- `overlaps()` — 열 범위 겹침 판정
- `layoutWeek()` — 위 배치 규칙 구현. 프로젝트 범위 합집합 → 레인 확보 → 작업 칩 채우기 → 렌더 순서 정렬
- `CAL_WEEK_LAYOUTS` — 주차별 배치 결과. 캘린더는 이 값만 읽는다.

### `src/components/features/my-work/my-work-data.ts`

- `WEEK_LANES` 상수 **삭제** (배치에서 자동 산출)
- `CalOverlay` 타입에서 `lane`·`lanes` 제거, `projectBg`·`stage`에 `project: string` 추가
- 프로젝트 식별자 상수 `CMS`·`YOS`·`YOC` 추가 — **색이 아니라 이 키로 단계를 묶는다**
- `CAL_OVERLAYS` 13건 전부 `lane`/`lanes` 제거 + `project` 부여
- W4 주석을 실제 데이터에 맞게 수정 (`CMS 개발구현(마감)·착수, YOS 프로젝트 정의(마감)`)

### `src/components/features/my-work/my-work-calendar.tsx`

- import 교체 — `CAL_OVERLAYS`·`WEEK_LANES`·`CalOverlay` → `CAL_WEEK_LAYOUTS`·`PlacedOverlay`
- `OverlayItem`이 `PlacedOverlay`를 받는다
- `projectBg` 높이가 `overlay.lanes * LANE_PX + 4` → `LANE_PX + 4` (프로젝트당 1레인이므로 고정)
- 주차 렌더가 `CAL_WEEK_LAYOUTS[weekIndex]`의 `overlays`·`laneCount`를 쓴다. 주차별 `filter`도 배치 단계로 이동해 제거

## 결과

주차별 레인 수가 줄어 캘린더 행 높이도 함께 낮아졌다.

| 주차 | 변경 전 | 변경 후 |
| --- | --- | --- |
| W3 (7/12~18) | 2레인 | **1레인** |
| W4 (7/19~25) | 4레인 | **2레인** |
| W5 (7/26~8/1) | 2레인 | 2레인 (변화 없음) |

W4의 CMS `개발구현`·`착수`가 같은 레인(`top: 24px`)에 겹쳐 놓이고, YOS `프로젝트 정의`만 아래 레인(`top: 44px`)으로 내려간다.

## 검증

```bash
npx tsc --noEmit          # 통과 (출력 없음)
npm run lint              # 통과 (출력 없음)
npm run build             # 성공 — /projects/my-tasks 정적 생성 포함 전체 라우트 빌드
npm run dev -- -p 3007    # 워크트리 포트 분리
```

dev 서버에서 실제 렌더 HTML을 받아 배치를 확인했다 (`master01` 로그인 후 `/projects/my-tasks`).

- 인라인 `top` 값 — W3: 배경 21 / 단계 24·24(동일 레인). W4: 배경 21·41, 단계 24·24(**CMS 두 단계 동일 레인**)·44(YOS). W5: 배경 21, 단계 24, 작업 칩 24·24·44
- `projectBg` 높이 전부 24px(= `LANE_PX + 4`) — 프로젝트당 1레인 확인
- DOM 순서 — `운영·유지보수`(span 2) → `통합테스트`(span 1), `개발구현`(span 6) → `착수`(span 3). 긴 막대가 먼저 나와 짧은 막대가 위에 겹친다

워크트리 환경 준비: `npm install`, `vercel link --yes --project y-os-core --scope project-hosting-center` → `vercel env pull .env.local`.

## 알려진 이슈 / 후속

- **`착수` 단계의 프로젝트 귀속** — 기존 W4 주석은 "YOS 착수"라고 적혀 있었으나 실제 데이터의 색은 BLUE(CMS)이고 CMS 배경 박스 안에 들어 있었다. 현재 렌더 결과(색·배경)를 바꾸지 않는 쪽을 택해 **색 기준으로 CMS에 귀속**시키고 주석을 데이터에 맞췄다. 자리표시 데이터라 도메인 확정 시 재확인이 필요하다.
- `CAL_OVERLAYS`는 여전히 Figma My Work Layout(147:495) 예시 값 재현이다. 내 작업/일정 도메인 DB 전환 시 데이터만 API 경계 흐름으로 교체하면 되고, 배치 모듈은 그대로 쓴다.
- 한 프로젝트에 단계가 많아 한 레인에 과하게 포개지는 경우의 가독성(라벨 잘림)은 이번 범위 밖이다. 실데이터 연결 후 재평가 대상.

## 사후 검증 결과 (추록)

푸시 이후에만 확정되는 검증 결과.

- **PR**: [#25](https://github.com/Y-ONE-soft/y-os-core/pull/25)
- **프리뷰 배포**: `● Ready` (36s) — https://y-os-core-hmsov52vw-project-hosting-center.vercel.app
- **PR 체크**: `Vercel` pass, `Vercel Preview Comments` pass

## 병렬 작업 메모

착수 시점 main = `a15947b` (PR #21 내 작업 백로그, PR #22 보드 높이 정합 머지 직후). 동시 진행 중이던 `로드맵-스크롤-연도-단계링크` 브랜치는 `src/components/features/projects/` 파일만 만지고 있어 `my-work/`와 겹치지 않음을 확인하고 시작했다.

작업 중 main이 `60b712d`까지 진행됐다 (PR #23 로드맵 가로 스크롤 → docs/28, PR #24 작업 티켓 프로젝트 선택 → docs/29). 머지 직전 최신 main으로 리베이스했고, **문서 번호는 선점된 28을 피해 30으로 조정**했다. main이 함께 만진 `my-work/` 파일은 `my-work-backlog.tsx` 하나뿐이고 이번 변경 대상(`my-work-data.ts`·`my-work-calendar.tsx`)과 겹치지 않아 충돌 없이 리베이스됐다.
