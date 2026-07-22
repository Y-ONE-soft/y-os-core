@AGENTS.md

# y-os-core

Next.js 16 + shadcn/ui 기반의 가볍고 빠른 웹 서비스.

## 기술 스택

- Next.js 16 (App Router + Turbopack), React 19, TypeScript 5, Tailwind CSS v4
- shadcn/ui — Radix UI 기반, `radix-nova` 스타일, neutral 베이스, CSS 변수 테마
- `src/` 디렉토리 구조, 경로 별칭 `@/*` → `./src/*`
- 컴포넌트 추가: `npx shadcn@latest add <이름>` → `src/components/ui/`에 복사됨

## 명령어

- `npm run dev` — 개발 서버 (localhost:3000)
- `npm run build` — 프로덕션 빌드
- `npm run lint` — ESLint

## 작업 워크플로우 (필수)

세션(에이전트) 1개 = 작업자 1개. 여러 작업자가 워크트리로 같은 저장소에서 병렬로 작업한다.
사용자는 작업을 러프하게 요청한다. **러프한 요청 1건 = 브랜치 1개 = PR 1개**(요청 사이클), 그 안의 **태스크 1개 = 커밋 1개 = 작업 결과 문서 1개**(태스크 사이클)로 진행한다.

### 요청 사이클 — 브랜치·PR 단위 (러프한 작업 흐름)

1. **태스크 분해** — 러프한 요청을 태스크로 나누고, 각 태스크에 예정 커밋 메시지를 붙인 분해안을 먼저 사용자에게 보여준다.
2. **브랜치 + 워크트리 생성** — main에서 직접 작업·커밋 금지. **브랜치명 = 한글 작업명** (공백은 하이픈, 예: `병렬-작업-환경-구성`).
   - Claude 세션: EnterWorktree로 생성(워크트리 이름은 ASCII만 허용) → 진입 직후 `git branch -m <한글-작업명>`
   - 수동/터미널: `.\scripts\new-work.ps1 <한글-작업명>` → `.claude/worktrees/<이름>`에 브랜치+워크트리 생성 + `npm install`. Claude 세션은 EnterWorktree의 `path`로 진입해 이어받는다.
   - 새 워크트리는 최초 1회 `npm install` 필요. dev 서버는 포트 분리(`npm run dev -- -p 3001`).
   - DB 등 env가 필요한 태스크는 워크트리에서 `vercel link --yes --project y-os-core --scope project-hosting-center` → `vercel env pull .env.local`로 내려받는다. **`--project`를 빼먹으면 폴더명으로 새 Vercel 프로젝트가 생성되니 주의.**
3. **태스크 사이클 반복** — 아래 태스크 사이클로 태스크를 하나씩 끝낸다.
4. **PR 생성** — 마지막 태스크의 커밋 승인은 PR 생성→머지→최신화→정리까지 일괄 진행 승인으로 본다. push 후 PR을 만들고, **PR 본문에 작업 내용을 기록**한다(태스크·커밋 목록, 작업 결과 문서 링크, 검증 결과).
   - push 이후에만 확정되는 검증(프리뷰 배포 등)은 해당 문서에 "사후 검증 결과 (추록)"를 보완하고 docs 커밋으로 PR에 포함한 뒤 머지한다.
5. **머지** — **merge commit 방식**(`gh pr merge --merge`). 태스크=커밋=문서 매핑을 main 히스토리에 보존해야 하므로 squash 금지.
6. **로컬 최신화 + 정리** — 메인 폴더에서 `git pull`로 main 갱신 → 원격 작업 브랜치 삭제 → 워크트리·로컬 브랜치 제거(ExitWorktree remove 또는 `git worktree remove`).
7. **머지 후 프로덕션 배포 확인** — **머지가 트리거한 프로덕션 배포가 success인 것까지 확인해야 사이클 완료.** 병렬 머지는 git 충돌 없이도 main 빌드를 깨뜨릴 수 있다(예: 한쪽이 export 제거, 다른 쪽이 그 export를 쓰는 새 파일 추가 — 실제 발생 사례 docs/13). 실패 시 즉시 핫픽스 사이클을 돌린다.

### 태스크 사이클 — 커밋·문서 단위 (작업 내용)

1. **작업** — 태스크를 한 번에 하나씩 진행한다. 완료 전에 빌드·린트 등으로 검증한다.
2. **작업 결과 문서 작성** — 태스크 완료 시 `docs/`에 작업 결과 문서를 작성한다 (아래 규칙).
3. **검토 대기** — 결과를 보고하고 사용자 검토를 기다린다. **사용자 승인 없이 다음 태스크로 넘어가지 않는다.**
4. **커밋** — 사용자가 승인하면 작업 + 작업 결과 문서를 **같은 커밋**으로 작업 브랜치에 찍고 다음 태스크로 진행한다.

### 병렬 작업 주의

- **메인 폴더(main 체크아웃)에는 다른 작업자의 미커밋 작업이 있을 수 있다.** 자기 워크트리 밖 파일은 읽기만 하고 수정하지 않는다. (요청 사이클 6단계의 main `git pull`만 예외)
- **docs 문서 번호 충돌**: 병렬 작업으로 같은 번호가 생기면 나중에 main에 머지되는 쪽이 번호를 올려 조정한다.
- **범위 중복 확인 (요청 사이클 시작 전 필수)**: `git worktree list`와 `gh pr list`로 진행 중인 브랜치·PR을 확인하고, 요청 범위가 겹치면 작업을 시작하지 말고 사용자에게 보고해 조정받는다. (실사례: DB 전환을 두 세션이 동시에 구현해 한쪽 전체 폐기 — docs/22)
- **DB 스키마 변경은 동시에 한 브랜치만**: 개발 DB는 전 세션이 공유하므로 마이그레이션 충돌이 즉시 전파된다. 스키마를 만지는 브랜치가 이미 있으면(워크트리·PR에서 `prisma/` 변경 확인) 그 PR 머지 후 시작한다. **`prisma db push` 금지 — 항상 `prisma migrate dev`**로 마이그레이션 파일을 남긴다.
- **부수 버그픽스는 초소형 PR로 분리**: 작업 중 main 결함(빌드 깨짐 등)을 발견하면 자기 기능 브랜치에 섞지 말고 즉시 별도 브랜치 → 소형 PR로 먼저 머지한다. 두 세션이 같은 결함을 각자 고치는 중복을 막는다. (실사례: docs/13·14)
- **머지 직전 최신 main 리베이스 + 빌드 확인**: 내 브랜치와 main이 각자 통과해도 합치면 깨질 수 있다(교차 의존 삭제 등). base가 최신 main과 같으면 로컬 빌드로 갈음한다.

### 작업 결과 문서 규칙

- 파일명: `docs/<번호>-<커밋-메시지-슬러그>.md`
  - 번호는 1부터 오름차순 (기존 docs/ 파일의 최대 번호 + 1)
  - 슬러그는 예정된 커밋 메시지에서 파일명에 쓸 수 없는 문자(`:`, 공백, `/` 등)를 하이픈으로 치환한 것
  - 예: 커밋 메시지 `chore: Next.js 16 + shadcn/ui 프로젝트 초기 구성` → `1-chore-nextjs-16-shadcn-ui-프로젝트-초기-구성.md`
- **문서는 쪼개지 않는다.** 그 커밋 단위의 모든 내용(작업 요약, 실행 명령, 변경 파일 내역, 사용 버전, 선정/결정 이유, 알려진 이슈)을 한 파일에 담는다. 길어도 상관없다.
- 커밋에 포함되는 **모든 변경이 문서에 기록**되어야 한다. 작업했지만 최종 diff가 없는 것도 히스토리로 남긴다.
- 커밋은 사용자가 요청·승인할 때만 찍는다. 문서는 작업 완료 시점에 미리 작성해 둔다.
- **푸시 이후에만 확정되는 검증 결과**(예: 푸시가 트리거한 배포의 URL·상태)는 해당 태스크 문서에 "사후 검증 결과 (추록)" 절로 보완한다. 추록만을 위한 새 번호 문서는 만들지 않으며, 추록은 다음 커밋에 포함하거나 사용자 승인 하에 즉시 docs 커밋으로 찍는다.

## 아키텍처 — API 경계 (필수)

추후 백엔드 분리를 염두에 두고 **모든 데이터 접근은 API 경계(Route Handler)를 통한다.**

```
페이지/컴포넌트 → src/lib/api → src/app/api/**/route.ts → src/server/** (서비스 + Prisma) → PostgreSQL
```

- 프론트엔드는 DB에 직접 접근하지 않는다.
- **Server Action 사용 금지** — 프론트는 항상 HTTP API(Route Handler)를 호출한다.
- **Prisma import는 `src/server/**`에서만 허용.** 페이지·컴포넌트·`src/lib`·Route Handler에서 금지.
- Route Handler는 얇게 유지하고 실제 처리는 `src/server/<도메인>/service.ts`로 위임한다.
- 프론트의 모든 HTTP 호출은 `src/lib/api`에 모은다. 컴포넌트에서 `fetch` 직접 사용 금지 — `client.ts` 공통 래퍼를 거친다.
- 백엔드 분리 시 `src/server`를 떼어내고 API 호출 URL만 바꾸면 되도록 설계한다.

## 폴더 구조 컨벤션 (목표 구조 — 필요할 때 생성)

아래는 목표 컨벤션이며 현재 실제 상태가 아니다. 폴더·파일은 작업하면서 이 규칙에 맞춰 생성한다. **사용자 승인 없이 폴더 구조를 크게 바꾸지 않는다.** (전체 트리·상세: docs/1번 문서 7절)

```
src
├─ app                    # 라우팅/페이지 진입점만 — 화면 구현은 features에 위임
│  ├─ (main)              # 메인 서비스 영역 (URL 미포함) — layout, dashboard, 도메인 페이지
│  ├─ (auth)              # 인증 화면 영역 (URL 미포함) — login, reset-password
│  └─ api                 # Route Handler — health, auth, admin/<도메인>
├─ components
│  ├─ ui                  # shadcn/ui 공통 컴포넌트
│  ├─ layout              # 사이드바, 헤더 등
│  └─ features/<도메인>    # 도메인별 화면 컴포넌트 (목록·필터·폼·상세 Sheet)
├─ lib
│  ├─ api                 # client.ts(fetch 공통 래퍼) + <도메인>.ts(호출 함수)
│  ├─ utils.ts            # cn() 등
│  └─ constants.ts
├─ server                 # 서버 전용 로직 — Prisma는 여기서만
│  ├─ db.ts               # Prisma client
│  └─ <도메인>/service.ts
├─ schemas                # zod 스키마 (프론트 폼 검증 + API 입력 검증 겸용)
├─ types                  # zod로 애매한 타입, z.infer 재노출
├─ hooks                  # 커스텀 훅
├─ generated              # 자동 생성물 (.gitignore 등록, 커밋 금지)
└─ proxy.ts               # 인증 체크/리다이렉트 (Next 16: 구 middleware.ts의 대체 규약)
```

- 도메인 예시 `items`는 실제로는 `problems`(문제)·`concepts`(개념) 등으로 만든다.
- 새 도메인 흐름: `page.tsx` → `components/features/<도메인>` → `lib/api/<도메인>.ts` → `app/api/admin/<도메인>/route.ts` → `server/<도메인>/service.ts` → `server/db.ts` → PostgreSQL

## 코드 규약

- Server Component가 기본. 상태/이벤트가 필요할 때만 `"use client"` — 클라이언트 경계는 트리 아래쪽에.
- import는 `@/` 별칭, 조건부 클래스는 `cn()` (`src/lib/utils.ts`)
- 색상은 임의 값 대신 `globals.css`의 디자인 토큰(`bg-primary` 등) 사용
- 새 의존성 추가는 신중하게 — 가볍고 빠른 서비스가 목표

## 주의사항

- **`npm audit fix --force` 실행 금지** — Next.js 내부 번들 postcss 관련 오탐이며, 자동 수정이 Next.js 9로 다운그레이드해 버린다. (상세: docs/1번 문서)
