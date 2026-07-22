# 23. 워크스페이스·보드 도메인 DB 모델 및 API 구축

- **예정 커밋 메시지**: `feat: 워크스페이스·보드 도메인 DB 모델 및 API 구축`
- **작업일**: 2026-07-22
- **작업 브랜치**: `할일-DB-전환` (커밋 1/2)

---

## 1. 작업 내용 요약

그동안 localStorage 자리표시 계층이던 **프로젝트(그룹/프로젝트)·보드(단계/작업/백로그/댓글)** 도메인을 Prisma+PostgreSQL로 옮겼다. 이 커밋은 **서버 측 전부**(스키마·마이그레이션·시드·서비스·API 라우트·클라이언트 호출 함수)를 담고, 화면 스토어 전환은 다음 커밋(24)이다. CLAUDE.md의 API 경계(`컴포넌트 → lib/api → Route Handler → server → PostgreSQL`)를 이 도메인에 처음 완성한다.

## 2. 데이터 모델 (prisma/schema.prisma)

| 모델 | 필드 요약 | 관계 |
|---|---|---|
| `ProjectGroup` | id, name, createdAt | 1:N Project |
| `Project` | id, name, color, createdAt, groupId | Group N:1, 1:N Stage·Task |
| `Stage` | id, name, color, startDate·endDate(YYYY-MM-DD 문자열), showDeadline, done, description, requestedCollaborators(String[]), created/updatedAt | Project N:1, 1:N Task·StageComment |
| `StageComment` | id, author, text, createdAt | Stage N:1 |
| `Task` | id, name, done, description, createdAt, projectId, **stageId(nullable=백로그)** | Project N:1, Stage N:1(옵션) |

### 핵심 설계 결정

| 항목 | 결정 | 이유 |
|---|---|---|
| **id를 클라이언트 생성** | 그룹/프로젝트/단계/작업/댓글 모두 클라가 접두사 uuid(`g-`/`p-`/`st-`/`tk-`/`cm-`)를 만들어 POST | 낙관적 업데이트 시 임시 id를 서버 응답으로 치환할 필요가 없다 — 로컬과 DB가 같은 id를 공유 |
| 날짜(startDate/endDate) | DateTime이 아닌 **String(YYYY-MM-DD)** | 화면·로드맵이 순수 날짜(시간대 무관)로 다룸 — TZ 변환 버그 원천 차단, 기존 스토어 규격과 일치 |
| 백로그 | 별도 모델 없이 `Task.stageId = null` | 작업 이동(단계↔백로그)이 stageId 패치 한 번으로 끝남 |
| 정렬 | 전 모델 `createdAt asc, id asc` | 시드·추가 순서 보존. 시드는 인덱스 기반 타임스탬프로 순서 고정 |
| 삭제 | 전부 `onDelete: Cascade` | 그룹 삭제 → 프로젝트 → 단계/작업 자동 정리 |
| requestedCollaborators | `String[]`(Postgres 배열) | 멤버 도메인 전 자리표시(작업 상세 오버레이 요청) |

## 3. API 라우트 (src/app/api/admin/**)

모두 **세션 필수**(`currentUser`), 그룹/프로젝트 생성·삭제와 데이터 초기화는 **MASTER 전용**(403). 실제 처리는 `src/server/workspace/service.ts`로 위임(라우트는 얇게).

| 메서드·경로 | 동작 | 권한 |
|---|---|---|
| `GET /api/admin/workspace` | 전체 트리(그룹+프로젝트+보드) 1회 부트스트랩 | 세션 |
| `POST /api/admin/workspace/reset` | 시드로 초기화 | MASTER |
| `POST /api/admin/groups` · `DELETE …/[groupId]` | 그룹 추가·삭제 | MASTER |
| `POST /api/admin/projects` · `DELETE …/[projectId]` | 프로젝트 추가·삭제 | MASTER |
| `POST /api/admin/stages` · `PATCH …/[stageId]` | 단계 추가·수정(이름/기간/완료/내용/요청) | 세션 |
| `POST /api/admin/stages/[stageId]/comments` | 댓글 추가(**작성자는 서버가 세션 사용자로 고정**) | 세션 |
| `POST /api/admin/tasks` · `PATCH …/[taskId]` | 작업 추가·수정(이름/완료/내용/단계이동) | 세션 |

- 공통 헬퍼는 `src/app/api/admin/guard.ts`(라우트 아님) — `currentUser`/`unauthorized`/`forbidden`/`badRequest`/`isName`. 실패 응답은 기존 규약 `{ error }` + 상태코드(400/401/403)로 통일해 `lib/api/client.ts`가 그대로 메시지를 추출.
- PATCH는 화이트리스트 필드만 반영(임의 컬럼 주입 차단).

## 4. 시드 (단일 소스)

- `src/server/workspace/seed-data.ts`의 `workspaceSeedRows()` — 기존 사이드바(docs/5)·보드(docs/8·11)·이후 확장 시드 값을 그대로 담아 DB 행으로 평탄화. **`prisma/seed.ts`(초기 주입)와 `resetWorkspace()`(데이터 초기화)가 공유**해 둘이 어긋날 수 없다.
- `prisma/seed.ts`는 기존 데이터가 있으면 워크스페이스 시드를 **건너뛴다**(User 시드는 upsert 유지) — 재실행 안전.

## 5. 변경 파일 내역

| 구분 | 파일 |
|---|---|
| 수정 | `prisma/schema.prisma` (5개 모델 추가), `prisma/seed.ts` (워크스페이스 시드) |
| 신규 | `prisma/migrations/20260722xxxxxx_add_workspace_board/` |
| 신규 | `src/types/workspace.ts` (DTO), `src/server/workspace/service.ts`, `src/server/workspace/seed-data.ts`, `src/server/auth/session.ts` |
| 신규 | `src/app/api/admin/guard.ts` + 라우트 9파일(workspace·reset·groups·projects·stages·comments·tasks) |
| 수정 | `src/lib/api/client.ts` (patch·del 추가) |
| 신규 | `src/lib/api/workspace.ts` (호출 함수) |
| 신규 | `docs/23-…` (이 문서) |

## 6. 검증

1. `npx prisma migrate dev` ✓ (Neon 적용) · `npx prisma db seed` ✓ (그룹 3·프로젝트 4·단계 14·작업 10) · `npm run lint`·`npm run build` ✓
2. **API 직접 검증**(curl, 로그인 쿠키): 작업 생성 200→workspace에 반영, 완료(done) 패치 200→반영, 내용(description) 패치 200→반영, 단계 이동 패치 200, 데이터 초기화 200→테스트 행 제거 확인. 전 CRUD가 실제 Neon에 영속됨
3. 화면 연동 검증은 커밋 24 문서 참조 (같은 서버 레이어 사용)

## 7. 알려진 사항

- 멤버(공동 작업자)는 여전히 자리표시 `TEAM_MEMBERS` — 멤버 도메인 태스크에서 User 연동
- 산출물·연결 티켓·작업 유형/난이도는 아직 스키마 없음(오버레이 로컬 상태) — 후속 도메인
- 공유 Neon(dev) — 병렬 작업자와 마이그레이션 동시 실행 시 충돌 주의(순차 적용 권장)
