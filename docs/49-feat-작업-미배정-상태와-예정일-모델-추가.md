# 49. 작업 미배정 상태와 예정일 모델 추가

- **예정 커밋 메시지**: `feat: 작업 미배정 상태와 예정일 모델 추가`
- **작업일**: 2026-07-22
- **작업 브랜치**: `작업-미배정-예정일` (워크트리 `.claude/worktrees/task-unassigned-schedule`, base: main `24ce0a8`)
- **요청 사이클 태스크 1/3** — 이후 태스크 2(UI: 기본 미배정·"프로젝트 없음" 선택), 태스크 3(단계 지정 시 예정일 자동 계산)이 이어진다.

---

## 1. 작업 요약

"내 작업에서 만든 작업은 일단 **프로젝트 없음**, 프로젝트·단계를 고르면 그때 배정된다"를 지탱할 **데이터 계층**을 만들었다. 화면 변경은 없고 모델·API 경계까지다.

- `Task.projectId`를 **nullable**로 바꿔 미배정 상태를 표현
- `Task.scheduledDate`(YYYY-MM-DD) 추가 — 태스크 3의 예정일 계산이 저장될 자리
- 워크스페이스 응답에 **`unassigned` 버킷** 신설 — 미배정 작업은 어느 보드에도 속하지 않으므로 담을 자리가 없었다

## 2. 마이그레이션 — `prisma migrate dev` 대신 수동 작성 + `migrate deploy`

`prisma migrate dev` 실행 시 **드리프트 감지로 DB 리셋을 요구**했다:

```
[*] Changed the `User` table
  [+] Added column `group`
We need to reset the "public" schema ... All data will be lost.
```

원인은 오늘 낮 사고의 잔재다 — 다른 세션이 `User.group → groupId` 마이그레이션을 공유 DB에 선반영해 프로덕션 로그인이 500이 됐고(docs/33 4절 기록), 응급 복구로 `group` 컬럼을 **마이그레이션 없이 되살려** 이력과 실제 DB가 어긋난 상태였다.

공유 개발 DB를 리셋하면 **전 세션의 데이터가 소실**되므로 리셋을 쓰지 않고:

1. `prisma/migrations/20260722160000_add_task_unassigned_and_schedule/migration.sql`을 직접 작성
2. `npx prisma migrate deploy`로 적용 (드리프트 검사 없이 대기 중 마이그레이션만 적용)
3. `npx prisma generate`

```sql
ALTER TABLE "Task" ALTER COLUMN "projectId" DROP NOT NULL;
ALTER TABLE "Task" ADD COLUMN "scheduledDate" TEXT;
```

CLAUDE.md의 "`prisma db push` 금지 — 항상 마이그레이션 파일을 남긴다"는 취지(이력 보존)는 그대로 지켰다. **잔재인 `User.group` 컬럼은 건드리지 않았다** — 남의 응급 조치를 임의로 되돌리지 않기 위함이며, 정리는 그 세션 몫으로 남긴다.

## 3. 변경 파일 내역

| 구분 | 파일 | 내용 |
|---|---|---|
| 신규 | `prisma/migrations/20260722160000_add_task_unassigned_and_schedule/migration.sql` | projectId nullable + scheduledDate 추가 |
| 수정 | `prisma/schema.prisma` | `Task.projectId String?`·`project Project?`·`scheduledDate String?` |
| 수정 | `src/types/workspace.ts` | `BoardTask.scheduledDate?`, `Workspace.unassigned: BoardTask[]` |
| 수정 | `src/server/workspace/service.ts` | `toTask`에 scheduledDate, `getWorkspace`에 unassigned 분류, `createTask.projectId` nullable, `TaskPatch`에 projectId null·scheduledDate |
| 수정 | `src/app/api/admin/tasks/route.ts` | projectId 미지정 허용(= 미배정 생성) |
| 수정 | `src/app/api/admin/tasks/[taskId]/route.ts` | `PATCHABLE`에 scheduledDate |
| 수정 | `src/lib/api/workspace.ts` | `createTaskApi.projectId` nullable |
| 수정 | `src/components/features/projects/workspace-cache.ts` | `EMPTY`에 unassigned |
| 수정 | `src/components/features/projects/board-store.tsx` | `useUnassignedTasks()` 훅 |
| 수정 | `src/components/features/projects/project-store.tsx` | `cache.apply` 3곳에 `...prev` 보강 (Workspace 필드 누락 방지) |
| 신규 | `docs/49-…` | 이 문서 |

`updateTask`의 기존 방어 로직(프로젝트 이동 시 단계 소속 검증)은 그대로 두면 **미배정 전환에도 자동으로 맞는다** — `projectId: null`이면 어떤 단계도 소속 검증을 통과하지 못해 `stageId`가 null이 된다. 프로젝트 없는 작업이 단계에 남는 모순을 서버가 막는다.

## 4. 검증

1. `npm run lint` ✓ · `npm run build` ✓
   - 빌드가 잡아낸 실수 1건: `project-store.tsx`의 `cache.apply`가 Workspace를 통째로 새로 만들며 `unassigned`를 빠뜨림 → `...prev` 보강으로 수정 (그룹·프로젝트 추가/삭제 시 미배정 목록이 사라지는 버그를 사전 차단)
2. **API 왕복** (dev **3021** — 포트 점유 확인 후 내 워크트리 서버임을 프로세스 CommandLine으로 검증, docs/33의 포트 혼선 재발 방지):
   - `POST /api/admin/tasks {id, name}` (projectId 없음) → 200
   - `GET /api/admin/workspace` → `unassigned`에 등장, **어느 보드 백로그에도 섞이지 않음**(false) ✓
   - `PATCH {scheduledDate:"2026-07-30"}` → 200, 응답에 `scheduledDate` 반영 ✓
   - `PATCH {projectId:"p-yos"}` → unassigned에서 빠지고 p-yos 백로그로 이동 ✓
   - `PATCH {projectId:null}` → 다시 unassigned로 복귀 ✓
3. **테스트 데이터 정리**: 생성한 `tk-unassigned-test` 행 삭제 확인, 남은 미배정 작업 0건. DB 컬럼 최종 상태 `projectId(nullable=YES), scheduledDate(nullable=YES)` 확인

## 5. 알려진 사항 / 후속 과제

- **화면 변화 없음** — UI는 태스크 2, 예정일 자동 계산은 태스크 3
- 캘린더는 여전히 자리표시 상수(`CAL_OVERLAYS`) 기반이라 `scheduledDate`를 저장해도 화면에 표시되지 않는다. 캘린더 실데이터 전환은 사용자 결정에 따라 **이번 요청 범위 밖**
- 작업 삭제 API가 없어 테스트 행 정리는 DB 직접 삭제로 처리했다 — 삭제 엔드포인트는 별도 과제
- `User.group` 잔재 컬럼이 남아 있어 다음에 `prisma migrate dev`를 쓰는 세션도 같은 드리프트 경고를 만난다. 정리 시점 조율 필요
