# feat: 프로젝트·할일 순서(order) 필드 — 스키마·마이그레이션·서버 정렬

드래그 재정렬 기능의 **토대**. 이 커밋은 순서를 저장·정렬하는 서버/DB 뼈대만 만든다. 실제 드래그 UI·재정렬 API는 다음 태스크(프로젝트·할일)에서 얹는다.

## 배경

Stage에는 이미 명시적 `order`가 있지만 Project·Task는 `createdAt` 정렬이라 사용자가 순서를 바꿀 수 없었다. 사이드바 프로젝트와 3곳의 할일(내 할일·프로젝트 백로그·단계 내)을 드래그로 재정렬하려면 영속적인 순서 필드가 필요하다.

## 변경 내역

### 스키마 — `prisma/schema.prisma`
- `Project.order Int @default(0)` — **그룹**(스탭은 소유 목록) 안에서의 사이드바 표시 순서.
- `Task.order Int @default(0)` — **컨테이너**(= projectId·stageId 조합; 단계 / 백로그(stageId null) / 미배정(projectId null)) 안에서의 표시 순서.
- Stage.order와 달리 **유니크 제약을 두지 않는다.** 재정렬은 컨테이너 전체를 0..N-1로 다시 매기는 방식이라 임시 충돌 회피가 필요 없고, 정렬 시 동률은 createdAt·id로 갈린다.

### 마이그레이션 — `prisma/migrations/20260724063831_add_project_task_order/`
- 두 컬럼 추가(`DEFAULT 0`) + **백필**: 기존 행을 컨테이너별로 `createdAt`(동률 시 id) 순서대로 `ROW_NUMBER() - 1`(0..N-1)로 채운다. 즉 **기존 표시 순서를 그대로 보존**한다(사용자 눈에 변화 없음).
  - Project: `PARTITION BY "groupId"`. Task: `PARTITION BY "projectId","stageId"`(NULL은 각각 하나의 컨테이너로 묶임).

### 서버 정렬(읽기) — `src/server/workspace/service.ts`
- `PROJECT_ORDER`·`TASK_ORDER` 상수 신설: `[order asc, createdAt asc, id asc]`.
- `getWorkspace`의 정렬 교체: 프로젝트 조회, 단계 내 할일(중첩), 백로그·미배정 할일 → order 우선. 그룹·댓글·단계는 그대로(그룹=createdAt, 단계=STAGE_ORDER).

### 서버 순서 유지(쓰기) — 새 항목·이동은 컨테이너 **맨 끝**으로
- `createTask`: 새 할일 order = 대상 컨테이너의 현재 할일 수(끝자리).
- `createProject`: 새 프로젝트 order = 그룹 내 현재 프로젝트 수(끝자리).
- `updateTask`(컨테이너 이동): 프로젝트/단계를 옮기면 order = 대상 컨테이너 현재 수(끝자리). 옮기는 할일은 대상에 아직 없으므로 개수가 곧 끝자리 인덱스.
- `compose.ts`(프리셋·균등분할로 만드는 프로젝트): 프로젝트 order = 그룹 끝자리.

### 클라이언트: 변경 없음
- 클라이언트는 서버가 **정렬해 내려준 배열 순서를 그대로** 렌더한다(스토어도 새 항목을 배열 끝에 append). 그래서 DTO에 order 필드를 추가할 필요가 없다. 재정렬(배열 재배치 + id 순서 전송)은 다음 태스크에서 다룬다.

## 결정 이유
- **유니크 제약 없음**: 재정렬을 "컨테이너 통째 0..N-1 재배치"로 하면 Stage처럼 임시 음수 order로 충돌을 피하는 로직이 필요 없다. 정렬 동률은 createdAt·id로 안정적.
- **백필로 기존 순서 보존**: 토대만 까는 커밋이라 사용자 눈에 아무 변화가 없어야 한다.
- **새 항목=끝자리**: 기존 동작(createdAt 정렬 → 새 항목이 아래)과 동일하게 유지. order default 0을 그대로 두면 새 항목이 위로 튀는 회귀가 생기므로 명시적으로 끝자리를 매긴다.

## 병렬 작업 메모
- 이 스키마 작업은 다른 세션의 `Task.scheduledTime` 스키마 변경과 겹쳐, 그 PR이 main에 머지된 뒤(리베이스) 착수했다. 마이그레이션은 `migrate deploy`로 적용(공유 개발 DB reset 없이 내 마이그레이션만).

## 실행/검증
```bash
npx prisma migrate deploy   # 20260724063831_add_project_task_order 적용
npm run lint                # 통과
npm run build               # 통과 (prisma generate 포함)
```
- **백필 검증(실 DB 직접 조회)**: 프로젝트 2그룹·할일 24컨테이너 모두 order가 0..N-1로 연속, 컨테이너 내 중복 order 0건. 샘플 컨테이너 order 0,1,2,3 순서 확인.
- **런타임 스모크**: `GET /api/admin/workspace` 200, 프로젝트·할일이 order 순으로 정렬돼 내려옴(기존 표시 순서와 동일).
