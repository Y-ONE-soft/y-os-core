# 43. 단계 추가 대형 오버레이 전환

- **예정 커밋 메시지**: `feat: 단계 추가 대형 오버레이 전환`
- **작업일**: 2026-07-22
- **작업 브랜치**: `단계-추가-오버레이` (워크트리 `.claude/worktrees/stage-add-overlay`, base: main `9f86883` → 작업 중 `401235e` 반영)

---

## 1. 작업 내용 요약

단계 추가 시 뜨던 **작은 다이얼로그(480px)** 를, Figma **Stage Detail Overlay**(`130:414`)와 같은 레이아웃의 **대형 오버레이 생성 모드**로 교체했다. 사용자 요청 — "단계 추가시 팝업을 Stage Detail Overlay 참고해서 만들어달라".

| | 변경 전 (StageAddDialog) | 변경 후 (StageAddOverlay) |
|---|---|---|
| 크기 | 480px 다이얼로그 | **1280 × 87dvh** (상세 오버레이와 동일) |
| 구조 | 세로 폼 1단 | **좌: 제목·내용·산출물·연결·댓글 / 우: 세부 사항 330px 패널** |
| 입력 항목 | 단계명, 시작일, 종료일, 데드라인 토글, 공동작업자(자리표시) | 단계명, **내용(설명)**, 시작일, 종료일, 데드라인 토글, **공동 작업자 지정 요청(실동작)** |
| 액션 | 하단 취소/추가 | 우측 패널 하단 추가/취소 (상세의 "즉시 저장" 안내 자리) |

생성 전에는 성립할 수 없는 영역(**산출물·연결 티켓·위키·댓글**)은 디자인의 자리는 유지하되 *"단계를 만든 뒤 …할 수 있습니다"* 안내로 대체했다.

## 2. 구현 방식

### 생성 시 상세 필드 저장 — 서버 변경 없이

생성 API(`POST /api/admin/stages`)는 `name·color·startDate·endDate·showDeadline`만 받는다. 새로 입력받는 **내용(description)·공동작업자(requestedCollaborators)** 는 이미 `PATCH /api/admin/stages/[stageId]`가 지원하므로, **생성 직후 patch로 이어 저장**하는 방식을 택했다.

- `boardActions.addStage()`가 **생성된 단계 id를 반환**하도록 1줄 변경 (기존 호출부 영향 없음)
- 오버레이는 `addStage()` → (내용·공동작업자가 있으면) `updateStage()` 순으로 호출
- **서버 코드·스키마 무변경** — 마침 다른 세션들이 `src/server/workspace/service.ts`를 활발히 수정 중이라 충돌 위험을 피한 선택이기도 하다

### 그 외 결정

| 항목 | 결정 | 이유 |
|---|---|---|
| 완료 체크박스 | 표시하되 `disabled` | 상세와 레이아웃을 맞추되, 생성 시점에 완료 상태는 의미 없음 |
| 제목 | 큰 `Input`(border 없음, text-2xl bold) | 상세의 제목 타이포를 그대로 유지하면서 입력 가능하게 |
| a11y | `DialogTitle`을 `sr-only`로 별도 제공 | 제목이 input이라 Radix 요구사항(접근 가능한 다이얼로그 이름)을 충족시키기 위함 |
| 유효성 | 단계명 필수, 종료일 < 시작일이면 오류 문구 + 추가 비활성 | 기존 다이얼로그 규칙 승계 |
| 기존 파일 | `stage-add-dialog.tsx` **삭제** | 사용자가 "교체" 선택 — 진입점 3곳 모두 새 오버레이를 연다 |

## 3. 변경 파일 내역

| 구분 | 파일 | 내용 |
|---|---|---|
| 신규 | `src/components/features/projects/stage-add-overlay.tsx` | 대형 생성 오버레이 (상세 오버레이 레이아웃의 생성 모드) |
| 삭제 | `src/components/features/projects/stage-add-dialog.tsx` | 기존 480px 다이얼로그 (참조 0건 확인 후 제거) |
| 수정 | `src/components/features/projects/board-store.tsx` | `addStage`가 생성 id 반환 (`: string`) |
| 수정 | `src/components/features/projects/project-detail-page.tsx` | `StageAddDialog` → `StageAddOverlay` 교체, `projectName·projectColor` 전달 |
| 신규 | `docs/43-feat-단계-추가-대형-오버레이-전환.md` | 이 문서 |

## 4. 검증

1. `npm run lint` ✓ · `npm run build` ✓ (Next.js 16.2.11) — 최신 main 반영 후 재확인
2. **브라우저 검증** (puppeteer, master01 실로그인, dev 3011, `/projects/p-yos`) — **자동 체크 20건 ALL PASS**
   - 레이아웃: 오버레이 1280×87dvh · 우측 패널 **330px(상세 오버레이 실측과 동일)** · 헤더 `단계 / YOS · 로드맵` · 세부 사항(프로젝트·시작일·종료일·공동작업자·데드라인) · 산출물/연결/댓글 자리 유지
   - 유효성: 단계명 비었을 때 `추가` 비활성 ✓
   - 동작: 보드 점선 컬럼 → 오버레이 → 입력 → `추가` → **`POST /api/admin/stages` 200** + **`PATCH …/stages/{id}` 200** → 오버레이 닫힘 → 보드 컬럼 +1
   - 영속화: **새로고침 후 유지** ✓ → 해당 단계의 상세 오버레이를 열어 **내용·시작일·종료일이 그대로 저장됨** 확인 ✓
   - 페이지 에러 0 ✓
3. 스크린샷 대조 — Figma 130:414와 구조 일치 확인
4. 검증으로 생성된 단계는 DB에서 삭제(잔여 0건 확인)

### 검증 방법론 교훈 2건

- **Radix 열림 애니메이션(zoom-in-95) 중에는 크기를 재면 안 된다** — 처음 측정에서 오버레이 1230px·패널 317px로 나와 레이아웃 불일치로 오인했다. 실제로는 애니메이션 중간 배율(0.96)이 그대로 찍힌 것(1230/1280 = 317/330 = 0.961). 오픈 후 **700ms 대기 뒤 측정**으로 해결
- **`page.type()`은 `<input type="date">`에 값을 넣지 못한다** — React `onChange`가 걸리지 않아 기간이 빈 채로 생성되어 "기간 저장 실패"로 오인했다. 네이티브 setter + `input` 이벤트 디스패치로 교체하고, **입력 반영 자체를 검증 항목으로 추가**했다

## 5. 알려진 사항 / 후속 과제

- **산출물 업로드·티켓/위키 연결·댓글은 생성 후에만 가능** — 생성 모드에서는 안내 문구만 노출한다. 상세 오버레이에서도 산출물·연결은 아직 시각 요소(docs/17)이므로 실기능은 별도 태스크
- 생성 직후 상세 오버레이로 이어가는 흐름은 넣지 않았다 — `onCreated` 콜백은 열어 두었으니 필요 시 한 줄로 연결 가능
- 내용·공동작업자를 입력한 경우 요청이 2회(POST + PATCH) 나간다. 생성 API가 해당 필드를 받도록 확장하면 1회로 줄일 수 있으나, 서버 파일 동시 수정 충돌을 피하려 이번 범위에서는 제외했다

## 6. 병렬 작업 (CLAUDE.md 규칙 1·4)

- 착수 전 `git worktree list`·`gh pr list` 확인 — 진행 중 4개 세션과 **파일 겹침 없음**(백로그·내 작업·작업 현황 로드맵 계열), DB 스키마 변경 없음
- 머지 직전 최신 main(`401235e`, 9커밋) 반영 후 lint·build 재확인. 유입 변경은 `project-backlog.tsx`·`roadmap-*`·`workload-roadmap.tsx`로 본 태스크와 무관
- docs 번호: main 최대 42 → **43** 사용
