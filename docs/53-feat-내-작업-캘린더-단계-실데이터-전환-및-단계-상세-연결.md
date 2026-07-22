# 53. feat: 내 작업 캘린더 단계 실데이터 전환 및 단계 상세 연결

## 작업 요약

내 작업 페이지(`/projects/my-tasks`) 월 캘린더를 **Figma 자리표시 상수에서 실데이터로 전환**하고, 단계 막대를 클릭하면 단계 상세 오버레이가 열리도록 연결했다.

- 월 그리드를 실제 날짜로 생성 (하드코딩된 2026년 7월 배열 제거)
- 내 프로젝트의 단계를 `startDate`/`endDate`로 매핑
- 단계 막대 클릭 → `StageDetailOverlay`
- 이전 달·다음 달·오늘 버튼 동작

배치 규칙(프로젝트 박스, 단계 한 줄, 최소 2줄, 주 경계 연속)은 그대로 재사용했다. **데이터 출처만 바뀌었다.**

## 태스크 통합에 대해

분해안에서는 태스크 2개(① 실데이터 전환 ② 클릭 연결)로 잡았으나 **하나의 커밋으로 합쳤다.**
클릭 연결의 실제 변경분은 단계 막대를 `div` → `button`으로 바꾸고 핸들러를 올려보내는 정도라, ①에서 `div`로 새로 쓴 뒤 ②에서 곧바로 `button`으로 고치는 형태가 된다. 같은 줄을 두 번 쓰는 커밋 분리가 히스토리에 주는 이점이 없다고 판단했다.

## 배경

캘린더는 `my-work-data.ts`의 자리표시 상수를 그렸다. `WEEKS`·`TODAY_DATE`·`CAL_TITLE`이 2026년 7월로 하드코딩돼 있었고, 프로젝트 키가 `"CMS"`/`"YOS"`/`"YOC"` 문자열이라 **실제 `Project.id`와 연결 고리가 없었다.**

`StageDetailOverlay`는 `projectId`·`stageId`를 받아 스스로 데이터를 다시 읽는 구조라, 클릭을 붙이려면 캘린더가 실 id를 들고 있어야 했다. 즉 **클릭 연결의 선행 조건이 실데이터 전환**이었다.

## 변경 내용

### 1. 월 그리드 — `my-work-month.ts` (신규)

`buildMonthGrid(base, today)`가 실제 날짜로 주 배열을 만든다.

- 첫 주 일요일부터 채우고 달 밖은 `null`(이월 칸)
- 주 수 = `ceil((첫날 요일 + 말일) / 7)`
- `todayDate`는 보고 있는 달에 오늘이 있을 때만 채운다
- `gridStart`(그리드 첫 칸 날짜)를 함께 넘겨 날짜 → 칸 변환 기준으로 쓴다

날짜는 DB와 같은 `YYYY-MM-DD` 문자열로만 다루고 `roadmap-utils`의 `toISO`/`addDays`/`dayOffset`을 재사용한다. 그 파일 주석대로 **UTC 파싱이 끼면 하루씩 밀리기 때문**이다.

2026년 7월로 검증한 결과가 기존 하드코딩 배열과 정확히 일치했다 — `[[null,null,null,1,2,3,4], …]`, 5주.

### 2. 오버레이 생성 — `my-work-calendar-source.ts` (신규)

워크스페이스 트리에서 캘린더 오버레이를 만든다.

- 단계마다 `startDate` 기준으로 그리드 일자를 구하고, **주 단위로 잘라 조각**을 만든다. 배치 모듈이 주별 `{ week, col, span }`을 전제로 하기 때문이고, 조각들은 같은 `stageId`를 갖는다
- 종료일 없는 진행형 단계는 로드맵과 같은 `OPEN_ENDED_DAYS`(5일) 길이로 표시
- 그리드 밖 단계는 건너뛴다
- 마감 배지는 **실제 종료일이 든 조각에만** 붙인다 (주 경계에서 잘린 조각에는 안 붙음)
- `count`는 그 단계의 작업 수
- 막대 색은 `stage.color`, 프로젝트 박스 색은 `project.color` — 작업 현황 로드맵과 같은 규칙

### 3. 배치 모듈 — `my-work-calendar-layout.ts`

- 모듈 로드 시점의 상수 계산 → **`buildWeekLayouts(overlays, weekCount)` 함수**로 전환
- `CalOverlay` 타입을 이 모듈로 옮기고 실 id를 싣는다 — `project`(= `Project.id`), `stageId`, `color`
- 할일 칩 종류(`kind: "task"`)는 **타입·배치·렌더 경로를 모두 남겨뒀다.** `Task`에 예정일이 생기면 소스에서 만들기만 하면 된다
- `PROJECT_BOX_LABELS` 제거 — 박스 라벨은 프로젝트 이름을 쓴다

배치 규칙 7개는 그대로다.

### 4. 캘린더 — `my-work-calendar.tsx`

- `"use client"` + props 기반으로 전환 (`grid`, `layouts`, `projects`, `onOpenStage`)
- **단계 막대가 `button`** — 클릭 시 `onOpenStage(projectId, stageId)`, 호버 링·포커스 링, `title`로 전체 이름 표시
- 프로젝트 박스가 프로젝트 이름을 라벨로 쓰되 **범위가 시작하는 주에만** 표시 (주마다 반복하지 않음)
- `shade()` 추가 — 막대 위 글자색. 배경 틴트(0.18)가 옅어 원색 그대로는 대비가 모자란다
- `WEEKDAYS`를 이 파일 상수로 (자리표시 데이터 파일에서 분리)

### 5. 패널 — `my-work-calendar-panel.tsx` (신규)

클라이언트 경계를 페이지가 아니라 캘린더 영역에 둔다 (`Server Component가 기본` 규약).

- `useSession`·`useProjectStore`·`useBoardState`로 데이터를 읽는다
- **"내 작업" 기준은 `project.ownerId === user.id`** — `task-status-page`·`projects-nav`와 같은 판정
- 월 상태(`monthAnchor`)를 들고 이전/다음/오늘 버튼을 실제로 동작시킨다
- 헤더의 "이 달 N건"이 실제 단계 수
- `StageDetailOverlay`를 여기서 연다 (`task-status-page`와 같은 구조)

### 6. 페이지·데이터 정리

- `my-work-page.tsx` — 월 헤더 마크업을 패널로 옮기고 `<MyWorkCalendarPanel />` 하나로 대체. 서버 컴포넌트 유지
- `my-work-data.ts` — 캘린더 자리표시(`CAL_TITLE`·`CAL_MONTH_COUNT`·`WEEKDAYS`·`TODAY_DATE`·`WEEKS`·`CAL_OVERLAYS`·`PROJECTS`·`PROJECT_BOX_LABELS`) **전부 삭제**. 아직 자리표시인 `REQUESTS`만 남겼다

**자리표시 할일 칩은 제거했다.** 진짜 날짜 위에 가짜 칩을 얹으면 잘못된 정보가 된다.

## 검증

```bash
npx prisma generate
npx tsc --noEmit          # 통과 (출력 없음)
npm run lint              # 통과 (출력 없음)
npm run build             # 성공 — Compiled successfully, 정적 페이지 17/17
npm run dev -- -p 3024
```

### 개발 DB 실데이터로 계산 계층 검증

캘린더가 클라이언트에서 데이터를 받아 그리므로 SSR HTML로는 막대를 볼 수 없다. `tsx`로 **실제 워크스페이스 응답을 넣고 계산 계층을 직접 돌렸다** (임시 스크립트, 커밋하지 않음).

검증 전 개발 DB 상태가 문제였다 — 프로젝트 1개(`Y.OS core`, 소유자 `step01`), 단계 2개, **`startDate`를 가진 단계 0개**. 직전에 머지된 `시드-데이터-정리`(PR #43)로 시드가 그룹 골격만 남은 상태였다. 사용자 승인을 받아 기존 단계 2개에 날짜를 넣고 검증했다.

| 단계 | 날짜 |
| --- | --- |
| 프로젝트 정의 | 2026-07-06 ~ 07-17 |
| 서비스 시스템 설계 | 2026-07-15 ~ 07-28 |

결과:

```
월: 2026년 7월 | 주 수: 5 | 오늘: 22    ← 그리드 시작 2026-06-28
주 배열: [[null,null,null,1,2,3,4], …]   ← 기존 하드코딩과 일치
내 프로젝트: [ 'Y.OS core' ]              ← ownerId 필터 동작
이 달 단계 수: 2

오버레이 조각
  W1 col1 span6  프로젝트 정의
  W2 col0 span6  프로젝트 정의  [마감]
  W2 col3 span4  서비스 시스템 설계
  W3 col0 span7  서비스 시스템 설계
  W4 col0 span3  서비스 시스템 설계  [마감]

주별 배치
  W1  박스 col1 span6 lane0 lanes2 이어짐▶            막대 lane0 프로젝트 정의
  W2  박스 col0 span7 lane0 lanes2 ◀이어짐 이어짐▶    막대 lane0 프로젝트 정의 / lane0 서비스 시스템 설계
  W3  박스 col0 span7 lane0 lanes2 ◀이어짐 이어짐▶    막대 lane0 서비스 시스템 설계
  W4  박스 col0 span3 lane0 lanes2 ◀이어짐            막대 lane0 서비스 시스템 설계
```

확인된 것:

- **주 경계 분할** — 두 단계 모두 주마다 조각으로 나뉘고, 마감 배지는 실제 종료일 조각에만 붙음
- **단계 한 줄** — W2에서 기간이 겹치는 두 단계가 모두 `lane0`
- **박스 연속** — W1~W4에 걸쳐 한 프로젝트 범위가 이어짐(`◀이어짐`/`이어짐▶`)
- **박스 최소 2줄** — 모든 주에서 `lanes2`
- **소유자 필터** — `step01`로 `Y.OS core` 1건

페이지 로드는 `step01` 로그인 후 `/projects/my-tasks` 200, 헤더에 `2026년 7월` 표기 확인.

## 알려진 이슈 / 후속

- **브라우저에서의 클릭 동작은 미검증이다.** 저장소에 브라우저 자동화 도구가 없어 계산 계층과 SSR 응답까지만 확인했다. 클릭 경로 자체는 `button` → `onOpenStage` → `setDetailStage` → `StageDetailOverlay`로, `task-status-page`가 쓰는 것과 같은 구조다.
- **할일 칩은 아직 없다.** 이번 작업 도중 예정일 모델이 머지됐다(docs/49~51). 이제 `Task`에 예정일이 있으므로 다음 사이클에서 `my-work-calendar-source.ts`에 할일 조각 생성을 더하면 된다. 배치·렌더 경로는 이미 남겨뒀다.
- **백로그와 기준이 다르다.** 같은 페이지의 `my-work-backlog`는 필터 없이 전 프로젝트 백로그를 보여준다. 캘린더만 `ownerId` 기준이라 둘이 어긋난다. 사용자 판단으로 캘린더는 소유자 기준을 유지했고, 백로그 정리는 별도 과제로 둔다.
- **개발 DB에 넣은 단계 날짜는 남겨뒀다.** 지우면 캘린더가 다시 빈 화면이 되고, 로드맵 드래그 작업 중인 세션에도 날짜 있는 단계가 필요하다.
- 기간 세그먼트(기간/시작일/종료일)와 상단 필터 칩은 여전히 동작 없는 자리표시다.

## 사후 검증 결과 (추록)

푸시 이후에만 확정되는 검증 결과.

- **PR**: [#49](https://github.com/Y-ONE-soft/y-os-core/pull/49)
- **프리뷰 배포**: `● Ready` — https://y-os-core-b5uzom1e8-project-hosting-center.vercel.app
- **PR 체크**: `Vercel` pass, `Vercel Preview Comments` pass

## 병렬 작업 메모

착수 시점 main = `e731c00`. 진행 중 main이 크게 움직였다(docs 49~52 — 작업 미배정·예정일 모델, 백로그 미배정, 단계 지정 시 예정일 자동 계산, tailwind 스캔 범위). 이번 변경은 `my-work/` 캘린더 파일에 한정되고 그 작업들과 파일이 겹치지 않는다.

포트 충돌 주의: dev 서버를 3011로 띄웠을 때 **다른 세션이 이미 그 포트를 쓰고 있어** 내 서버가 뜨지 못한 채 남의 서버 응답을 받았다. `EADDRINUSE`를 확인하고 3024로 옮겨 재검증했다. 워크트리가 7개 이상 도는 상황에서는 포트 확인이 필요하다.

문서 번호는 착수 시점 기준 52까지 사용되어 53으로 잡았다.
