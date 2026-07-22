# 26. 내 작업 백로그 통합 및 작업 상세 연결

- **예정 커밋 메시지**: `feat: 내 작업 백로그 통합 및 작업 상세 연결`
- **작업일**: 2026-07-22
- **작업 브랜치**: `내-작업-백로그-연결` (워크트리 `.claude/worktrees/my-work-backlog`, base: main `f8a89d5`)

---

## 1. 작업 요약

내 작업 페이지(docs/21) 우측 패널을 **자리표시 로컬 목록 → 실데이터 백로그**로 교체하고, 항목 클릭 시 **작업 상세 오버레이**가 열리도록 연결했다. 데이터 원본은 프로젝트 상세의 백로그와 **동일한 보드 스토어(DB)** 다.

부수적으로 **작업 상세 오버레이가 백로그 작업을 지원하지 못하던 제약**을 해소했다 — 기존에는 단계에 편성된 작업만 열렸고 백로그 작업 id로 열면 `return null`이라 아무 반응이 없었다.

## 2. 변경 내용

### 2-1. 우측 패널: 내 작업 → 백로그 (`my-work-aside.tsx` → `my-work-backlog.tsx`)

| 항목 | 이전 | 이후 |
|---|---|---|
| 제목 | "내 작업" + 로컬 카운트 | **"백로그"** + 실제 항목 수 |
| 데이터 | `MY_TASKS_SEED` 자리표시 10건, `useState` 로컬 | **보드 스토어(DB)** — 전 프로젝트 백로그 통합 |
| 추가 | 로컬 배열에 push | `boardActions.addBacklogTask` (DB 저장) |
| 완료 토글 | 로컬 state | `boardActions.toggleTask(projectId, null, taskId)` (DB 저장) |
| 항목 클릭 | 없음 | **작업 상세 오버레이 열기** |
| 프로젝트 표시 | 없음 | 항목마다 프로젝트 색 점(title=프로젝트명) |

**전 프로젝트 통합인 이유**: 내 작업 페이지는 프로젝트 스코프가 없고, `BoardTask`에 담당자(assignee) 필드가 없어 사용자 기준 필터가 불가능하다. 따라서 통합 백로그가 유일한 정합적 해석 — 사용자 확인 완료.

**추가 입력창의 대상 프로젝트**: 통합 뷰라 대상이 모호하므로 입력창 왼쪽에 **프로젝트 선택 드롭다운**을 두고 거기로 추가한다(기본값 = 첫 프로젝트). 사용자 선택 사항이며, 디자인(147:495)에는 없는 UI다.

### 2-2. 작업 상세 오버레이: 백로그 작업 지원 (`task-detail-overlay.tsx`)

- 작업 조회를 `stages`에서만 찾던 것을 **`stages` → 없으면 `backlog`** 순으로 확장, 가드에서 `!stage` 조건 제거
- `stageId = stage?.id ?? null`, `stageLabel = stage?.name ?? "백로그"` 파생값 도입 후 토글·내용 수정·헤더 브레드크럼에 적용
- 세부 사항의 **단계 Select에 "백로그" 옵션 추가** — 선택하면 백로그 ↔ 단계 이동. Radix Select는 빈 문자열 값을 허용하지 않아 센티널 `__backlog__` 사용

### 2-3. 보드 스토어: `moveTask` 백로그 지원 (`board-store.tsx`)

`moveTask(projectId, fromStageId, toStageId, taskId)`의 stage 인자를 `string` → **`string | null`** 로 넓혀 백로그(=null)를 출발지·목적지로 다룬다. 낙관적 업데이트도 백로그 배열 가감을 포함하도록 재작성. 서버는 이미 `TaskPatch.stageId: string | null`을 지원해 **API·스키마 변경 없음**.

## 3. 변경 파일 내역

| 구분 | 파일 | 내용 |
|---|---|---|
| 이름변경+수정 | `my-work-aside.tsx` → `my-work-backlog.tsx` | `MyWorkAside` → `MyWorkBacklog`, 통합 백로그·프로젝트 선택·상세 연결 |
| 수정 | `my-work-page.tsx` | import·사용처 교체 |
| 수정 | `my-work-data.ts` | 미사용이 된 `MY_TASKS_SEED` 제거 |
| 수정 | `task-detail-overlay.tsx` | 백로그 작업 지원 (조회·가드·브레드크럼·단계 Select) |
| 수정 | `board-store.tsx` | `moveTask` 백로그(null) 지원 |
| 신규 | `docs/26-…` | 이 문서 |

## 4. 검증

1. `npm run lint` ✓ · `npm run build` ✓
2. **API 왕복** (dev 3009, master01 세션):
   - `GET /api/admin/workspace` — 통합 백로그 2건(YOS: 프로젝트 개요서·서비스 설계서) 확인
   - `PATCH /api/admin/tasks/bk-overview {stageId:"st-define"}` → 200, 백로그 1건·단계 3건으로 이동 확인
   - `PATCH … {stageId:null}` → 200, 백로그 2건으로 **원상 복구** (테스트 데이터 잔여 없음)
3. **브라우저 시나리오** (puppeteer-core + 캐시된 Chrome, `--no-save`로 설치해 커밋 영향 없음):
   - 우측 패널 `{title:"백로그", count:"2", hasProjectSelect:true}` ✓
   - 백로그 항목 "프로젝트 개요서" 클릭 → 오버레이 열림 ✓
   - 오버레이 `{키: YOS-757, 브레드크럼: "YOS · 백로그", 단계 Select: "백로그", 섹션: 내용·산출물·연결 티켓·위키·댓글}` ✓
   - **콘솔 에러 0건** ✓
   - 스크린샷 육안 확인 — 세부 사항의 프로젝트(YOS 보라 점)·단계(백로그) 정상

## 5. 사후 검증 결과 (추록)

- PR #21 프리뷰 배포 **success** (Vercel 체크 pass): `https://y-os-core-e98roal58-project-hosting-center.vercel.app`
- 최신 main(`68a77b0`, PR #20 로드맵 범위 스위처) 머지 후 조합 상태에서 lint·build 재검증 통과 — 두 PR은 파일이 겹치지 않음(`roadmap-window.ts`/`workload-roadmap.tsx` vs 백로그·오버레이)
- 프로덕션 배포 success 확인(요청 사이클 7단계)은 머지 후 수행해 사용자 보고로 기록

## 6. 알려진 사항 / 후속 과제

- 백로그 → 캘린더 드래그 일정 지정은 여전히 미구현(문구만) — 별도 요청 단위
- 담당자(assignee) 도메인이 생기면 "내 작업"을 사용자 기준으로 필터링하도록 재정의 필요. 현재는 전 프로젝트 통합
- 오버레이의 작업 유형·난이도·산출물·댓글은 여전히 로컬 state 자리표시 (docs/19 범위 그대로)
- `moveTask` 시그니처가 넓어졌지만 호출부는 오버레이 1곳뿐이라 영향 없음
