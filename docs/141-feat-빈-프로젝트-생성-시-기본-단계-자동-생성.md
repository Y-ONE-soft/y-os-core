# feat: 빈 프로젝트 생성 시 기본 단계 자동 생성

요청 사이클 `프로젝트-기본단계-프리셋-교체`의 1번 태스크.

## 배경

"프로젝트를 생성하면 날짜가 안 보여서 달력에 안 보인다"는 요청. 사이드바 인라인 생성(빈 생성, `createProject`)으로 만든 프로젝트는 **단계가 하나도 없어** 로드맵·캘린더에 아무것도 그려지지 않는다. 단계가 있어야 날짜 막대가 나오고, 날짜가 있어야 달력에 놓인다.

생성 다이얼로그의 두 모드(`preset` 적용, `even` 직접 만들기)는 이미 단계를 만들므로 이 문제가 없다. **빈 생성 경로에만** 기본 단계를 붙인다.

## 결정 사항 (사용자 승인)

| 항목 | 값 |
|---|---|
| 단계 이름 | **"프로젝트 생성"** |
| 기간 | **오늘~모레** (3일간 — `endDate` = 시작일 + 2일) |
| 적용 경로 | **빈 생성(`createProject`)만** — 다이얼로그 모드는 그대로 |

## 변경 내용

### 1. `src/server/workspace/service.ts` — `createProject`

프로젝트만 만들던 것을 **트랜잭션으로 프로젝트 + 기본 단계 1개**를 함께 만들도록 바꿨다.

```ts
const DEFAULT_STAGE_NAME = "프로젝트 생성";
const DEFAULT_STAGE_COLOR = "#3b82f6";
/** 오늘~모레(3일간) — endDate는 시작일 + 2일 */
const DEFAULT_STAGE_SPAN_DAYS = 2;

export async function createProject(input: {…}) {
  const start = todayISO();
  return db.$transaction(async (tx) => {
    const project = await tx.project.create({ data: input });
    await tx.stage.create({
      data: {
        id: `st-${crypto.randomUUID()}`,
        projectId: input.id,
        name: DEFAULT_STAGE_NAME,
        color: DEFAULT_STAGE_COLOR,
        startDate: start,
        endDate: addDaysISO(start, DEFAULT_STAGE_SPAN_DAYS),
        order: 1,
      },
    });
    return project;
  });
}
```

- **날짜는 서버 기준**(`todayISO()`). 완료날짜와 같은 규약 — 클라이언트 시계를 신뢰하지 않는다.
- **트랜잭션**으로 묶어, 단계 생성이 실패하면 프로젝트도 롤백된다. "프로젝트는 있는데 단계가 없는" 어중간한 상태를 막는다.
- `order: 1` — `@@unique([projectId, order])` 위반 없이 첫 단계.
- 단계 색은 상수(`#3b82f6`)를 넣지만, 보드 화면은 저장 색이 아니라 프로젝트 색에서 파생하므로 표시에는 프로젝트 색이 쓰인다(compose 주석의 `withDerivedColors`와 동일).

### 2. `src/components/features/projects/project-store.tsx` — 낙관적 업데이트

서버가 기본 단계를 함께 만드니, 낙관값도 같은 단계를 넣어야 새로고침 시 화면이 튀지 않는다.

```ts
boards: {
  ...prev.boards,
  [id]: {
    stages: [{
      id: `st-${crypto.randomUUID()}`,
      name: "프로젝트 생성",
      color,                       // 프로젝트 색 — 서버 파생 결과와 같다
      startDate: todayISO(),
      endDate: addDaysISO(todayISO(), 2),
      showDeadline: false,
      tasks: [],
    }],
    backlog: [],
  },
},
```

낙관 단계의 `id`는 임시값이라 서버 값과 다르지만, 다음 부트스트랩에서 서버 단계로 교체된다. 로드맵에 곧바로 막대가 뜨는 것이 목적이다.

`todayISO`는 `roadmap-utils`(클라이언트용), `addDaysISO`는 `@/lib/stage-plan`(서버·클라 공용 순수 모듈)에서 가져왔다.

## 검증

`npm run build` 성공, `npm run lint` 경고 0.

dev 서버(포트 3131)로 실제 생성 → 화면 확인까지 했다.

### API

```
빈 생성(createProject) 후 워크스페이스:
  단계 수: 1
  이름: 프로젝트 생성 | 시작: 2026-07-23 | 종료: 2026-07-25
  오늘(로컬): 2026-07-23
```

오늘(07-23)~모레(07-25), 단계 1개, 이름 정확.

### 화면 (헤드리스 브라우저)

프로젝트 상세 로드맵에 **"프로젝트 생성" 막대가 7/23~7/25 위치에 표시**되고, 보드에도 같은 이름의 컬럼(`07/23~07/25`)이 생겼다. 스크린샷으로 확인했다 — 요청의 핵심("달력에 보이도록")이 충족된다.

검증용 프로젝트는 태스크 2 검증에도 쓰므로 이 시점에는 남겨둔다.

## 변경 파일 내역

| 파일 | 구분 | 내용 |
|---|---|---|
| `src/server/workspace/service.ts` | 수정 | `createProject`를 트랜잭션으로, 기본 단계 함께 생성. `addDaysISO` import |
| `src/components/features/projects/project-store.tsx` | 수정 | 낙관적 업데이트에 기본 단계, `todayISO`·`addDaysISO` import |

## 알려진 이슈 / 주의점

### 서버·클라이언트가 각자 오늘을 계산한다

낙관값은 브라우저 로컬, 저장은 서버 로컬 기준이다. 자정 근처나 TZ가 다른 환경에서 하루 차이가 잠깐 보였다가 새로고침 시 서버 값으로 맞춰진다. `completedDate`·`scheduledDate`도 같은 축의 한계다. Vercel 런타임이 UTC라 **한국 시간 오전 9시 이전 생성은 기본 단계가 전날부터** 잡힌다 — 운영 전 TZ 정리 시 함께 다뤄야 한다.

### 기존 빈 프로젝트에는 소급 적용되지 않는다

이번 변경은 **앞으로 만드는** 프로젝트에만 기본 단계를 붙인다. 이미 단계 없이 만들어진 프로젝트는 그대로다. 그런 프로젝트에는 태스크 2(프리셋 교체) 또는 수동 단계 추가로 채우면 된다.

### 직접 만들기 직후 기본 단계와 공존 가능성

빈 생성(인라인)과 직접 만들기(다이얼로그)는 서로 다른 진입점이라 실사용에서 섞이지 않는다. 다만 인라인으로 만든 프로젝트(기본 단계 있음)에 다이얼로그의 "직접 만들기"를 다시 적용하면 단계가 공존할 수 있다 — 이 경우는 태스크 2의 프리셋 교체처럼 "비어 있어야 한다"는 제약이 걸려 실제로는 막힌다(다이얼로그는 새 프로젝트 생성 전용이라 기존 프로젝트에 다시 적용하는 경로가 없다).
