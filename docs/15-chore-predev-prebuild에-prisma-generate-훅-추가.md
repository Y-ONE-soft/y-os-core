# 15. predev·prebuild에 prisma generate 훅 추가

- **예정 커밋 메시지**: `chore: predev·prebuild에 prisma generate 훅 추가`
- **작업일**: 2026-07-22
- **작업 브랜치**: `프리즈마-생성-훅-추가` (워크트리 `.claude/worktrees/prisma-pregen-hook`, base: main `f171440`)
- **선행 커밋(같은 브랜치)**: `docs: 문서 번호 충돌 조정 (작업 현황 13→14)` — PR #8(빌드 복구)이 13번을 먼저 머지해, 나중에 머지된 PR #9(작업 현황 페이지) 문서를 규칙대로 14번으로 조정 (문서 내부 자기 참조 2곳도 함께 갱신).

---

## 1. 배경 — 로그인·로그아웃 장애 조사 (2026-07-22)

사용자 보고: ① 프로덕션에서 로그아웃이 안 됨, ② 로컬 3000(메인 폴더)에서 로그인 버튼 클릭 시 에러.

### ① 프로덕션 로그아웃 — 이 브랜치의 작업 아님 (PR #8이 이미 해결)

- 원인은 docs/13(빌드 복구)에 기록된 시맨틱 병렬 충돌: PR #7 머지 후 main 빌드 실패 → 프로덕션 배포 Error → 옛 번들(로그아웃 미배선)이 계속 서빙.
- 조사 시점에 PR #8이 머지·배포(Ready)된 직후였고, 본 세션이 프로덕션에서 `master01` 로그인 → `/api/auth/me` 200 → 로그아웃(쿠키 삭제 헤더 + DB 세션 삭제) → me 401 왕복을 curl로 재검증해 **정상 동작 확인**.

### ② 로컬 3000 — 메인 폴더 환경 낙후 (diff 없는 수리 작업, 히스토리 기록용)

메인 폴더(main 체크아웃)의 코드가 최신인데 환경이 Prisma 도입(docs/7) 이전 상태였다:

- `node_modules`에 `@prisma/client`·`@prisma/adapter-pg`·`bcryptjs`·`prisma` 부재 (마지막 `npm install`이 Prisma 도입 이전)
- 따라서 postinstall `prisma generate`도 안 돌아 `src/generated/prisma` 부재
- `.env.local`에 `DATABASE_URL` 없음 (`VERCEL_OIDC_TOKEN`만 — DB 도입 전에 pull 받은 파일)

→ `/api/auth/login`이 모듈 결손으로 500 → 로그인 폼에 에러 표시.

**수리 절차 (사용자 승인 하에 메인 폴더에서 실행, 커밋 대상 아님):**

```powershell
# 1. 3000 dev 서버 중지 (PID 25840)
# 2. env 갱신
vercel env pull .env.local --yes --scope project-hosting-center   # DATABASE_URL 등 확보
# 3. 의존성 + 생성 클라이언트 복구
npm install                                                        # postinstall → prisma generate
# 4. 임시 포트로 스모크 테스트 후 정리 (3000은 사용자 재시작용으로 비워둠)
npm run dev -- -p 3005  →  POST /api/auth/login(master01) 200, POST /api/auth/logout 200
```

## 2. 이 커밋의 작업 — 재발 방지 훅

git pull로 스키마·의존성 변경만 받고 `npm install`을 다시 안 돌린 체크아웃(메인 폴더·오래된 워크트리)에서 dev/build가 낡거나 없는 생성 클라이언트로 실행되는 것을 막는다.

```jsonc
// package.json scripts
"predev": "prisma generate",   // npm run dev 직전 자동 실행
"dev": "next dev",
"prebuild": "prisma generate", // npm run build 직전 자동 실행
"build": "next build",
```

- npm의 `pre<script>` 표준 훅 사용 — 별도 도구·의존성 추가 없음 (`prisma`는 기존 devDependencies)
- `npm run dev -- -p 3001`처럼 인자를 넘겨도 훅은 동일하게 실행됨
- Vercel 빌드는 install(postinstall) 직후라 prebuild가 중복 실행되지만 스키마 무변경 시 수십 ms 수준

### 한계 (의도된 범위)

- **generate 누락만 예방한다.** 이번 메인 폴더처럼 의존성 자체가 없는 경우는 `prisma` CLI도 없어 훅이 실행되지 못한다 — 이 경우는 어차피 dev/build 전체가 실패하므로 `npm install`이 필요하다는 신호가 즉시 드러난다.
- DB 스키마 마이그레이션(`prisma migrate`) 자동화는 다루지 않는다.

## 3. 변경 파일 내역

| 구분 | 파일 | 내용 |
|---|---|---|
| 수정 | `package.json` | `predev`·`prebuild` 스크립트 추가 (2줄) |
| 이름변경 | `docs/13-feat-작업-현황-페이지-…` → `docs/14-…` | 번호 충돌 조정 (선행 커밋) — 문서 1행 제목·52행 자기 참조도 14로 갱신 |
| 신규 | `docs/15-chore-predev-prebuild에-prisma-generate-훅-추가.md` | 이 문서 |

## 4. 검증

1. **결손 재현 테스트**: 워크트리에서 `src/generated` 삭제 → `npm run build` → prebuild가 클라이언트 재생성(46ms) 후 빌드 성공 (전체 라우트 10페이지, exit 0) — 오늘 장애와 동일한 결손 조건에서 자가 복구 확인
2. `npm run lint` ✓ (exit 0)
3. `npm run dev -- -p 3006` → predev가 generate(68ms) 실행 후 서버 기동, `/login` 200 확인
4. 메인 폴더 수리 결과: `npm run dev -- -p 3005` 임시 기동으로 로그인(200)·로그아웃(200) 스모크 테스트 통과 — 3000은 사용자 재시작 대기 상태

## 5. 사후 검증 결과 (추록)

- PR #10 프리뷰 배포 **success**: `https://y-os-core-hq0ydoz5e-project-hosting-center.vercel.app` (● Ready, 빌드 30s) — prebuild 훅 포함 상태로 Vercel 빌드 정상
- 프로덕션 배포 success 확인(요청 사이클 7단계)은 머지 후 수행해 사용자 보고로 기록

## 6. 알려진 사항 / 후속 과제

- 메인 폴더는 `f171440`(PR #9)보다 뒤처진 `b4ed355` 상태 — 요청 사이클 6단계(머지 후 main pull) 시점에 자연 갱신 예정
- 프로덕션 배포 success 확인 의무(CLAUDE.md 요청 사이클 7단계, PR #8 신설)는 이 PR 머지 후에도 동일 적용
