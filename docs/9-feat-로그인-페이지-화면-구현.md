# 9. 로그인 페이지 화면 구현

- **예정 커밋 메시지**: `feat: 로그인 페이지 화면 구현`
- **작업일**: 2026-07-22
- **작업 브랜치**: `로그인-페이지`
- **번호 조정**: 작성 시점에는 7번이었으나, 병렬 작업으로 main에 7(DB 기반 구축)·8(프로젝트 상세)이 먼저 머지되어 **번호 충돌 규칙(나중에 머지되는 쪽이 조정)에 따라 9번으로 변경**했다.

---

## 1. 작업 내용 요약

Figma `Login Layout`을 기준으로 로그인 페이지를 **화면 단위로만** 구현했다 (사용자 명시 범위 — 인증 로직 없음). `(auth)` 라우트 그룹 첫 사용으로, 인증 화면 공용 레이아웃(중앙 정렬 뮤티드 셸)도 함께 도입했다.

## 2. 디자인 소스

- Figma `jimmy-design-system` (fileKey `Vmv6OlcsEHpHnf5vNDVDoX`) → `🚀 Y.OS Core` 페이지
  | 노드 | 이름 | 내용 |
  |---|---|---|
  | `91:140` | Login Layout | 뮤티드 배경 중앙 정렬 — 브랜드 블록(로고 40 + 타이틀 20 + 서브 13) + 360px 인증 카드(제목 24/설명 14/이메일·비밀번호 필드 h-36/로그인 버튼/비밀번호 찾기 링크), 요소 간 gap 12, 카드 p-24, radius-base 8px |
  | `92:158` | Y.ONE Logo | 컴포넌트 설명: "네이비 스퀘어 + 화이트 Y.ONE 와이드 트래킹. 헤더 28 · 로그인 40" |

## 3. 구현 구조

```
src/app/(auth)/layout.tsx                        # 인증 화면 공용 중앙 정렬 셸 (디자인의 Centered Shell)
src/app/(auth)/login/page.tsx                    # "/login" 라우트 진입점 + 메타데이터(제목 "로그인")
src/components/features/auth/login-page.tsx      # 화면 조립: 브랜드 블록(Y.ONE 로고 40px) + LoginForm (서버)
src/components/features/auth/login-form.tsx      # 인증 카드: 이메일/비밀번호/버튼/링크 (클라이언트)
```

app은 라우팅 진입점만, 화면 구현은 `components/features/auth`에 위임 — 폴더 구조 컨벤션 준수. 클라이언트 경계는 폼(`LoginForm`)으로 한정.

## 4. 디자인 → 구현 결정 사항

| 항목 | 디자인 | 구현 결정 | 이유 |
|---|---|---|---|
| 색상 | `--brand/primary`(네이비), `--muted` 등 | 프로젝트 shadcn 토큰(`bg-primary`, `bg-muted`, `text-muted-foreground`) | `--primary`가 이미 브랜드 네이비 `#1b2a44` (docs/4 결정) |
| 라운딩 | `--brand/radius-base` 8px (카드·인풋·버튼) | `rounded-md` 토큰 | 프로젝트 `--radius-md` = 0.625rem×0.8 = **정확히 8px** — 임의값 대신 토큰 정합 |
| 인풋/버튼 높이 36px | h-36, px-12 | shadcn `Input`/`Button` 재사용 + `h-9`(inputs)·`size="lg"`(button) 오버라이드 | 프로젝트 shadcn 기본은 h-8(32px) — 디자인 수치에 맞춤 |
| 카드 | w-360, p-24, gap-12, 보더 | shadcn `Card` 재사용, `w-90` + `[--card-spacing:--spacing(6)]` + `gap-3` | Card의 스페이싱 CSS 변수 규약 활용. 보더는 Card 기본 `ring-foreground/10` 유지(디자인 `--border`와 시각 동등) |
| Y.ONE 로고 | 40px 네이비 스퀘어 + "Y.ONE" 텍스트 | 이미지 에셋이 아닌 프레임+텍스트 → CSS+텍스트로 구현 (`BrandMark`) | 벡터 에셋 없음. 컴포넌트 설명에는 "로그인 40(텍스트 11 오버라이드)"라고 적혀 있으나 **실제 노드 오버라이드는 9px/트래킹 1.26px** → 노드 값 채택(렌더 스크린샷 비율과 일치) |
| 폰트 | Inter | 프로젝트 기본 Geist 유지 | docs/4 기존 결정과 동일 |
| 폼 제출 | 정적 화면 | `"use client"` + `onSubmit` preventDefault 자리표시 | form을 시멘틱하게 유지하면서 **기본 GET 제출로 비밀번호가 URL 쿼리에 남는 것을 방지**. 실제 제출은 인증 태스크에서 연결 |
| 비밀번호 찾기 | 텍스트 링크 | `next/link` → `/reset-password` | 미구현 경로는 전역 404 처리 — 기존 패턴(docs/4). reset-password는 후속 태스크 |
| 접근성 | — | `Label htmlFor` + input `id`, `autoComplete`(email/current-password), 로고는 `aria-hidden` | 시멘틱 마크업 요구사항(h1 브랜드, h2 카드 제목, form/label/input/button) |

## 5. 변경 파일 내역

| 구분 | 파일 | 내용 |
|---|---|---|
| 신규 | `src/app/(auth)/layout.tsx` | 인증 화면 공용 중앙 정렬 레이아웃 (min-h-svh, bg-muted) |
| 신규 | `src/app/(auth)/login/page.tsx` | `/login` 라우트 + `metadata.title` |
| 신규 | `src/components/features/auth/login-page.tsx` | 브랜드 블록 + 폼 조립 (서버 컴포넌트) |
| 신규 | `src/components/features/auth/login-form.tsx` | 인증 카드 폼 (클라이언트 컴포넌트) |
| 신규 | `docs/7-feat-로그인-페이지-화면-구현.md` | 이 문서 |

## 6. 검증

1. `npm run lint` ✓ · `npm run build` ✓ — `/login` **Static 프리렌더** (/, /_not-found, /projects 포함 6페이지)
2. **프로덕션 렌더 검증** (`next start -p 3210` + curl): 시멘틱 태그 `<h1>` 1(브랜드)·`<h2>` 1(로그인)·`<form>` 1·`<label>` 2·`<input>` 2·`<button>` 1, 디자인 텍스트 전부 렌더, `<title>` "로그인" 템플릿 적용 확인
3. **브라우저 검증** (puppeteer-core + Chrome headless, 1440×900):
   - 스크린샷 Figma `Login Layout`과 비교 — 레이아웃·색·라운딩·타이포 일치 확인
   - 이메일/비밀번호 입력 후 **Enter 제출 → URL 쿼리 유출 없음**(preventDefault 동작) 확인
   - 콘솔 에러: `/reset-password` 프리페치 404 1건 — 미구현 라우트의 의도된 상태(전역 404 페이지), 하이드레이션·스크립트 에러 없음
4. 검증용 puppeteer-core는 세션 스크래치패드에 설치 — **프로젝트 의존성에 추가하지 않음**

## 7. 알려진 사항 / 후속 과제

- 로그인 버튼·비밀번호 찾기 링크의 실동작 없음 — 인증(세션/미들웨어) 태스크에서 연결 (`src/lib/api` → `/api/auth/login` 경로, 아키텍처 규칙대로)
- `/reset-password` 화면 미구현 — 후속 태스크 (공용 `(auth)/layout.tsx`는 준비됨)
- 폼 유효성 검증(zod `src/schemas`) 미적용 — 인증 태스크에서 API 입력 검증과 함께 도입
- 다크 모드: 토큰 기반이라 `.dark` 대응은 되어 있으나 로그인 화면 전용 다크 디자인은 미확인
- 디자인이 1440 데스크톱 기준이나, 중앙 정렬 + `min-h-svh` 구조라 모바일에서도 자연스럽게 동작 (카드 w-360 고정)
