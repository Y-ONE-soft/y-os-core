# 43. 작업 삭제 — 우클릭 메뉴 및 상세 삭제 버튼

- **예정 커밋 메시지**: `feat: 작업 삭제 우클릭 메뉴 및 상세 삭제 버튼 추가`
- **작업일**: 2026-07-22
- **작업 브랜치**: `작업-삭제-기능` (워크트리 `.claude/worktrees/task-delete`, base: main `401235e`)

---

## 1. 작업 내용 요약

프로젝트/그룹처럼 **작업(티켓)도 우클릭으로 삭제**할 수 있게 하고, **작업 상세 오버레이에 삭제 버튼**을 추가했다 (사용자 요청).

삭제 진입점 3곳 — 작업 티켓이 노출되는 모든 위치를 커버:

| 위치 | 방식 |
|---|---|
| 프로젝트 상세 · 백로그 항목 | 우클릭 → `작업 삭제` |
| 프로젝트 상세 · 보드 카드 | 우클릭 → `작업 삭제` |
| 내 작업 · 백로그 항목 | 우클릭 → `작업 삭제` |
| 작업 상세 오버레이 | 사이드 패널 하단 `작업 삭제` 버튼 (삭제 후 자동 닫힘) |

### 삭제 대상 확인

요청에 대상이 명시되지 않아 사용자에게 확인 → **작업(티켓)** 선택. 단계 삭제는 이번 범위에서 제외.

## 2. 구현 — API 경계 컨벤션 준수

```
UI → boardActions.deleteTask → deleteTaskApi → DELETE /api/admin/tasks/[taskId] → deleteTask(service) → Prisma
```

| 계층 | 변경 |
|---|---|
| `server/workspace/service.ts` | `deleteTask(id)` 추가 (`deleteGroup`/`deleteProject`와 동일 형태의 `deleteMany`) |
| `app/api/admin/tasks/[taskId]/route.ts` | `DELETE` 핸들러 추가 — 기존 PATCH와 같은 인증 가드 |
| `lib/api/workspace.ts` | `deleteTaskApi` 추가 (`api.del`) |
| `components/.../board-store.tsx` | `deleteTask(projectId, taskId)` — 낙관적 제거(백로그·모든 단계에서) 후 API 저장 |

## 3. 주요 결정

| 항목 | 결정 | 이유 |
|---|---|---|
| 권한 | 로그인 사용자면 삭제 가능 (MASTER 제한 없음) | 그룹/프로젝트 삭제는 MASTER 전용이지만, 작업은 스탭도 자기 업무를 정리해야 함. 필요해지면 가드만 바꾸면 됨 |
| 확인 대화상자 | 없음 (즉시 삭제) | 프로젝트/그룹 삭제와 동일한 노션식 UX (docs/5에서 확립한 방침) |
| 낙관적 갱신 | 백로그·전 단계에서 동시에 제거 | 작업이 어디 있든(백로그/단계) 한 액션으로 처리 — 호출부가 위치를 몰라도 됨 |
| 상세 오버레이 | 삭제 후 `onClose()` 호출 | 삭제된 작업의 상세를 열어둘 수 없음 |
| 내 작업 백로그 포함 | 포함 | 같은 티켓이 두 화면에 노출되는데 한쪽만 삭제 가능하면 일관성이 깨짐 |

## 4. 변경 파일 내역

| 구분 | 파일 | 내용 |
|---|---|---|
| 수정 | `src/server/workspace/service.ts` | `deleteTask` 서비스 |
| 수정 | `src/app/api/admin/tasks/[taskId]/route.ts` | `DELETE` 핸들러 |
| 수정 | `src/lib/api/workspace.ts` | `deleteTaskApi` |
| 수정 | `src/components/features/projects/board-store.tsx` | `deleteTask` 액션 |
| 수정 | `src/components/features/projects/project-backlog.tsx` | 항목 우클릭 컨텍스트 메뉴 |
| 수정 | `src/components/features/projects/project-board.tsx` | 카드 우클릭 컨텍스트 메뉴 |
| 수정 | `src/components/features/my-work/my-work-backlog.tsx` | 항목 우클릭 컨텍스트 메뉴 |
| 수정 | `src/components/features/projects/task-detail-overlay.tsx` | 사이드 패널 하단 삭제 버튼 |
| 신규 | `docs/43-feat-작업-삭제-우클릭-메뉴-및-상세-삭제-버튼.md` | 이 문서 |

## 5. 검증

`npm run build` ✓ · `npm run lint` ✓ · 브라우저 실로그인(master01), 콘솔 에러 0.

| 시나리오 | 결과 |
|---|---|
| 백로그 3건 생성 | 3/3 ✓ |
| 백로그 항목 우클릭 | 메뉴 `[작업 삭제]` → 즉시 제거 ✓ |
| 상세 오버레이 삭제 버튼 | 버튼 존재 → 클릭 시 **오버레이 닫힘 + 목록에서 제거** ✓ |
| 보드 카드(`PRD`) 우클릭 | 메뉴 `[작업 삭제]` → 제거 ✓ |
| 새로고침 | 삭제분 모두 미복구 = **DB 반영 확인** ✓ |

- 시드 데이터의 `PRD` 카드가 검증 과정에서 삭제됐다. 필요 시 사이드바 하단 「데이터 초기화」로 시드를 복원할 수 있다.

## 6. 알려진 사항 / 후속 과제

- 단계(Stage) 삭제는 미구현 — 보드 컬럼 `⋯` 메뉴와 단계 상세에 같은 방식으로 추가 가능
- 삭제 취소(Undo)/휴지통 없음 — 즉시 영구 삭제. 실사용 데이터가 쌓이면 검토 필요
- 작업 삭제 권한은 현재 전 사용자 — 배정/권한 도메인 확장 시 재검토
