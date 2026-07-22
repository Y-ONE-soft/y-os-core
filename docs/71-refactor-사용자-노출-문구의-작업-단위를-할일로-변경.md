# refactor: 사용자 노출 문구의 작업 단위를 할일로 변경

## 작업 요약

제품에서 Task 엔티티를 가리키던 표현을 **"작업" → "할일"** 로 바꿨다. 이번 커밋은 **사용자에게 보이는 문구만** 대상으로 하며, 코드 식별자(`Task`/`task`)·DB 스키마·라우트 URL은 그대로 둔다.

11개 파일에서 24곳을 고쳤다.

## 범위를 이렇게 정한 이유

`작업`은 코드베이스에 100곳, `Task`/`task` 식별자는 305곳(27파일) 있었다. 전부 바꾸면 Prisma `model Task` 리네임 → 새 마이그레이션 → 라우트 URL 변경까지 번지는데, 세 가지 이유로 문구만 먼저 처리했다.

1. **DB 스키마 변경이 지금 불가능하다.** `프리셋-도메인-저장` 워크트리가 prisma를 건드리는 커밋 2개를 들고 있다. "DB 스키마 변경은 동시에 한 브랜치만" 규칙에 걸린다.
2. **식별자 리네임은 병렬 세션과 정면 충돌한다.** 305곳이 27파일에 퍼져 있고, 그중 다수를 다른 세션 5개가 동시에 수정 중이다.
3. **요청의 목적이 제품 용어 통일이다.** 사용자가 보는 단위 명칭을 바꾸는 것이 목적이라면 내부 식별자는 `task`로 남아도 무방하다.

식별자·DB·URL 변경은 별도 요청 사이클로 분리한다.

## 무엇을 바꾸지 않았나

**"작업"이 들어간다고 다 엔티티가 아니다.** 다음은 의도적으로 유지했다.

| 유지 대상 | 곳 | 이유 |
| --- | --- | --- |
| `작업자`, `공동 작업자` | 9곳 | **사람**을 가리킨다. 협업자 지정 다이얼로그·요청 버튼 등 |
| `작업 현황`, `작업 분석` | 6곳 | 페이지명. 사용자 확인을 거쳐 유지하기로 했다. 프로젝트·단계 로드맵이 중심인 화면이라 할일만 보여주는 곳이 아니고, "업무 현황"이라는 일반적 의미로 읽힌다 |
| `"작업 내용, 요구사항, 진행 메모 등을 자세히 작성하세요…"` | 3곳 | 설명 textarea placeholder. **단계 추가·단계 상세·할일 상세에 같은 문구가 공유**된다. 단계에도 쓰이므로 엔티티 지칭이 아니라 "업무 내용"이라는 일반어이며, 할일 쪽만 바꾸면 세 화면 문구가 어긋난다 |

## 표기 통일 — `할일` (붙여쓰기)

코드에 이미 `할일`이 26곳, `할 일`(띄어쓰기)이 3곳 있었다. 다수를 따라 **붙여쓰기로 통일**했다. 사용자에게 보이던 `할 일`은 [`task-detail-overlay.tsx`](../src/components/features/projects/task-detail-overlay.tsx)의 엔티티 타입 배지 한 곳뿐이라 이번에 함께 고쳤다.

(남은 `할 일` 2곳은 `overlay-breadcrumb.tsx`의 주석이며 다음 커밋에서 처리한다.)

## 변경 내역 (24곳 / 11파일)

| 파일 | 변경 |
| --- | --- |
| [`app/(main)/projects/my-tasks/page.tsx`](../src/app/(main)/projects/my-tasks/page.tsx) | `metadata.title` 내 작업 → 내 할일 |
| [`components/layout/projects-nav.tsx`](../src/components/layout/projects-nav.tsx) | 네비 라벨 `내 작업` → `내 할일` / 초기화 경고 `프로젝트·단계·작업이` → `할일이` |
| [`my-work/my-work-page.tsx`](../src/components/features/my-work/my-work-page.tsx) | `<h1>내 할일`, `aria-label="내 할일 뷰 전환"`, 도움말 `‘내 할일’과 독립` |
| [`my-work/my-work-backlog.tsx`](../src/components/features/my-work/my-work-backlog.tsx) | placeholder `＋ 할일 이름 입력 후 Enter`, `aria-label="백로그 할일 추가"`, 메뉴 `할일 삭제` |
| [`my-work/my-work-data.ts`](../src/components/features/my-work/my-work-data.ts) | 알림 `할일 할당 요청`, 본문 `"회의1" 할일을 할당했어요` |
| [`projects/project-backlog.tsx`](../src/components/features/projects/project-backlog.tsx) | 위 백로그와 동일 3곳 |
| [`projects/project-board.tsx`](../src/components/features/projects/project-board.tsx) | 메뉴 `할일 삭제`, placeholder `할일명 입력 후 Enter`, `aria-label={\`${stage.name} 할일 추가\`}`, 추가 버튼 `＋ 할일` |
| [`projects/project-detail-page.tsx`](../src/components/features/projects/project-detail-page.tsx) | 탭 `"작업"` → `"할일"` |
| [`projects/task-detail-overlay.tsx`](../src/components/features/projects/task-detail-overlay.tsx) | 타입 배지 `할 일` → `할일`, `할일 유형`, `할일 삭제` |
| [`projects/stage-detail-overlay.tsx`](../src/components/features/projects/stage-detail-overlay.tsx) | 힌트 `단계 산출물은 할일에 첨부합니다` |
| [`projects/task-status-page.tsx`](../src/components/features/projects/task-status-page.tsx) | 요약 `{taskCount}개 할일` |

## 검증

**탭 라벨이 로직 키로 쓰이는지 확인했다.** `project-detail-page.tsx`의 `TABS` 배열에서 `"작업"`을 `"할일"`로 바꿨는데, 이 값이 조건 분기에 쓰이면 화면이 깨진다. 확인 결과 `TABS`는 렌더용 `map`에만 쓰이고 활성 탭 상수는 `ACTIVE_TAB = "보드"`로 이번 변경과 무관하다. 저장소 전체에서 `"작업"`·`"할일"` 문자열 비교도 없다.

| 항목 | 결과 |
| --- | --- |
| `npm run lint` | 통과 |
| `npx tsc --noEmit` | 통과 |
| `npm run build` | 통과 |

문구 교체라 로직 영향은 없다. 화면 육안 확인은 프리뷰가 SSO로 막히는 환경이라 머지 후 프로덕션에서 하고, 결과는 "사후 검증 결과 (추록)"으로 보완한다.

## 알려진 이슈

- **라우트 URL은 `/projects/my-tasks` 그대로다.** 네비 라벨은 "내 할일"인데 주소는 `my-tasks`라 불일치가 남는다. URL 변경은 `[projectId]` 동적 라우트의 `RESERVED_SLUGS`와 함께 고쳐야 하므로(빠뜨리면 `/projects/my-tasks`가 프로젝트 상세로 먹힌다) 이번 범위에서 제외했다.
- **API 경로도 `/api/admin/tasks` 그대로다.** 사용자에게 노출되지 않아 우선순위가 낮다.
- `context-nav.tsx`에 `/tasks`를 가리키는 네비 항목이 있으나 대응하는 라우트 디렉터리가 없는 **기존 죽은 링크**다. 이번 변경과 무관해 손대지 않았다.

## 병렬 작업 메모

- 베이스 `1fd4a65`(PR #62 `작업-칩-할일-고정` 머지 직후). 공교롭게 같은 용어를 다루는 브랜치였으나 그쪽은 칩 라벨 고정이 목적이고 이미 머지돼 충돌 요인이 사라졌다.
- 다음 파일은 다른 세션이 동시에 수정 중이라 리베이스가 필요할 수 있다: `projects-nav.tsx`(프로젝트-색-체계-통일), `stage-add-overlay.tsx`(단계-작업-상세-화면-일치). 모두 문자열 단위 변경이라 충돌해도 해소가 어렵지 않다.
- 스키마·마이그레이션 변경 없음.
- 문서 번호: 작성 시점 main 최대가 70이라 71을 썼다. 이 저장소는 번호 충돌이 잦아 머지 직전 재확인이 필요하다.
