# chore: 코드 주석의 작업 단위 표기를 할일로 통일

## 작업 요약

docs/71에서 사용자 노출 문구를 "작업 → 할일"로 바꾼 데 이어, **코드 주석·JSDoc에 남아 있던 표기**를 같은 기준으로 통일했다. 22개 파일에서 45줄을 고쳤다.

주석만 바뀌므로 **런타임 동작 변경은 없다.**

## 왜 주석까지 바꾸나

문구만 바꾸고 주석을 두면 같은 개념을 두 이름으로 부르게 된다. 이 저장소는 주석이 "왜 이렇게 했는가"를 설명하는 밀도가 높아(예: `service.ts`의 단계 삭제 순서 경고) 용어가 갈리면 읽는 사람이 **다른 개념으로 오해**할 여지가 있다. 특히 `할일`은 이미 캘린더·로드맵 계층 주석에서 쓰이고 있어, 그대로 두면 "작업"과 "할일"이 같은 파일 안에서 섞였다.

## 치환 방식과 보호 대상

일괄 치환하되, **"작업"이 들어가도 엔티티가 아닌 표현 5종을 토큰으로 보호**한 뒤 복원했다.

| 보호 대상 | 의미 | 잔존 |
| --- | --- | --- |
| `작업자` / `공동 작업자` | 사람 | 유지 |
| `작업 현황` | 페이지명 | 유지 |
| `작업 분석` | 페이지명 | 유지 |
| `작업 내용` | 설명 placeholder(단계 화면과 공유하는 일반어) | 유지 |
| `작업 결과` | `작업 결과 문서` — 저장소 워크플로우 용어 | 유지 |

치환 후 보호 대상 **37곳이 그대로 남아 있음**을 확인했고, 보호 대상을 제외한 `작업`은 `src/`·`prisma/`에 **0건**이다.

`작업 결과`를 보호 목록에 넣은 것이 특히 중요했다. [`globals.css`](../src/app/globals.css)의 주석이 "docs/의 작업 결과 문서는 산문에 클래스명을 적는다"는 내용인데, 이건 이 저장소의 문서 규칙을 가리키는 말이지 Task 엔티티가 아니다.

## 표기 통일 — `할 일` → `할일`

[`overlay-breadcrumb.tsx`](../src/components/features/projects/overlay-breadcrumb.tsx)에 남아 있던 띄어쓰기 변형 2곳(`// 할 일은 "프로젝트 › 단계 › 할 일"로 …`)을 붙여쓰기로 맞췄다. 이로써 저장소 전체에 `할 일`은 **0건**이다.

## 변경 파일 (22개 / 45줄)

**my-work** — `my-work-backlog.tsx`, `my-work-calendar-layout.ts`, `my-work-calendar-panel.tsx`, `my-work-calendar-source.ts`, `my-work-data.ts`, `my-work-month.ts`
**projects** — `board-store.tsx`, `overlay-breadcrumb.tsx`, `project-backlog.tsx`, `project-board.tsx`, `roadmap-bar.tsx`, `roadmap-utils.ts`, `stage-add-overlay.tsx`, `stage-detail-overlay.tsx`, `task-detail-overlay.tsx`, `task-drag.ts`
**layout / server / types / api** — `projects-nav.tsx`, `seed-data.ts`, `service.ts`, `workspace.ts`(types), `api/admin/tasks/route.ts`
**prisma** — `schema.prisma`

주석 밀도가 높은 곳: `board-store.tsx`(8줄), `service.ts`(7줄), `task-detail-overlay.tsx`(4줄).

## `prisma/schema.prisma` 변경에 대해 — 스키마 변경 아님

이 커밋은 `prisma/schema.prisma`를 **한 줄** 건드린다.

```diff
-  projectId     String? // null = 미배정 (내 작업에서 만든 직후 상태)
+  projectId     String? // null = 미배정 (내 할일에서 만든 직후 상태)
```

**주석뿐이며 모델·필드·인덱스·관계는 그대로다.** 따라서 마이그레이션이 필요 없고, "DB 스키마 변경은 동시에 한 브랜치만" 규칙에도 걸리지 않는다. 다만 다른 세션이 `prisma/` 변경 여부로 스키마 작업 브랜치를 판별하는 관행이 있으므로, **이 브랜치는 스키마를 만지지 않는다**는 점을 여기에 명시해 둔다.

## 검증

| 항목 | 결과 |
| --- | --- |
| 보호 대상 잔존 | 37곳 유지 확인 |
| 보호 대상 외 `작업` 잔존 | **0건** (`src/`, `prisma/`) |
| `할 일`(띄어쓰기) 잔존 | **0건** |
| 코드(비주석) 라인 변경 | **0건** — diff의 추가 라인이 전부 주석·문자열임을 확인 |
| `npm run lint` | 통과 |
| `npx tsc --noEmit` | 통과 |
| `npm run build` | 통과 |

## 알려진 이슈

- **`types/workspace.ts`의 `"작업날짜"` → `"할일날짜"`.** 이 주석은 `scheduledDate` 필드를 두고 *화면 표기가 "작업날짜"* 라고 적고 있으나, 실제로 그런 문자열은 `src/` 어디에도 없다. 디자인 시안의 라벨을 옮겨 적은 것으로 보이며, 코드 기준으로는 **이미 어긋난 주석**이었다. 용어 통일 취지에 맞춰 함께 바꿨지만, 시안 쪽 라벨이 여전히 "작업날짜"라면 시안과 주석이 어긋난다. 확인이 필요하다.
- **코드 식별자는 여전히 `task`/`Task`다.** 주석은 "할일"이라 부르고 식별자는 `task`인 상태가 남는다. 의도된 범위 분리이며(docs/71 참조), 식별자·DB·URL 리네임은 별도 요청 사이클로 다룬다.

## 병렬 작업 메모

- docs/71과 같은 브랜치의 두 번째 커밋이다. 베이스 `1fd4a65`.
- 건드린 파일이 22개로 넓어 다른 세션과 리베이스 충돌 가능성이 있다. 다만 전부 **주석 한 줄 단위 치환**이라 충돌해도 해소가 단순하다.
- 스키마·마이그레이션 변경 없음 (위 절 참조).
- 문서 번호: 작성 시점 main 최대가 70이라 71~72를 썼다. 이 저장소는 번호 충돌이 잦아 머지 직전 재확인이 필요하다.

## 리베이스 중 유입분 추가 정리 (추록)

최신 main으로 리베이스하는 과정에서 **다른 세션이 그 사이 작성한 코드에 "작업" 표기가 9곳 새로 들어왔다.** 같은 기준으로 함께 정리했다.

- **UI 문자열 1곳** — [`stage-add-overlay.tsx`](../src/components/features/projects/stage-add-overlay.tsx) `단계를 만든 뒤 작업에 첨부할 수 있습니다` → `할일에 첨부할 수 있습니다`. 사용자에게 보이는 문구이므로 놓쳤다면 화면에 용어가 섞였을 것이다.
- **주석 8곳** — `my-work-calendar-panel.tsx`(2), `my-work-calendar-source.ts`(3), `my-work-calendar.tsx`(2), `project-backlog.tsx`(1)

### 충돌 하나 — 내용은 main, 용어는 이쪽

[`my-work-calendar-source.ts`](../src/components/features/my-work/my-work-calendar-source.ts)에서 충돌이 났다. 같은 줄의 주석을 양쪽이 다르게 고쳤기 때문이다.

| 출처 | 내용 |
| --- | --- |
| main | `// 백로그 작업도 날짜 칸에 떨어뜨리면 예정일을 가질 수 있다 (덮는 단계가 없을 때)` |
| 이 브랜치 | `// 백로그 할일에는 예정일이 없지만(단계를 벗어나면 해제) 방어적으로 함께 훑는다` |

**main 쪽이 옳다.** 그 사이 백로그 할일에 예정일을 줄 수 있게 동작이 바뀌었고, 이쪽 문장은 옛 동작 설명이다. 그래서 **main의 내용을 취하고 용어만 할일로 바꿔** 해소했다.

```
// 백로그 할일도 날짜 칸에 떨어뜨리면 예정일을 가질 수 있다 (덮는 단계가 없을 때)
```

용어 통일 작업에서 충돌이 나면 기계적으로 자기 쪽을 택하기 쉬운데, 그랬다면 **틀린 설명을 되살릴 뻔했다.** 충돌 해소 시 상대 변경이 단순 표기인지 의미 변경인지 확인이 필요하다.

리베이스 후 재확인: 보호 대상 외 `작업` **0건**, `할 일`(띄어쓰기) **0건**, lint·tsc·build 통과.
