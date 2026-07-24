# feat: Project.isDefault 추가 (공통 작업 기본 프로젝트 마커)

## 요청 (사이클 B 태스크 1)

"프로젝트 없음"을 계정마다 자동으로 생기는 실제 기본 프로젝트 **"{이름}의 공통 작업"**으로 실체화한다. 그 첫 단계로, 자동 생성된 기본 프로젝트를 식별할 마커 컬럼을 스키마에 추가한다.

## 변경 — `prisma/schema.prisma`

`Project`에 `isDefault Boolean @default(false)` 추가.

- 사용자당 `isDefault=true` 프로젝트는 하나(그 사용자의 "{name}의 공통 작업").
- 서버(B2)가 없으면 만들어 보장하고, 기존 미배정 할일을 담당자의 공통 작업으로 이관하는 데 이 마커를 쓴다.
- 표시상으로는 일반 프로젝트와 동일(작업 현황에도 노출) — 마커는 "자동 생성·중복 방지·삭제 정책" 판정용.

## 마이그레이션

`npx prisma migrate dev --name add_project_isdefault` 로 생성·적용.

- 파일: `prisma/migrations/20260724032550_add_project_isdefault/migration.sql`
- SQL: `ALTER TABLE "Project" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;`
- **Additive·비파괴** — 기존 행은 `false`로 채워지고, 컬럼을 참조하지 않는 기존 코드는 그대로 동작한다.

## 공유 DB 주의

- 착수 전 `prisma migrate status`로 **드리프트 없음("up to date", 11개 적용됨)** 확인 후 적용 — 초기화(reset) 프롬프트 없이 새 마이그레이션만 추가.
- 공유 개발 DB(Neon)에 즉시 반영되지만, additive 컬럼이라 다른 세션·기존 코드에 무해.
- 진행 중 `prisma/` 변경 브랜치 없음 확인(단일 스키마 브랜치 규칙).

## 검증

- `npm run lint` 통과 / `npx tsc --noEmit` 통과(exit 0). 아직 컬럼을 참조하는 코드는 없음(다음 태스크에서 사용) — 재생성된 클라이언트로 기존 코드 무손상 확인.
- `migration_lock.toml`은 내용 변경 없음(줄바꿈 표시만)이라 커밋에서 제외.

## 다음 (사이클 B)

- B2: `ensureDefaultProject` — 사용자별 공통 작업 보장 + 백필 + 미배정 할일 담당자 기준 이관.
- B3: 새 미배정 할일을 공통 작업으로 생성 + 캘린더/표시 전환.
