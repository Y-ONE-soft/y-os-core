# feat: 알림 페이지 추가 및 요청 카드 공용 컴포넌트 추출

## 작업 요약

`/notifications` 알림 페이지를 새로 만들고, 내 할일의 "요청 알림" 띠가 쓰던 요청 카드를 공용 컴포넌트로 빼내 두 화면이 같은 카드를 쓰도록 했다.

아바타 드롭다운의 "알림" 항목은 클릭해도 아무 동작이 없는 자리표시였고, 옆 배지는 `NOTIFICATION_COUNT = 2`로 하드코딩돼 실제 건수와 무관하게 항상 2를 표시하고 있었다. 이 태스크는 그 항목이 도착할 **실제 페이지**를 만든다. 드롭다운 연결과 배지 실데이터화는 다음 태스크에서 한다.

## 조사 결과 — 알림 도메인은 이미 있었다 (이름만 다름)

작업 전 도메인 현황을 조사한 결과, **새 모델·API·마이그레이션이 필요 없다**는 결론이 나왔다.

`Request` 모델(`prisma/schema.prisma:157`)과 `WorkRequest` 타입(`src/types/requests.ts:18`)이 이미 알림에 필요한 모든 축을 갖고 있다.

| 알림에 필요한 것 | 이미 있는 것 |
|---|---|
| 누가 → 누구에게 | `fromUserId` / `toUserId`, 서비스가 `direction`을 뷰어 기준으로 계산 (`server/requests/service.ts:46`) |
| 무엇에 대해 | `taskId` / `stageId` 중 하나 + `target{type,id,name,projectName}` |
| 언제 | `createdAt`, `respondedAt` |
| 종류 | `kind` — `ASSIGN`(할일 요청) / `HELP`(도움 요청) |
| 처리 상태 | `status` — `PENDING`/`ACCEPTED`/`REJECTED`/`CANCELED` |
| 조회 | `GET /api/admin/requests` → `listRequestsForUser` (보낸 것·받은 것 모두) |
| 처리 | `PATCH /api/admin/requests/[requestId]` (수락·거절·취소) |
| 클라이언트 상태 | `useRequests()` — 모듈 수준 스토어 + `useSyncExternalStore` |

따라서 알림 페이지는 **같은 스토어를 보는 두 번째 뷰**다. 한쪽에서 수락하면 다른 쪽도 함께 갱신된다.

`@@index([toUserId, status])`(`schema.prisma:177`)가 "내가 받은 대기 중 요청" 질의와 정확히 일치해, 배지·목록 조회에 추가 인덱스도 필요 없다.

## 변경 내용

### 1. `src/components/features/requests/request-card.tsx` (신규)

`my-work-requests.tsx` 안에 있던 `RequestCard`와 라벨 상수(`KIND_LABEL`, `STATUS_LABEL`), `formatDate`를 그대로 옮겼다. **마크업·스타일은 동일**하고 두 가지만 바꿨다.

- `className` prop을 받아 `cn()`으로 합친다 — 바깥 크기를 호출하는 쪽이 정한다.
- 원본에 붙어 있던 `flex-1`을 카드에서 뺐다. 가로 띠에서는 칸을 채우려고 `flex-1`이 필요하지만, 세로 목록(`flex-col`)에서 `flex-1`은 카드가 세로로 늘어나 버린다. 그래서 띠 쪽에서 `className="flex-1"`로 넘긴다.

`KIND_LABEL` / `STATUS_LABEL`은 export로 열어뒀다 — 앞으로 필터·요약 등에서 같은 라벨이 필요할 수 있다.

### 2. `src/components/features/requests/notification-list-page.tsx` (신규)

```
방향 필터(받은/보낸/전체) → 대기 우선 + 최신순 정렬 → RequestCard 세로 목록
```

- **기본 탭은 "받은 요청"** — 배지가 세는 것과 같은 "내가 처리해야 할 것"이 기본 관심사다.
- **탭마다 건수를 함께 표시**한다. 기본 탭이 비어 있을 때 다른 탭에도 아무것도 없다고 오해하지 않도록.
- 정렬은 대기 중 먼저, 그 안에서 최신순. `createdAt`이 ISO 문자열이라 `localeCompare`로 충분하다.
- 헤더 설명문은 대기 건수가 있으면 `처리를 기다리는 요청이 N건 있습니다`, 없으면 일반 설명으로 바뀐다.
- 빈 상태 문구를 탭별로 다르게 뒀다. 특히 "보낸 요청"이 비면 **어디서 보내는지**(단계·할일 상세)를 알려준다.

탭은 새 shadcn 컴포넌트를 추가하지 않고 `aria-pressed` 버튼 그룹으로 만들었다. 저장소에 Tabs·ToggleGroup 선례가 없고, 가벼운 서비스가 목표라 의존성을 늘리지 않았다. 활성/비활성 스타일은 사이드바 내비 항목(`projects-nav.tsx:250-256`)의 토큰을 따랐다.

로딩·에러·빈 상태는 프리셋 페이지(`preset-list-page.tsx:275-313`) 규약을 따랐다. 단 데이터 로딩은 `useRequests()` 스토어가 담당하므로 페이지에서 `useEffect` + `fetch`를 다시 만들지 않았다. 에러 문구가 따로 없는 것도 그 스토어를 따른 것이다 — `use-requests.ts:44-49`가 조회 실패를 "빈 목록"으로 흡수한다(알려진 이슈에 기록).

### 3. `src/app/(main)/notifications/page.tsx` (신규)

`me/page.tsx`·`presets/page.tsx`와 동일한 얇은 라우트 셸. `metadata.title = "알림 — Y.OS Core"`, 기본 export는 `NotificationsRoute`.

전역 헤더(아바타 드롭다운)에서 들어오는 화면이라 프로젝트 영역이 아닌 `(main)` 최상위에 뒀다 — `/me`와 같은 층위다.

### 4. `src/components/features/my-work/my-work-requests.tsx` (수정)

- 자체 `RequestCard` 정의(약 100줄)를 지우고 공용 컴포넌트를 import.
- 제목 옆에 **"전체 보기" 링크**를 추가해 `/notifications`로 보낸다. 이 띠는 가로 스크롤이라 건수가 늘면 훑기 어렵다.
- 정렬·건수 계산 등 나머지 동작은 그대로.

## 검증

### 빌드 · 린트

```bash
npm run lint    # 통과 (출력 없음)
npm run build   # ✓ Compiled successfully, 23/23 pages, ○ /notifications 등록 확인
```

### 실제 화면 (프로덕션 빌드 + 헤드리스 Chrome)

`npm run build && npm start -p 3018`로 프로덕션 서버를 띄우고, 실제 로그인 폼을 통과해 화면을 몰아봤다.

**데이터가 있을 때** — 검증용 요청 3건(받은 2·보낸 1)을 만들어 확인:

```
h1: 알림
desc: 처리를 기다리는 요청이 2건 있습니다
초기(받은)      tabs: 받은 요청2*  보낸 요청1   전체3   | cards: 2
보낸 요청 클릭   tabs: 받은 요청2   보낸 요청1*  전체3   | cards: 1
전체 클릭       tabs: 받은 요청2   보낸 요청1   전체3*  | cards: 3
받은 요청 복귀   tabs: 받은 요청2*  보낸 요청1   전체3   | cards: 2
```

**수락 동작** — 카드의 "수락"을 눌러 `PATCH /api/admin/requests/rq-79ba…` **200** 확인, 카드가 `수락/거절` 버튼에서 `수락됨` 배지로 바뀌는 것까지 확인.

**빈 상태** — 검증 데이터를 지운 뒤 탭별로:

```
받은     → 받은 요청이 없습니다.
보낸 요청 → 보낸 요청이 없습니다. 단계·할일 상세에서 공동 작업자 지정이나 도움 요청을 보낼 수 있습니다.
전체     → 주고받은 요청이 없습니다.
```

**내 할일 띠** — `/projects/my-tasks`에서 `요청 알림 · 0` 옆 "전체 보기" 링크가 `/notifications`로 걸린 것과, 공용 카드로 바꾼 뒤에도 띠 레이아웃이 유지되는 것을 확인.

**콘솔 에러** — `pageerror` 없음. 4xx는 `/tasks`·`/inbox`·`/wiki`·`/customers`·`/reset-password`의 프리페치 404 6건뿐인데, **이번 작업과 무관한 기존 결함**이다(사이드바에 링크만 있고 페이지가 없음).

### 검증 중 확인한 하네스 한계 (앱 결함 아님)

헤드리스 Chrome에서 CDP 마우스 이벤트(`page.mouse.click`, `elementHandle.click`)가 앱 셸 안쪽 요소에 전달되지 않았다. `document.elementsFromPoint`는 대상 버튼을 최상위로 반환하고 `body`/`html`의 `pointer-events`도 `auto`인데, document 캡처 단계에서조차 이벤트가 잡히지 않았다.

**기존 페이지 `/projects/my-tasks`에서도 동일하게 재현**되므로 이번 작업과 무관한 하네스 문제로 판단하고, 상호작용 검증은 DOM `click()`(실제 React 핸들러를 그대로 호출)으로 진행했다. 원인은 규명하지 못했다.

### 공유 개발 DB 원복

개발 DB는 전 세션이 공유하므로 검증 데이터를 **정확히 되돌렸다.**

- 만든 요청 id 3건을 파일로 남겨 그것만 `deleteMany`
- ASSIGN 요청을 수락하면 `applyAcceptedRequest`(`server/requests/service.ts:108`)가 대상 단계의 `requestedCollaborators`에 사용자를 넣는다. 이 **부수 효과도 되돌렸다**(단계 '서비스 시스템 설계'에서 해당 사용자 제거).
- 원복 후 확인: `Request` 행 0건, `requestedCollaborators`가 있는 단계 0건 — 검증 전 상태와 일치.
- `requestedCollaborators`는 `applyAcceptedRequest`에서만 기록되고 시드는 건드리지 않으므로, 검증 전 요청이 0건이었다는 점과 합쳐 원래 비어 있었음이 확인된다.

검증 스크립트(요청 생성·화면 구동·원복)는 모두 스크래치패드에 두었고 저장소에 넣지 않았다. `puppeteer-core`도 스크래치패드에만 설치해 `package.json`은 그대로다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `src/components/features/requests/request-card.tsx` | 신규 — 공용 요청 카드. `className` prop으로 바깥 크기를 위임, `flex-1` 제거 |
| `src/components/features/requests/notification-list-page.tsx` | 신규 — 알림 페이지 본체. 방향 필터·정렬·빈 상태 |
| `src/app/(main)/notifications/page.tsx` | 신규 — 라우트 셸, `metadata.title` |
| `src/components/features/my-work/my-work-requests.tsx` | 자체 카드 정의 제거 → 공용 컴포넌트 사용, "전체 보기" 링크 추가 |
| `docs/107-feat-알림-페이지-추가-및-요청-카드-공용-컴포넌트-추출.md` | 본 문서 (신규) |

새 모델·마이그레이션·API 라우트·의존성 **없음**. `prisma/`는 건드리지 않았다.

## 병렬 작업 확인

`git worktree list` · `gh pr list`로 확인 — 열린 PR 없음.

- `project-create-from-preset`가 `my-work-page.tsx`를 수정 중이나 `my-work-requests.tsx`는 건드리지 않아 충돌 없음.
- `board-select-style`, `my-info-spacing`, `status-calendar`는 이번 대상 파일에 미커밋 변경 없음.
- `prisma/` 변경이 없으므로 스키마 동시 변경 위험도 해당 없음.
- 문서 번호는 처음 96으로 잡았으나, 작업 중 main이 106번까지 진행돼 머지 직전 리베이스하면서 **107(본 문서)·108(다음 태스크)로 조정**했다. 병렬 번호 충돌 시 나중에 머지되는 쪽이 올린다는 규칙에 따른 것이다.

## 사용 버전

- Next.js 16.2.11 (App Router + Turbopack), React 19.2.4, TypeScript 5, Tailwind CSS v4
- Prisma 7.9.0 (`@prisma/adapter-pg` 드라이버 어댑터)
- 검증 도구: puppeteer-core (스크래치패드 전용), Chrome 헤드리스

## 알려진 이슈

- **읽음/안읽음 개념이 없다.** 알림 목록이지만 "확인함" 축이 없어 처리한 요청도 계속 목록에 남는다. docs/88·90이 의도적 생략으로 기록한 사항이라, 추가하려면 별도 결정이 필요하다.
- **폴링이 없다.** 새 요청은 페이지를 다시 열거나 다른 동작으로 스토어가 갱신돼야 보인다. `useRequests`의 기존 한계를 그대로 물려받았다.
- **조회 실패가 조용히 빈 목록이 된다.** `use-requests.ts:44-49`가 fetch 실패를 빈 배열로 흡수해, 알림 페이지에서도 "서버 오류"와 "요청 없음"이 구분되지 않는다. 스토어를 고쳐야 하는 문제라 이번 범위에 넣지 않았다.
- **처리 완료 요청이 무한히 쌓인다.** 보관·정리 정책이 없다. 건수가 늘면 알림 페이지에 페이지네이션이 필요해진다.
- **"요청 취소" 버튼이 `ghost` 변형이라 버튼으로 보이지 않는다.** 세로 목록에서는 그냥 텍스트처럼 읽힌다. 기존 카드 스타일을 그대로 옮긴 것이라 이번엔 바꾸지 않았다 — 바꾸면 내 할일 띠도 함께 바뀐다.
- 사이드바에는 알림 진입점을 추가하지 않았다. 진입점은 전역 헤더의 아바타 드롭다운(다음 태스크)과 내 할일의 "전체 보기" 두 곳이다.
