# 7. Prisma + PostgreSQL DB 기반 구축

- **예정 커밋 메시지**: `feat: Prisma + PostgreSQL DB 기반 구축`
- **작업일**: 2026-07-22
- **작업 브랜치**: `DB-기반-구축` (워크트리 `.claude/worktrees/db-foundation`) — 병렬 작업 규칙 적용
- **문서 번호**: 병렬 작업 중인 `병렬-작업-환경-구성` 브랜치가 6번을 선점하고 있어 7번 사용 (번호 충돌 규칙 준수)

---

## 1. 작업 내용 요약

아키텍처 컨벤션(`페이지 → lib/api → Route Handler → server → PostgreSQL`)의 **DB 계층을 실제로 구축**했다.

1. **Neon PostgreSQL** 프로비저닝 — Vercel 마켓플레이스 통합으로 생성, `DATABASE_URL` 등 환경변수 자동 주입
2. **Prisma 7.9.0** 설치·초기화 — 새 `prisma-client` 제너레이터 + 드라이버 어댑터(`@prisma/adapter-pg`) 방식
3. `src/server/db.ts` Prisma 클라이언트 싱글톤 + 첫 API 경계 흐름 `GET /api/health`
4. dev 서버에서 **Neon 실연결 엔드투엔드 검증** (`{"status":"ok","db":"connected"}`)

## 2. DB 호스팅 결정 — Neon (사용자 선택)

| 후보 | 판단 |
|---|---|
| **Neon** ✅ | 서버리스 PostgreSQL, 무료 티어, Vercel 마켓플레이스 공식 통합(환경변수 자동 주입), 프리뷰 브랜치 DB 지원. 현재 배포 구성과 최적 |
| 로컬 Docker | Docker 데몬 미실행 상태였고, 배포 환경에 DB가 없어 프리뷰/프로덕션 검증 불가 |
| Supabase | 자체 인증 구축 예정이라 부가 기능 이점 없음 |

- **추후 교체 자유** — Neon은 표준 PostgreSQL이므로 자체 서버/RDS 이전 시 `DATABASE_URL`만 교체(+`pg_dump` 데이터 이전)하면 되고, Prisma 접근이 `src/server/**`에 격리되어 있어 코드 영향 없음.

### 프로비저닝 과정 (기록)

```bash
vercel integration add neon --scope project-hosting-center
# 1차: 마켓플레이스 약관 동의 필요(userActionRequired) → 사용자가 브라우저에서 동의
# 2차: 설치 성공 — DATABASE_URL, POSTGRES_*, PGHOST 등 19개 env 주입 + .env.local 자동 갱신
```

- 주의: `--scope` 없이 실행하면 CLI 기본 팀(midacosmetics)으로 설치된다. 반드시 `project-hosting-center` 스코프 명시.

## 3. Prisma 7.9.0 버전 선정 근거 (사용자 질의 검증)

"너무 최신이라 위험하지 않냐"는 질의에 npm 실사용 데이터(최근 1주)로 검증:

- 개별 버전 다운로드 1위가 **7.8.0 (주 394만 회)** — 최다 사용 단일 버전이 이미 7.x 라인
- 메이저 점유율 v6 38.3% vs v7 36.9% — v6는 기존 프로젝트 유지분, 신규는 v7이 표준
- 7.9.0은 7.0 GA 이후 마이너 9회를 거친 현행 안정 latest — Next.js 16 선정과 동일 기준
- v7 핵심 변화(Rust 엔진 제거 → 경량 TS 클라이언트 + 드라이버 어댑터)는 "가볍고 빠른 서비스" 목표에 부합 (콜드스타트·번들 개선)
- 문제 발생 시 최다 검증 버전 7.8.0으로 다운그레이드는 한 줄 수정

## 4. 구현 구조

```
prisma/schema.prisma        # datasource postgresql + prisma-client 제너레이터
prisma.config.ts            # Prisma 7 표준 설정 — .env.local 우선 로드(dotenv)
src/server/db.ts            # PrismaClient 싱글톤 (PrismaPg 어댑터, HMR 재생성 방지)
src/server/health/service.ts# SELECT 1 헬스 체크 (서비스 위임 컨벤션)
src/app/api/health/route.ts # GET /api/health — 얇은 핸들러, 실패 시 503
src/generated/prisma/       # 생성물 (gitignore, 커밋 제외 — prisma generate로 재생성)
.claude/skills/prisma-*     # Prisma 7이 자동 설치한 에이전트용 스킬 문서 9종 (커밋함)
```

### 주요 구현 결정

| 항목 | 결정 | 이유 |
|---|---|---|
| Prisma 7 클라이언트 생성 방식 | `prisma-client` 제너레이터, 출력 `src/generated/prisma` | v7 표준. 출력 경로가 폴더 컨벤션(`src/generated` 커밋 금지)과 일치 |
| DB 드라이버 | `@prisma/adapter-pg` (node-postgres) | v7은 Rust 엔진 없이 드라이버 어댑터 필수. 빌드 타입 에러로 확인 후 Prisma 생성 스킬 문서(`prisma-client-api`) 기준으로 적용. Neon도 표준 TCP로 호환 |
| env 파일 | `.env.local` 단일화 (`vercel env pull` 산출물), prisma init이 만든 `.env`는 삭제 | Next.js 런타임과 Prisma CLI가 같은 파일을 보도록 `prisma.config.ts`에서 `.env.local` 우선 로드 |
| 데이터 모델 | 이번 커밋에는 없음 (빈 스키마) | 기반 구축과 도메인 모델링 분리 — 모델은 도메인 태스크(예: 프로젝트 DB 전환)에서 추가 |
| Prisma 에이전트 스킬 | `.claude/skills/` 등 자동 생성물 커밋 | 이후 세션·작업자가 Prisma 7 API를 정확히 쓰도록 하는 공식 문서. `skills-lock.json`이 관리 |

## 5. 변경 파일 내역

| 구분 | 파일 | 내용 |
|---|---|---|
| 신규 | `prisma/schema.prisma`, `prisma.config.ts` | Prisma 7 초기화 (`npx prisma init --datasource-provider postgresql`) + `.env.local` 로드 수정 |
| 신규 | `src/server/db.ts` | PrismaPg 어댑터 싱글톤 |
| 신규 | `src/server/health/service.ts`, `src/app/api/health/route.ts` | 헬스 체크 (첫 API 경계 흐름) |
| 신규 | `.claude/skills/prisma-*` 9종, `.windsurf/skills/`, `.agents/skills/`, `skills-lock.json` | Prisma 자동 설치 에이전트 스킬 |
| 신규 | `docs/7-feat-prisma-postgresql-db-기반-구축.md` | 이 문서 |
| 수정 | `package.json` / `package-lock.json` | `prisma` 7.9.0(dev), `@prisma/client` 7.9.0, `@prisma/adapter-pg`, `dotenv`(dev) |
| 수정 | `.gitignore` | prisma init이 `/src/generated/prisma` 추가 (기존 `/src/generated/`와 중복이나 툴 관리 라인이라 유지) |

### 커밋에 포함되지 않는 것 (히스토리 기록)

- `src/generated/prisma/` — gitignore. 클론 후 `npx prisma generate`로 재생성
- `.env.local` — Neon 접속 정보(비밀값). `vercel env pull`로 각자 내려받음
- Vercel 프로젝트에 주입된 Neon 환경변수 19개 (Development/Preview/Production)

## 6. 검증

1. `npx prisma validate` ✓ · `npm run build` ✓ (`/api/health` Dynamic 라우트) · `npm run lint` ✓
   - 중간 이슈: `new PrismaClient()` 인자 누락 타입 에러 → v7 드라이버 어댑터 필수 확인 후 `@prisma/adapter-pg` 적용
2. **Neon 실연결 E2E** — 워크트리 dev 서버(포트 3003)에서:
   ```
   GET /api/health → 200 {"status":"ok","db":"connected"}
   ```
3. 포트 기록: 3000(메인 폴더 dev), 3001(y-one-works — 별개 프로젝트), 3002(jimmy-design-system — 별개 프로젝트)가 이미 점유 중이라 3003 사용. **3001·3002는 이 저장소와 무관한 사용자 프로젝트이므로 종료 금지.**

## 7. 알려진 사항 / 후속 과제

- 빈 스키마 상태 — 첫 도메인 모델(프로젝트 그룹/프로젝트 등)은 다음 태스크에서 마이그레이션과 함께 추가
- 프리뷰/프로덕션 배포에서의 `/api/health` 동작은 push·머지 후 확인해 추록 예정 (Neon env는 전 환경에 주입돼 있어 정상 동작 예상)
- Neon 무료 티어 한도(스토리지/컴퓨트) 초과 시 업그레이드 검토 필요
- `prisma migrate` 워크플로우(마이그레이션 파일 커밋 규칙)는 첫 모델 추가 태스크에서 확정

## 8. 사후 검증 결과 (추록)

### 프리뷰 배포 1차 실패 → postinstall 수정

- 브랜치 push가 트리거한 프리뷰 배포(PR #2)가 **빌드 실패**: `Module not found: Can't resolve '@/generated/prisma/client'`
- 원인: Prisma 생성물(`src/generated/prisma`)은 gitignore 대상인데 **Vercel 빌드에 `prisma generate` 단계가 없었음**. 로컬은 수동 generate로 통과해 발견이 늦음
- 수정: `package.json`에 `"postinstall": "prisma generate"` 추가 — Vercel(npm install 직후)과 새 클론 모두 자동 생성. 로컬에서 생성물 삭제 → `npm install` 흐름 재현으로 재생성·빌드 통과 확인
- 교훈: **gitignore된 생성물에 의존하는 코드는 CI/배포의 생성 단계까지 이 커밋에서 함께 구성해야 한다**

### 한글 브랜치명 프리뷰 처리 (병렬 규칙 후속 과제 응답)

- 한글 브랜치 `DB-기반-구축` push 시 Vercel이 정상적으로 프리뷰 배포를 생성함 — 배포 고유 URL은 랜덤 해시(`y-os-core-<hash>-project-hosting-center.vercel.app`)라 한글 무관, PR 체크로 연동됨. 한글 브랜치 전략에 배포 파이프라인 제약 없음 확인
