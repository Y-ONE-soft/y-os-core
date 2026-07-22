# 29. 작업 티켓에서 프로젝트 선택 및 백로그 입력 정리

- **예정 커밋 메시지**: `feat: 작업 티켓에서 프로젝트 선택 및 백로그 입력 정리`
- **작업일**: 2026-07-22
- **작업 브랜치**: `티켓-프로젝트-선택` (워크트리 `.claude/worktrees/ticket-project-select`, base: main `b1e666c`)

---

## 1. 작업 요약

직전 태스크(docs/26)에서 내 작업 백로그의 추가 대상 프로젝트를 **입력창 옆 드롭다운**으로 골랐는데, 사용자 피드백에 따라 이를 걷어내고 **프로젝트는 작업 티켓(작업 상세 오버레이) 안에서 선택**하도록 바꿨다. 백로그 목록의 작업 이름도 원래 위치로 되돌렸다.

## 2. 변경 내용

### 2-1. 백로그 패널 정리 (`my-work-backlog.tsx`)

| 항목 | 이전(docs/26) | 이후 |
|---|---|---|
| 추가 행 | 프로젝트 Select + 입력창 | **입력창만** (디자인 147:495 원형) |
| 항목 행 | 체크박스 → **프로젝트 색 점** → 작업 이름 | 체크박스 → **작업 이름** (원래 위치 복귀) |
| 새 작업의 프로젝트 | 드롭다운 선택값 | 첫 프로젝트 백로그로 생성 → **티켓에서 변경** |

### 2-2. 작업 티켓: 프로젝트 Select (`task-detail-overlay.tsx`)

- 세부 사항의 **프로젝트**가 읽기 전용 표시 → **Select**로 전환. 옵션마다 프로젝트 색 점 표시
- 프로젝트를 바꾸면 대상 프로젝트의 **백로그**로 이동한다 (단계는 프로젝트 소속이라 유지 불가)
- **위치 해석 방식 변경**: 오버레이가 `projectId` prop을 신뢰하던 것을 **`taskId`로 전 프로젝트 보드를 훑어 위치(프로젝트·단계)를 직접 찾도록** 바꿨다. 프로젝트를 변경해도 새 위치를 따라가므로 **오버레이가 닫히지 않는다** (prop 방식이면 부모의 projectId가 낡아 즉시 사라짐)
- 이에 따라 `projectId` prop 제거 — 호출부는 `project-board.tsx`, `my-work-backlog.tsx` 2곳

### 2-3. 스토어·API: 프로젝트 이동 지원

| 계층 | 변경 |
|---|---|
| `board-store.tsx` | `moveTaskToProject(from, to, taskId)` 추가 — 출발 보드(단계·백로그)에서 제거하고 대상 보드 백로그에 추가하는 낙관적 업데이트 후 저장 |
| `app/api/admin/tasks/[taskId]/route.ts` | `PATCHABLE`에 `projectId` 추가 |
| `server/workspace/service.ts` | `TaskPatch`에 `projectId` 추가. **`updateTask`에서 projectId가 오면 `stageId`를 항상 null로 강제** — 다른 프로젝트의 단계를 가리키는 정합성 깨진 행을 서버에서 차단 |

스키마 변경 없음 (`Task.projectId`·`stageId`는 이미 존재).

## 3. 변경 파일 내역

| 파일 | 내용 |
|---|---|
| `src/components/features/my-work/my-work-backlog.tsx` | 프로젝트 Select·색 점 제거, 작업 이름 위치 복귀, 티켓 연결을 taskId만으로 |
| `src/components/features/projects/task-detail-overlay.tsx` | 위치 자체 해석, 프로젝트 Select 도입, `projectId` prop 제거 |
| `src/components/features/projects/project-board.tsx` | 오버레이 호출부에서 `projectId` prop 제거 |
| `src/components/features/projects/board-store.tsx` | `moveTaskToProject` 추가 |
| `src/app/api/admin/tasks/[taskId]/route.ts` | `projectId` 패치 허용 |
| `src/server/workspace/service.ts` | `TaskPatch.projectId` + 프로젝트 변경 시 stageId null 강제 |
| `docs/29-…` | 이 문서 |

## 4. 검증

1. `npm run lint` ✓ · `npm run build` ✓
2. **브라우저 시나리오** (puppeteer-core + 캐시 Chrome, `--no-save` 설치라 커밋 영향 없음, dev 3010):
   - 백로그 패널 `{hasProjectSelect: false, 추가행 자식 1개(입력창만)}` ✓
   - 항목 행 구조 `[checkbox, 작업이름 button]` — **색 점 없음, 이름 원래 위치** ✓
   - "프로젝트 개요서" 클릭 → 티켓 `YOS-757 / YOS · 백로그` ✓
   - 프로젝트 Select → "화학강사 김한울 CMS 프로젝트" 선택 → **오버레이 유지된 채** `CMS-757 / 화학강사 김한울 CMS 프로젝트 · 백로그`로 갱신, 단계는 백로그로 리셋 ✓
   - 스크린샷 육안 확인 (프로젝트 Select에 색 점 표시)
   - 티켓에서 YOS로 **원복** 후 `GET /api/admin/workspace`로 `YOS 백로그: 프로젝트 개요서, 서비스 설계서` 확인 — **테스트 데이터 잔여 없음** ✓
   - **콘솔 에러 0건** ✓

## 5. 사후 검증 결과 (추록)

- PR #24 프리뷰 배포 **success** (Vercel 체크 pass): `https://y-os-core-bvw1lrbo1-project-hosting-center.vercel.app`
- 최신 main(`a15947b`) 머지 후 조합 상태 lint·build 재검증 통과. PR #22·#23이 `project-board.tsx`를 함께 수정했으나 자동 병합 성공(그쪽은 컬럼 스크롤 구조, 이쪽은 오버레이 prop 1줄)
- 문서 번호는 PR #23이 28번을 먼저 머지해 **29번으로 조정**(선행 커밋)
- 프로덕션 배포 success 확인(요청 사이클 7단계)은 머지 후 수행해 사용자 보고로 기록

## 6. 알려진 사항 / 후속 과제

- 프로젝트 이동 시 단계가 백로그로 초기화된다 — 대상 프로젝트의 단계를 함께 고르는 UX(2단 선택)는 후속 과제
- 새 백로그 작업이 항상 첫 프로젝트로 생성되는 점은 티켓에서 바꾸는 흐름을 전제로 한 선택
- 담당자(assignee) 도메인이 생기면 내 작업 필터 재정의 필요 (docs/26과 동일)
