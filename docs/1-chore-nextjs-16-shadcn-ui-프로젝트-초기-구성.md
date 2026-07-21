# 1. Next.js 16 + shadcn/ui 프로젝트 초기 구성

- **예정 커밋 메시지**: `chore: Next.js 16 + shadcn/ui 프로젝트 초기 구성`
- **작업일**: 2026-07-22
- **선정 원칙**: 가장 많이 사용되고, 검증되었고, 안전한 기본값을 따른다. 서비스는 가볍고 빨라야 한다. shadcn/ui 사용은 사전 확정 요구사항.

---

## 1. 작업 내용 요약

1. `create-next-app@latest`로 프로젝트 생성 (TypeScript + Tailwind + App Router + src 디렉토리 + Turbopack)
2. shadcn/ui 초기화 — Radix UI 기반, Nova 프리셋, neutral 베이스 컬러, CSS 변수 테마
3. 실무 사용 빈도가 높은 시작 컴포넌트 10개 설치
4. 프로덕션 빌드(`npm run build`) 통과 확인
5. 아키텍처(API 경계 기준)·폴더 구조 컨벤션 확정 — 6·7절 참고, `CLAUDE.md`에 상시 규칙으로 등록
6. `.gitignore`에 `/src/generated/` 추가 (자동 생성 파일 커밋 금지)
7. 작업 결과 문서 워크플로우 확정 — 커밋 1개당 `docs/<번호>-<커밋-메시지-슬러그>.md` 1개, `CLAUDE.md`에 등록
8. 보일러플레이트 예시 파일 정리 — `public/`의 SVG 5개(next, vercel, file, globe, window) 삭제, `src/app/page.tsx`를 최소 페이지로 교체
9. 프로젝트 규칙은 `CLAUDE.md`에서 관리한다. `AGENTS.md`는 create-next-app이 생성한 Next.js 안내 블록만 유지 (`CLAUDE.md`가 `@AGENTS.md`로 참조)

실행한 명령:

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack --use-npm --yes
npx shadcn@latest init -b radix -p nova -y
npx shadcn@latest add button card input label badge separator skeleton dialog dropdown-menu sonner -y
npm run build   # ✓ 성공 — /, /_not-found 모두 Static 프리렌더링
```

---

## 2. 기술 스택 및 설치 버전

| 구분 | 기술 | 설치 버전 | 역할 |
|---|---|---|---|
| 런타임 | Node.js | v24.16.0 (로컬 환경) | JS 런타임 |
| 패키지 매니저 | npm | 11.x | 의존성 관리 |
| 프레임워크 | Next.js | **16.2.11** | 풀스택 React 프레임워크 (App Router + Turbopack) |
| UI 라이브러리 | React / React DOM | **19.2.4** | UI 렌더링 (Server Components 포함) |
| 언어 | TypeScript | 5.9.3 | 정적 타입 |
| 스타일링 | Tailwind CSS | **4.3.3** | 유틸리티 CSS (v4, CSS-first 설정) |
| 컴포넌트 | shadcn/ui (CLI) | 4.13.1 | 복사형(vendored) UI 컴포넌트 |
| 프리미티브 | Radix UI | 1.6.4 | 헤드리스 접근성 프리미티브 |
| 아이콘 | lucide-react | 1.25.0 | 아이콘 세트 |
| 토스트 | sonner | 2.0.7 | 알림/토스트 |
| 테마 | next-themes | 0.4.6 | 다크 모드 지원 |
| 린트 | ESLint + eslint-config-next | 9.x / 16.2.11 | 코드 품질 |

보조 유틸리티: `class-variance-authority` 0.7.1(변형 관리), `clsx` 2.1.1 + `tailwind-merge` 3.6.0(클래스 병합), `tw-animate-css` 1.4.0(애니메이션).

---

## 3. 왜 이 조합인가 (선정 근거)

### Next.js 16 (App Router + Turbopack)

- `create-next-app@latest`가 설치하는 **현재 최신 안정(stable) 메이저**. 커뮤니티/문서/생태계가 가장 크고, shadcn/ui 공식 문서의 1순위 대상 프레임워크다.
- **App Router**는 Next.js 13 이후 표준 라우팅 방식이며, React Server Components를 활용해 클라이언트로 보내는 JS를 최소화한다 → "가볍고 빠른 서비스" 요구에 직결.
- 정적 프리렌더링이 기본이라 별도 설정 없이도 정적 페이지는 CDN 수준 속도로 서빙된다. (현재 `/`, `/_not-found` 모두 Static으로 빌드됨을 확인)
- **Turbopack**이 dev/build 기본 번들러로, Webpack 대비 빌드·HMR 속도가 크게 빠르다.

### React 19

- Next.js 16이 요구하는 페어 버전. Server Components, `use` 훅, 폼 액션 등이 안정화된 버전으로, React 팀이 권장하는 현행 안정 메이저다.

### TypeScript 5 + ESLint 9

- 사실상 업계 표준. `create-next-app` 기본 구성(strict 모드, `eslint-config-next`)을 그대로 사용해 특이 설정 없이 누구나 익숙한 형태를 유지한다.

### Tailwind CSS v4

- shadcn/ui가 공식 지원하는 스타일링 스택. v4는 별도 `tailwind.config` 없이 **CSS 파일에서 직접 설정**(`@import "tailwindcss"`, `@theme`)하는 방식으로 단순해졌다.
- 사용된 클래스만 최종 CSS에 포함되므로 결과물이 매우 작다 → 경량 서비스에 유리.

### shadcn/ui — 유일하게 사전 확정된 요구사항

- 컴포넌트를 **npm 의존성이 아니라 소스 코드로 복사**(`src/components/ui/`)하는 방식. 런타임에 무거운 UI 라이브러리를 끌고 오지 않고, **사용하는 컴포넌트만 번들에 포함**된다 → 경량성 목표에 부합.
- 복사된 코드는 프로젝트 소유이므로 자유롭게 수정 가능하고, 라이브러리 메이저 업그레이드에 발목 잡히지 않는다.
- shadcn CLI 4.x부터 기반 프리미티브를 선택할 수 있다(`radix` / `base` / `aria`). 이 프로젝트는 **Radix UI**를 선택했다:
  - shadcn/ui의 원조 기반으로 **가장 오래 검증**되었고, 기존 생태계 예제·문서·커뮤니티 자료 대부분이 Radix 기준이다. 선정 원칙("가장 많이, 안전하게")에 가장 부합.
  - WAI-ARIA 접근성이 검증된 헤드리스 프리미티브.
- 프리셋은 CLI 기본값인 **Nova**(Lucide 아이콘 + Geist 폰트), 베이스 컬러는 **neutral**, 테마는 **CSS 변수** 방식(`src/app/globals.css`)을 사용한다.

### 설치된 시작 컴포넌트 (10개)

`button`, `card`, `input`, `label`, `badge`, `separator`, `skeleton`, `dialog`, `dropdown-menu`, `sonner`

실무 사용 빈도가 가장 높은 최소 세트만 설치했다. 추가는 필요할 때 `npx shadcn@latest add <컴포넌트명>` 한 줄이면 된다.

---

## 4. 프로젝트 구조

```
y-os-core/
├── docs/                      # 커밋 단위 작업 결과 문서 (이 파일 포함)
├── public/                    # 정적 파일 (이미지, 파비콘 등 — 그대로 서빙됨)
├── src/
│   ├── app/                   # App Router — 라우팅의 단위는 폴더
│   │   ├── layout.tsx         # 루트 레이아웃 (폰트, 전역 Provider 위치)
│   │   ├── page.tsx           # / 페이지
│   │   ├── globals.css        # Tailwind v4 설정 + 디자인 토큰(CSS 변수)
│   │   └── favicon.ico
│   ├── components/
│   │   └── ui/                # shadcn/ui 컴포넌트 (CLI가 여기에 복사)
│   ├── hooks/                 # 커스텀 훅 (shadcn CLI 규약 경로)
│   └── lib/
│       └── utils.ts           # cn() 등 공용 유틸
├── components.json            # shadcn/ui CLI 설정
├── next.config.ts             # Next.js 설정
├── tsconfig.json              # TypeScript 설정 (@/* 경로 별칭)
├── eslint.config.mjs          # ESLint flat config
├── postcss.config.mjs         # Tailwind v4 PostCSS 플러그인
└── package.json
```

### 핵심 구성 결정

- **`src/` 디렉토리 사용** — 애플리케이션 코드와 루트 설정 파일을 분리하는, 실무에서 널리 쓰이는 구조. shadcn CLI도 자동 인식.
- **경로 별칭 `@/*`** — `tsconfig.json`에 `"@/*": ["./src/*"]`. 모든 import는 `@/components/ui/button` 형태. create-next-app과 shadcn 공통 기본 규약.
- **`components.json`** (shadcn CLI 설정):

  | 항목 | 값 | 의미 |
  |---|---|---|
  | style | `radix-nova` | Radix UI 기반 + Nova 프리셋 (Lucide/Geist) |
  | rsc | `true` | React Server Components 사용 |
  | tailwind.css | `src/app/globals.css` | Tailwind v4 진입점 (별도 config 파일 없음) |
  | baseColor | `neutral` | 중립 그레이 팔레트 |
  | cssVariables | `true` | CSS 변수 기반 테마 (다크 모드 대응 용이) |
  | iconLibrary | `lucide` | 아이콘 라이브러리 |

- **테마/디자인 토큰** — 색상·라운딩 등은 전부 `src/app/globals.css`의 CSS 변수(`--background`, `--primary`, `--radius` 등)로 정의. 브랜드 컬러 변경 시 이 파일만 수정하면 모든 shadcn 컴포넌트에 일괄 반영된다. 다크 모드는 `.dark` 클래스 스코프의 변수 오버라이드로 동작하며, 토글이 필요해지면 이미 설치된 `next-themes`로 `ThemeProvider`를 루트 레이아웃에 추가하면 된다.

---

## 5. 개발 가이드

### 기본 명령어

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 실행 (Turbopack, http://localhost:3000) |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 빌드 결과물로 프로덕션 서버 실행 |
| `npm run lint` | ESLint 검사 |

### shadcn/ui 컴포넌트 추가

```bash
npx shadcn@latest add <컴포넌트명>
# 예: npx shadcn@latest add table tabs select
```

컴포넌트 목록: https://ui.shadcn.com/docs/components — 설치되면 `src/components/ui/`에 소스가 복사되며, 자유롭게 수정해도 된다(우리 코드다).

### 코드 규약

- **Server Component가 기본.** `useState`, `onClick` 등이 필요할 때만 `"use client"` 선언. 클라이언트 경계는 가능한 한 트리 아래쪽(작은 컴포넌트)에 둔다 — 클라이언트 번들을 작게 유지하는 핵심 규칙.
- 라우팅: 새 페이지 `src/app/<경로>/page.tsx`, 레이아웃 `layout.tsx`, API `src/app/api/<경로>/route.ts`
- import는 `@/` 별칭 사용: `import { Button } from "@/components/ui/button"`
- 조건부 클래스는 `cn()` 사용: `cn("base", isActive && "active")` (`src/lib/utils.ts`)
- 색상은 임의 값(`bg-[#123456]`) 대신 `globals.css`의 디자인 토큰(`bg-primary`, `text-muted-foreground` 등)을 사용한다.

### 성능 원칙 (가볍고 빠른 서비스)

1. 정적으로 만들 수 있는 페이지는 정적으로 둔다 — 불필요한 `cookies()`/`headers()` 호출이나 동적 렌더링 강제를 피한다.
2. 무거운 클라이언트 라이브러리 도입 전에 서버에서 처리할 수 없는지 먼저 검토한다.
3. 이미지에는 `next/image`, 외부 폰트 대신 내장 Geist 폰트(`next/font`)를 사용한다.
4. 새 의존성 추가는 신중하게 — shadcn 방식(코드 복사)으로 해결 가능한지 먼저 확인한다.

---

## 6. 아키텍처 — API 경계 기준

이 프로젝트는 **추후 백엔드 분리 확장을 염두에 두고, 모든 데이터 접근을 API 경계(Route Handler)를 통해 처리**한다.

```
페이지 / 컴포넌트
→ API 클라이언트 레이어 (src/lib/api)
→ Route Handler (src/app/api/**/route.ts)
→ 서버 전용 로직 (src/server/**, 서비스 + Prisma)
→ PostgreSQL
```

### 규칙

1. 프론트엔드는 DB에 직접 접근하지 않는다.
2. 프론트는 **Server Action을 사용하지 않고** 항상 HTTP API(Route Handler)를 호출한다.
3. 서버 전용 로직(도메인 서비스, Prisma 접근)은 `src/server/**`에 둔다. **Route Handler는 얇게 유지**하고 실제 처리는 서비스로 위임한다.
4. **Prisma import는 `src/server/**`에서만 허용**한다. 페이지·클라이언트 컴포넌트·UI 컴포넌트·`src/lib`·Route Handler에서 직접 Prisma를 import하지 않는다.
5. 프론트의 API 호출 코드는 `src/lib/api`에 모은다. 추후 백엔드 분리 시 `src/server`를 떼어내고 API 호출 URL만 바꾸면 되도록 설계한다.

---

## 7. 폴더 구조 (목표 컨벤션)

아래 트리는 **목표 구조(컨벤션)이며 현재 저장소의 실제 상태가 아니다.** 폴더·파일은 작업하면서 필요할 때 이 규칙에 맞춰 생성한다. `items`는 도메인 예시이며, 실제로는 `problems`(문제)·`concepts`(개념) 등으로 만든다. 각 경로 옆 주석은 그 위치의 역할을 뜻한다.

import alias는 `@/*` → `src/*`를 사용한다. **사용자 승인 없이 폴더 구조를 크게 바꾸지 않는다.**

```
src
├─ app                              # Next.js 라우팅/페이지/API 영역
│  ├─ layout.tsx                    # 전체 앱 최상위 레이아웃
│  ├─ globals.css                   # 전역 스타일
│  ├─ loading.tsx                   # 전역 로딩 UI
│  ├─ error.tsx                     # 전역 에러 UI
│  ├─ not-found.tsx                 # 404 페이지
│  │
│  ├─ (main)                        # 메인 서비스 영역, URL에 포함 안 됨
│  │  ├─ layout.tsx                 # 메인 공통 레이아웃: 사이드바/헤더 등
│  │  ├─ page.tsx                   # "/" 또는 메인 진입 페이지
│  │  ├─ dashboard
│  │  │  └─ page.tsx                # "/dashboard"
│  │  └─ items                      # 도메인 페이지 예시: problems 등으로 변경 가능
│  │     ├─ page.tsx                # "/items" 목록
│  │     ├─ new
│  │     │  └─ page.tsx             # "/items/new" 등록
│  │     └─ [id]
│  │        ├─ page.tsx             # "/items/:id" 상세
│  │        └─ edit
│  │           └─ page.tsx          # "/items/:id/edit" 수정
│  │
│  ├─ (auth)                        # 인증 화면 영역, URL에 포함 안 됨
│  │  ├─ login
│  │  │  └─ page.tsx                # "/login"
│  │  └─ reset-password
│  │     └─ page.tsx                # "/reset-password"
│  │
│  └─ api                           # API Route Handler 영역
│     ├─ health
│     │  └─ route.ts                # GET "/api/health"
│     ├─ auth
│     │  └─ login
│     │     └─ route.ts             # POST "/api/auth/login"
│     └─ admin
│        └─ items                   # 도메인 API 예시
│           ├─ route.ts             # GET/POST "/api/admin/items"
│           └─ [id]
│              └─ route.ts          # GET/PATCH/DELETE "/api/admin/items/:id"
│
├─ components                       # UI 컴포넌트
│  ├─ ui                            # shadcn/ui 공통 컴포넌트
│  ├─ layout                        # 사이드바, 헤더, 페이지 헤더 등
│  └─ features
│     └─ items                      # 도메인별 화면 컴포넌트 예시
│        ├─ item-management-page.tsx
│        ├─ item-table.tsx
│        ├─ item-filter.tsx
│        ├─ item-form.tsx
│        └─ item-detail-sheet.tsx
│
├─ lib                              # 공통 유틸/클라이언트 공통 코드
│  ├─ api
│  │  ├─ client.ts                  # fetch 공통 래퍼
│  │  └─ items.ts                   # items API 호출 함수
│  ├─ utils.ts                      # cn(), 공통 유틸
│  └─ constants.ts                  # 상수
│
├─ server                           # 서버 전용 로직, Prisma 접근 가능
│  ├─ db.ts                         # Prisma client
│  └─ items
│     └─ service.ts                 # 도메인 서버 로직
│
├─ schemas                          # zod 검증 스키마
│  └─ item.schema.ts
├─ types                            # TypeScript 타입
│  └─ item.ts
├─ hooks                            # React 커스텀 훅
│  ├─ use-debounce.ts
│  └─ use-table-state.ts
├─ generated                        # 자동 생성 파일 (커밋하지 않음, .gitignore 등록됨)
│  └─ prisma                        # Prisma 생성물
└─ middleware.ts                    # 인증 체크/리다이렉트 등
```

### 새 도메인 추가 시 흐름

`page.tsx(app)` → `components/features/<도메인>` → `lib/api/<도메인>.ts` → `app/api/admin/<도메인>/route.ts` → `server/<도메인>/service.ts` → `server/db.ts` → PostgreSQL

### 레이어별 책임

| 레이어 | 책임 |
|---|---|
| `app` | 라우팅과 페이지 진입점만. 화면 구현은 `components/features`의 컴포넌트에 위임한다. |
| `components/features` | 도메인별 화면 컴포넌트(목록·필터·폼·상세 Sheet 등). 화면 전용이면 여기, 여러 도메인 공용이면 `components/ui`·`components/layout`. |
| `lib/api` | 프론트의 모든 HTTP 호출. 컴포넌트에서 `fetch`를 직접 쓰지 않고 `client.ts`를 거친다. |
| `server` | Route Handler가 호출하는 서버 전용 로직. Prisma import는 이 폴더에서만 한다. |
| `schemas` | zod 스키마. 프론트 폼 검증과 API 입력 검증에 함께 쓴다. |
| `types` | zod로 표현하기 애매한 타입(또는 `z.infer` 재노출). |

### 이번 커밋에서 반영한 작업

- `.gitignore`에 `/src/generated/` 추가 (자동 생성 파일 커밋 금지 규칙 반영)
- 아키텍처·폴더 구조 규칙을 `CLAUDE.md`에 등록 (에이전트가 매 세션 자동 적용)
- 그 외 폴더·파일은 목표 컨벤션이므로 실제 작업 시점에 생성한다.

---

## 8. 알려진 이슈 / 주의사항

### `npm audit`의 postcss 경고 — **`npm audit fix --force` 절대 금지**

- 현재 moderate 2건이 보고되는데, 모두 Next.js가 내부에 번들한 `postcss`(<8.5.10) 관련이다.
- npm이 제안하는 자동 수정은 **Next.js 9로의 다운그레이드**라는 잘못된 해결책이므로 실행하면 안 된다.
- postcss는 **빌드 타임 의존성**이라 배포된 서비스 런타임에는 영향이 없고, 해당 XSS 시나리오(신뢰할 수 없는 입력을 CSS로 문자열화)는 일반적인 Next.js 빌드에 해당하지 않는다. Next.js 패치 릴리스에서 해소될 때까지 대기하면 된다.

### 버전 관리 정책

- `next`, `react`, `react-dom`, `eslint-config-next`는 **고정 버전**(create-next-app 기본) — 프레임워크 코어는 의도적으로만 올린다.
- 나머지는 캐럿(`^`) 범위 — 마이너/패치 업데이트 허용.
- `package-lock.json`을 커밋해 재현 가능한 설치를 보장한다.

---

## 9. 이번 커밋 변경 파일 내역

### 커밋 구성 참고

`create-next-app`이 자동 생성한 초기 커밋(`Initial commit from Create Next App`, 프로젝트 스캐폴드 전체)이 있었으나, **"커밋 1개 = 문서 1개" 매핑을 위해 `git commit --amend`로 이번 작업 전체를 하나의 초기 커밋으로 합쳤다** (원격 푸시 이력이 없는 로컬 커밋이라 안전). 따라서 저장소의 첫 커밋이 곧 이 문서의 커밋이며, 스캐폴드 + 아래 내역을 모두 포함한다. 아래 신규/수정/삭제 구분은 자동 스캐폴드 시점 대비 추가로 반영된 변경 기준이다.

### 신규 파일

| 파일 | 내용 |
|---|---|
| `components.json` | shadcn/ui CLI 설정 (radix-nova, neutral, CSS 변수) |
| `src/components/ui/*.tsx` (10개) | shadcn 컴포넌트: button, card, input, label, badge, separator, skeleton, dialog, dropdown-menu, sonner |
| `src/lib/utils.ts` | `cn()` 유틸 (shadcn init 생성) |
| `docs/1-chore-nextjs-16-shadcn-ui-프로젝트-초기-구성.md` | 이 작업 결과 문서 |

### 수정 파일

| 파일 | 변경 내용 |
|---|---|
| `CLAUDE.md` | 프로젝트 규칙 전체 등록 — 기술 스택, 명령어, 작업 결과 문서 워크플로우, 아키텍처(API 경계), 폴더 구조 컨벤션, 코드 규약, 주의사항. (초기 커밋 시점에는 `@AGENTS.md` 참조 한 줄이었음) |
| `.gitignore` | `/src/generated/` 추가 — 자동 생성 파일 커밋 금지 |
| `package.json` / `package-lock.json` | shadcn 관련 의존성 추가 (radix-ui, lucide-react, cva, clsx, tailwind-merge, sonner, next-themes, tw-animate-css 등) |
| `src/app/globals.css` | shadcn 테마 등록 — 디자인 토큰 CSS 변수(라이트/다크), Tailwind v4 인라인 테마 매핑 |
| `src/app/page.tsx` | Next.js 데모 페이지 → 최소 페이지로 교체 (삭제된 예시 SVG 참조 제거) |

### 삭제 파일 (보일러플레이트 예시 정리)

- `public/next.svg`, `public/vercel.svg`, `public/file.svg`, `public/globe.svg`, `public/window.svg`

### 작업했으나 최종 diff가 없는 파일

- `AGENTS.md` — 작업 중 규칙을 여기에 등록했다가 **규칙 관리 위치를 `CLAUDE.md`로 확정**하며 원상 복구. 최종적으로 초기 커밋과 동일(Next.js 안내 블록만 유지)하므로 diff 없음.
- `docs/` — 작업 중 tech-stack/project-structure/development/README 4개 파일로 쪼갰다가 **"커밋 1개 = 문서 1개" 워크플로우 확정**에 따라 이 문서 하나로 통합. 중간 산출물은 커밋 전에 삭제되어 최종 커밋에는 이 문서만 포함된다.
