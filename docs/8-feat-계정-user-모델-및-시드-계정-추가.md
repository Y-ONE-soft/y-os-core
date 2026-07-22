# 8. 계정(User) 모델 및 시드 계정 추가

- **예정 커밋 메시지**: `feat: 계정(User) 모델 및 시드 계정 추가`
- **작업일**: 2026-07-22
- **작업 브랜치**: `계정-모델-및-시드` (워크트리 `.claude/worktrees/account-model`, base: main `039cc38`)

---

## 1. 작업 내용 요약

첫 도메인 모델인 **User(계정)**를 Prisma 스키마에 추가하고, 첫 마이그레이션을 Neon에 적용했으며, 시드 계정 2개(master01/step01)를 생성했다. 마이그레이션·시드 워크플로우가 이 태스크로 확정됐다.

## 2. User 모델 (요구 필드 전부 반영)

| 요구 항목 | 필드 | 타입/제약 |
|---|---|---|
| 아이디 | `username` | String, **unique** (로그인 아이디) |
| 비밀번호 | `passwordHash` | String — **bcrypt 해시만 저장, 평문 금지** |
| 권한 | `role` | enum `UserRole` (MASTER / STAFF) |
| 이름 | `name` | String |
| 그룹 | `group` | String? (소속 그룹) |
| 직책 | `title` | String? |
| 전화번호 | `phone` | String? |
| 이메일 | `email` | String?, unique |
| (시스템) | `id`, `createdAt`, `updatedAt` | cuid PK, 생성/수정 시각 |

## 3. 시드 계정 (사용자 지정)

| username | 권한 | 이름 | 그룹 | 직책 | 전화번호 | 이메일 | 비밀번호 |
|---|---|---|---|---|---|---|---|
| `master01` | MASTER | 마스터 | Y-ONE | 대표 | 010-0000-0001 | master01@y-os.local | `1111` (bcrypt) |
| `step01` | STAFF | 스탭 | Y-ONE | 사원 | 010-0000-0002 | step01@y-os.local | `1111` (bcrypt) |

- 아이디 `step01`은 요청 표기 그대로 사용 (staff01이 의도였다면 시드 수정 후 재실행으로 변경 가능)
- 이름·그룹·직책·연락처는 지정이 없어 **플레이스홀더** — `prisma/seed.ts` 수정 후 `npx prisma db seed`로 언제든 갱신 (upsert라 재실행 안전)
- 비밀번호 `1111`은 개발용 — 운영 전환 전 반드시 변경

## 4. 확정된 마이그레이션·시드 워크플로우

- **마이그레이션 파일(`prisma/migrations/**`)은 커밋한다** — 이번 커밋에 `20260722004324_init_user` 포함
- 스키마 변경 시: `npx prisma migrate dev --name <이름>` (직결 URL로 Neon에 즉시 적용 + 마이그레이션 파일 생성) → **`npx prisma generate`로 클라이언트 재생성** (migrate가 자동으로 해주지 않음 — 시드 1차 실행 실패로 확인)
- 시드: `npx prisma db seed` (`prisma.config.ts`의 `migrations.seed: "tsx prisma/seed.ts"`)
- CLI는 **직결 URL(`DATABASE_URL_UNPOOLED`) 우선** 사용 — 마이그레이션은 커넥션 풀러(pgbouncer) 우회 필요. 런타임은 기존대로 `db.ts` 어댑터가 `DATABASE_URL`(pooled) 사용

## 5. 주요 결정 / 이슈

| 항목 | 내용 |
|---|---|
| 비밀번호 해싱 | `bcryptjs` (cost 10, `$2b$` 해시). 추후 로그인 태스크에서 `bcrypt.compare`로 그대로 검증 |
| `directUrl` 미지원 발견 | Prisma 스킬 문서(7.6 기준)에는 `datasource.directUrl`이 있으나 **7.9.0 타입에서 제거됨** — 빌드 타입 에러로 확인. CLI 전용 설정이므로 `url` 자체를 UNPOOLED 우선으로 변경해 해결 |
| 시드 실행기 | `tsx` (devDep 추가) — Node 24 네이티브 타입 스트리핑은 생성된 클라이언트 코드 호환이 불확실해 표준 도구 채택 |
| 시드 idempotency | `upsert(where: username)` — 재실행해도 중복 생성 없음 |

## 6. 변경 파일 내역

| 구분 | 파일 | 내용 |
|---|---|---|
| 수정 | `prisma/schema.prisma` | `UserRole` enum + `User` 모델 추가 |
| 신규 | `prisma/migrations/20260722004324_init_user/` | 첫 마이그레이션 (Neon 적용 완료) |
| 신규 | `prisma/seed.ts` | 시드 스크립트 (bcrypt 해시, upsert) |
| 수정 | `prisma.config.ts` | 시드 명령 등록, CLI url을 직결 URL 우선으로 변경 |
| 수정 | `package.json` / `package-lock.json` | `bcryptjs` 추가, `tsx`(dev) 추가 |
| 신규 | `docs/8-feat-계정-user-모델-및-시드-계정-추가.md` | 이 문서 |

## 7. 검증

1. `npx prisma migrate dev --name init_user` ✓ — Neon에 적용, 마이그레이션 파일 생성
2. `npx prisma db seed` ✓ — 1차 실패(스테일 클라이언트) → `prisma generate` 후 성공, 워크플로우 규칙에 반영
3. **DB 실조회 검증** (임시 스크립트, Neon 대상):
   - 사용자 2명, 모든 필드 값 확인
   - `bcrypt.compare("1111", hash)` → **true** (로그인 시나리오 성립), 오답 `"2222"` → **거부** 확인
4. `npx prisma migrate status` ✓ (직결 URL 경유) · `npm run build` ✓ · `npm run lint` ✓
5. 참고: pg 드라이버가 SSL mode 관련 경고 출력 (Neon URL의 `sslmode=require` — 현행 동작은 verify-full 수준이라 안전, pg v9에서 시맨틱 변경 예고. 추후 URL에 `sslmode=verify-full` 명시 검토)

## 8. 알려진 사항 / 후속 과제

- 로그인/세션 발급은 별도 인증 태스크에서 (`로그인-페이지` 워크트리가 병렬 진행 중 — User 모델·bcrypt 해시가 그쪽 선행 조건이므로 이 PR 머지 후 rebase 필요)
- 계정 관리 화면(CRUD)은 추후 도메인 태스크
- 시드 개인정보(이름 등)는 플레이스홀더 — 실제 값으로 교체 필요 시 seed.ts 수정
