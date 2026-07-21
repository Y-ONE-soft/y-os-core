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

사용자는 작업을 러프하게 요청한다. 에이전트는 반드시 아래 사이클로 진행한다:

1. **태스크 분해** — 요청을 태스크로 나눈다. **태스크 1개 = 커밋 1개 = 작업 결과 문서 1개.** 각 태스크에 예정 커밋 메시지를 붙인 분해안을 먼저 사용자에게 보여준다.
2. **작업** — 태스크를 한 번에 하나씩 진행한다. 완료 전에 빌드·린트 등으로 검증한다.
3. **작업 결과 문서 작성** — 태스크 완료 시 `docs/`에 작업 결과 문서를 작성한다 (아래 규칙).
4. **검토 대기** — 결과를 보고하고 사용자 검토를 기다린다. **사용자 승인 없이 다음 태스크로 넘어가지 않는다.**
5. **커밋** — 사용자가 승인하면 작업 + 작업 결과 문서를 **같은 커밋**으로 찍고 다음 태스크로 진행한다.

### 작업 결과 문서 규칙

- 파일명: `docs/<번호>-<커밋-메시지-슬러그>.md`
  - 번호는 1부터 오름차순 (기존 docs/ 파일의 최대 번호 + 1)
  - 슬러그는 예정된 커밋 메시지에서 파일명에 쓸 수 없는 문자(`:`, 공백, `/` 등)를 하이픈으로 치환한 것
  - 예: 커밋 메시지 `chore: Next.js 16 + shadcn/ui 프로젝트 초기 구성` → `1-chore-nextjs-16-shadcn-ui-프로젝트-초기-구성.md`
- **문서는 쪼개지 않는다.** 그 커밋 단위의 모든 내용(작업 요약, 실행 명령, 변경 파일 내역, 사용 버전, 선정/결정 이유, 알려진 이슈)을 한 파일에 담는다. 길어도 상관없다.
- 커밋에 포함되는 **모든 변경이 문서에 기록**되어야 한다. 작업했지만 최종 diff가 없는 것도 히스토리로 남긴다.
- 커밋은 사용자가 요청·승인할 때만 찍는다. 문서는 작업 완료 시점에 미리 작성해 둔다.

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
└─ middleware.ts          # 인증 체크/리다이렉트
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
