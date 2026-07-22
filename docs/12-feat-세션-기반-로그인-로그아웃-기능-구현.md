# 12. 세션 기반 로그인·로그아웃 기능 구현

- **예정 커밋 메시지**: `feat: 세션 기반 로그인·로그아웃 기능 구현`
- **작업일**: 2026-07-22
- **작업 브랜치**: `로그인-로그아웃-기능`
- **번호 조정**: 원래 11번이었으나 병렬 작업(보드 단계·작업 추가, PR #6)이 11번을 먼저 머지해 **나중에 머지된 이 문서를 12번으로 조정** (`세션-전환-빌드-수정` 브랜치에서 수행).
- **선행 커밋(같은 브랜치)**: `docs: 문서 번호 충돌 조정 (계정 모델 8→10)` — main에 docs/8이 2개 존재하던 규칙 위반 상태(프로젝트 상세 vs 계정 모델)를 나중에 머지된 계정 모델 문서를 10번으로 올려 해소. 조정 전용 docs 커밋이라 별도 번호 문서는 만들지 않는다(추록 커밋과 동일 취급).

---

## 1. 작업 내용 요약

시드 계정(master01/step01)으로 실제 동작하는 **로그인·로그아웃**을 구현했다. 요구 원칙 "가장 간단하게, 그러나 확장 가능하게"에 따라 **새 의존성 0개**로 DB 세션 테이블 + httpOnly 쿠키 방식을 채택했고, 아키텍처 규칙의 API 경계 흐름(`컴포넌트 → src/lib/api → Route Handler → src/server → PostgreSQL`)을 이번에 처음 끝까지 완성했다 (`lib/api/client.ts` 공통 래퍼 신설).

## 2. 설계 — 왜 이 방식인가

| 선택 | 이유 (간단함) | 확장 경로 |
|---|---|---|
| **DB 세션 테이블 + 불투명 랜덤 토큰** (`Session` 모델, `randomBytes(32)` base64url) | JWT 서명·키 관리·갱신 로직이 전부 불필요. 토큰 자체에 정보가 없어 파기가 곧 무효화 | 강제 로그아웃(행 삭제), 세션 목록/다중 기기, 만료 정책 변경이 전부 DB 연산으로 해결 |
| **httpOnly + SameSite=Lax 쿠키** (`yos_session`, prod에서 Secure) | XSS로 토큰 탈취 불가, CSRF 기본 방어. 프론트 코드가 토큰을 만질 일 없음 | 백엔드 분리 시에도 쿠키 도메인 설정만 조정 |
| **proxy.ts는 쿠키 존재만 검사** | edge에서 Prisma를 돌릴 수 없고, 돌릴 필요도 없음 — 위조 쿠키는 API(`/api/auth/me` 등)의 실검증에서 401 | 필요 시 토큰 서명 검증을 proxy에 추가 가능 |
| **비밀번호 검증 = bcryptjs** | 시드(docs/10)와 동일 라이브러리 — `bcrypt.compare` 한 줄 | cost 조정·재해시 정책 추가 가능 |
| **세션 만료 7일 고정** | 롤링 갱신 로직 생략 | `getSessionUser`에서 만료 임박 시 연장하면 롤링으로 확장 |
| zod 미도입 | 입력이 문자열 2개라 plain 가드로 충분 — "새 의존성 신중" | 폼·API가 복잡해지는 도메인 태스크에서 `src/schemas`와 함께 도입 |

## 3. 구현 구조 (API 경계 흐름 완성)

```
[클라이언트]
src/components/features/auth/login-form.tsx      # 로그인 폼 — 제출/에러/pending (변경)
src/components/features/auth/session-context.tsx # SessionProvider/useSession — me 조회·signOut (신규)
src/components/layout/user-menu.tsx              # 실사용자 표시(스켈레톤→이름/직책) + 로그아웃 (변경)
src/components/layout/projects-nav.tsx           # 마스터 게이트를 세션 role로 전환 (변경)
        ↓
src/lib/api/client.ts                            # fetch 공통 래퍼 + ApiError (신규 — 첫 도입)
src/lib/api/auth.ts                              # login/logout/fetchMe (신규)
        ↓
src/app/api/auth/login/route.ts                  # POST — 검증→세션 발급→쿠키 set (신규)
src/app/api/auth/logout/route.ts                 # POST — 세션 삭제→쿠키 삭제 (신규)
src/app/api/auth/me/route.ts                     # GET — 세션 검증→사용자 반환 (신규)
        ↓
src/server/auth/service.ts                       # login/logout/getSessionUser — Prisma는 여기서만 (신규)
prisma/schema.prisma                             # Session 모델 (User 1:N, onDelete Cascade) (변경)

[경계]
src/proxy.ts                                     # 라우트 보호 — 비로그인→/login, 로그인+/login→/ (신규)
src/lib/constants.ts                             # SESSION_COOKIE 상수 (CURRENT_USER 자리표시 삭제)
src/types/auth.ts                                # SessionUser/UserRole 타입 (신규)
```

## 4. 주요 결정 사항

| 항목 | 결정 | 이유 |
|---|---|---|
| 로그인 식별자 | **아이디 또는 이메일** 겸용 (`OR` 조회 1개) | 시드 로그인 아이디는 `master01`인데 화면 라벨은 "이메일"이었음 — 라벨을 "아이디 또는 이메일"로 바꾸고 둘 다 허용 (디자인 대비 최소 수정) |
| Next 16 라우트 보호 | **`src/proxy.ts`** (구 middleware.ts는 deprecated·개명됨 — 내장 문서 확인) | CLAUDE.md 목표 구조의 `middleware.ts` 표기도 `proxy.ts`로 수정 |
| 세션 사용자 전달 | 클라이언트 `SessionProvider`가 `/api/auth/me` 1회 조회 | RSC가 `src/server`를 직접 import하면 백엔드 분리 시 흐름이 깨짐 — API 경계 유지. 로딩 동안 유저 메뉴는 스켈레톤 |
| `CURRENT_USER` 상수 폐기 | 삭제하고 세션 실데이터로 대체 | docs/5의 자리표시 해소. `UserRole`은 DB enum(`MASTER`/`STAFF`) 기준으로 `src/types/auth.ts`에 재정의 |
| 예약 슬러그 보호 유지 | proxy 공개 경로 = `/login`, `/reset-password`만 | reset-password는 미구현이라 기존처럼 404 |
| 실패 응답 규약 | `{ error: string }` + 400/401 — `client.ts`가 메시지 추출해 `ApiError`로 던짐 | 이후 모든 API가 같은 규약 사용 |

## 5. 변경 파일 내역

| 구분 | 파일 | 내용 |
|---|---|---|
| 수정 | `prisma/schema.prisma` | `Session` 모델 + `User.sessions` 관계 |
| 신규 | `prisma/migrations/20260722012100_add_session/` | 마이그레이션 (Neon 적용 완료) |
| 신규 | `src/server/auth/service.ts` | login/logout/getSessionUser (bcrypt 검증, 만료 세션 즉시 정리) |
| 신규 | `src/app/api/auth/{login,logout,me}/route.ts` | 얇은 Route Handler 3개 (쿠키 set/delete 포함) |
| 신규 | `src/lib/api/client.ts` · `src/lib/api/auth.ts` | fetch 공통 래퍼(첫 도입) + 인증 호출 함수 |
| 신규 | `src/proxy.ts` | 쿠키 기반 라우트 가드 (matcher: api·정적 파일 제외) |
| 신규 | `src/types/auth.ts` | `SessionUser`/`UserRole` |
| 신규 | `src/components/features/auth/session-context.tsx` | SessionProvider/useSession |
| 수정 | `src/lib/constants.ts` | `CURRENT_USER` 삭제 → `SESSION_COOKIE` |
| 수정 | `src/components/features/auth/login-form.tsx` | 실제 제출·에러 표시·pending, 라벨 "아이디 또는 이메일" |
| 수정 | `src/components/layout/user-menu.tsx` | 세션 실사용자 표시 + 로그아웃 동작 |
| 수정 | `src/components/layout/projects-nav.tsx` | `isMaster`를 세션 role 기준으로 |
| 수정 | `src/app/(main)/layout.tsx` | `SessionProvider` 래핑 |
| 수정 | `CLAUDE.md` | 목표 구조 `middleware.ts`→`proxy.ts`, 워크트리 env 규약(`vercel link --project` 주의) 추가 |
| 신규 | `docs/11-feat-세션-기반-로그인-로그아웃-기능-구현.md` | 이 문서 |
| (선행 커밋) | `docs/8-…계정…` → `docs/10-…` | 번호 충돌 조정 |

### 커밋에 포함되지 않는 변경 (히스토리 기록)

- 워크트리에 `vercel link` + `vercel env pull .env.local`(19개 env) 수행 — **`--project` 없이 `vercel link --yes`를 실행해 폴더명(auth)으로 빈 Vercel 프로젝트가 생성되는 사고** → `vercel project rm auth`로 즉시 삭제, 재발 방지 규약을 CLAUDE.md에 등록
- Neon에 `add_session` 마이그레이션 적용 (공유 dev DB — 다른 작업자와 동시 마이그레이션 충돌 주의)

## 6. 검증 (프로덕션 빌드 + 실제 Neon DB)

1. `npm run lint` ✓ · `npm run build` ✓ — `/api/auth/*` 3개 Dynamic, `/login` Static 유지, **"ƒ Proxy (Middleware)" 등록 확인**
2. **API 직접 검증 (curl)**: master01/step01 정상 로그인 200 + 사용자 JSON(민감 필드 없음), 오답 401
3. **브라우저 E2E** (puppeteer + Chrome headless, 프로덕션 서버):
   - 비로그인 `/` 접근 → `/login` 리다이렉트 ✓
   - 오답(master01/9999) → "아이디 또는 비밀번호가 올바르지 않습니다." 표시, `/login` 유지 ✓
   - master01/1111 → `/` 진입, 헤더에 마스터/대표 표시 ✓ · 새로고침 후 세션 유지 ✓
   - 로그인 상태로 `/login` 접근 → `/`로 반사 ✓
   - 마스터: 사이드바 프로젝트/그룹 추가 노출 ✓
   - 유저 메뉴 → 로그아웃 → `/login` 복귀 + 가드 재동작 ✓
   - step01(STAFF) 로그인 → 헤더 스탭/사원, **프로젝트/그룹 추가 숨김** ✓ (권한 게이트 실데이터 동작)
   - 콘솔: 스크립트·하이드레이션 에러 0 (404는 미구현 경로 프리페치, 로그아웃 직후 me 401은 정상 동작)

### 검증 환경 특이사항 (앱 이슈 아님)

- headless CDP의 신뢰 입력이 radix 계열 **pointerdown 이벤트를 발화하지 않는 환경 특성** 발견 — 기존 ContextMenu(docs/5 기능)도 동일 조건에서 재현. 합성 PointerEvent로는 메뉴가 정상 개폐되고 핸들러 배선이 검증됨. 실브라우저(수동)에서 유저 메뉴 클릭 1회 확인 권장

## 7. 알려진 사항 / 후속 과제

- **만료 세션 행은 지연 삭제** — 접근 시점에 정리되므로 미접근 만료 세션이 남는다. 필요 시 정리 크론/스크립트 추가
- 로그인 시도 제한(rate limit)·감사 로그 없음 — 운영 전 보안 태스크에서
- 비밀번호 변경/재설정(`/reset-password`) 미구현 — 화면(공용 레이아웃)은 준비됨
- 세션 로딩 중 유저 메뉴는 스켈레톤, 마스터 전용 UI는 잠깐 숨김 상태로 시작 — RSC 세션 조회(쿠키 기반 서버 렌더)로 개선 여지
- proxy는 쿠키 존재만 검사 — 위조 쿠키로 화면 셸은 열리나 데이터 API는 전부 401 (현 단계 데이터가 localStorage/상수라 노출 정보 없음). 실데이터 API가 늘면 각 Route Handler에서 `getSessionUser` 검증이 표준
- Vercel 배포는 push 후 확인해 추록 예정 (Neon env는 전 환경 주입 상태 — docs/7)

## 8. 사후 검증 결과 (추록)

- 커밋 `5e2a8e8` push → Vercel 프리뷰 배포 **success(● Ready)** — proxy(미들웨어)·`/api/auth/*` 포함 빌드가 배포 환경에서 정상 생성됨
- 프리뷰 URL: https://y-os-core-kzg142vco-project-hosting-center.vercel.app (한글 브랜치 해시 URL, SSO 보호라 외부 curl 검증은 불가 — 프로덕션 별칭은 main 머지 후 공개 URL에서 확인 가능)
- PR: https://github.com/Y-ONE-soft/y-os-core/pull/7 — merge commit 방식으로 머지
- 프로덕션(https://y-os-core.vercel.app)은 머지 배포 후 로그인 동작을 확인하면 된다 (Neon env·시드 계정은 전 환경 공유)
