# 139. feat: 직접 만들기 단계 날짜 편집 및 겹침 허용

## 작업 요약

내 할일 > 프로젝트 생성 > **직접 만들기** 모드를 손봤다.

- 미리보기의 단계 날짜를 **읽기 전용 → 단계별 시작·종료일 직접 편집**으로 바꿨다.
- 단계가 **날짜가 겹쳐도** 되게 했다. 예상 단계 수가 기간 일수보다 많아도 막지 않고, 겹치는 단계로 생성한다.

## 기존 동작과 무엇이 바뀌나

기존:
- 기간 드래그 + 예상 단계 수 → 서버가 **균등 분할**로 단계 생성
- 미리보기는 읽기 전용
- 단계 수 > 일수면 `evenSplitError`로 **차단**
- 서버에 `{ startDate, endDate, stageCount }`만 보내고 서버가 다시 쪼갬

바뀐 동작:
- 기간 + 단계 수는 **초기값을 만드는 재료**일 뿐, 실제로 보내는 것은 **편집된 단계 날짜 배열(spans)**
- 각 단계의 시작·종료일을 직접 고칠 수 있다
- 단계 수가 일수보다 많으면 겹치는 단계로 초기값을 만든다(막지 않음)

## 변경 내용

### `src/lib/stage-plan.ts`

- `planStageSpans(start, end, count)` 추가 — 직접 만들기 초기값 생성.
  - 일수 ≥ 단계 수: `splitRangeEvenly`(겹침 없음)
  - 일수 < 단계 수: 하루짜리 단계를 기간에 퍼뜨려 **겹치게** 만든다. 맨 끝 단계는 종료일에 맞추고, 나머지가 겹치더라도 일단 유효한 출발점을 준다(사용자가 뒤이어 고침)
- `stageSpansError(spans)` 추가 — 넘어온 단계 배열 검증. 개수 상한(`MAX_STAGE_COUNT = 50`)·각 구간 `start ≤ end`만 보고 **겹침은 허용**한다
- 기존 `splitRangeEvenly`·`evenSplitError`는 남겨 뒀다 — `planStageSpans`가 균등 분할에 그대로 쓴다

### `src/server/workspace/compose.ts`

- `createProjectWithEvenStages(…stageCount)` → **`createProjectWithStages(…spans)`**. 받은 단계 배열을 그대로 만든다(재분할 없음, 겹침 허용). `stageSpansError`로 방어 검증
- `splitRangeEvenly` import 제거, `stageSpansError`·`StageSpan` import 추가

### `src/app/api/admin/projects/even-stages/route.ts`

- payload를 `{ startDate, endDate, stageCount }` → **`{ spans: {startDate,endDate}[] }`** 로. 각 구간의 날짜 형식(`isISODate`)을 걸러 낸 뒤 `stageSpansError`로 공통 검증. 라우트 경로는 그대로 둬 URL 변화 없음

### `src/lib/api/workspace.ts`

- `createProjectWithEvenStagesApi(…startDate,endDate,stageCount)` → **`createProjectWithStagesApi(…spans)`**

### `src/components/features/projects/project-create-dialog.tsx`

- `spans` 상태 추가. 기간·단계 수를 바꾸면 `planStageSpans`로 재생성(`handleRangeChange`/`handleStageCountChange`), 각 단계는 `editSpan`으로 직접 수정
- 미리보기를 **단계별 `<input type="date">` 두 개(시작·종료)** 로. 겹침 안내 문구 추가
- 제출 조건을 `evenPlan` → `spans.length > 0 && !stageSpansError(spans)`로, 제출은 `spans`를 보낸다
- 균등 분할 전용 `evenPlan` useMemo 제거

## 검증

```bash
npx tsc --noEmit          # 통과 (출력 없음)
npm run lint              # 통과
npm run build             # 성공 — /api/admin/projects/even-stages 라우트 등록 확인
npm run dev -- -p 3073
```

### 개발 서버 API 계약 확인

`step01`로 실제 요청을 넣어 확인했다.

| 시나리오 | 결과 |
| --- | --- |
| **겹치는 단계 3개** (1: 8/1~8/10, 2: 8/5~8/12, 3: 8/10~8/10) | 200, 그대로 저장 ✓ |
| 빈 spans | **400** ✓ |
| start > end 구간 | **400** ✓ |

생성 후 워크스페이스를 다시 읽어 단계가 **겹친 채로** 저장됐음을 확인했다(1단계 8/1~8/10과 2단계 8/5~8/12가 겹침). 검증용 프로젝트는 삭제했다.

**미검증** — 화면의 날짜 입력 편집·초기값 겹침 생성은 프리뷰에서 확인해야 한다. 다이얼로그는 세션·스토어 기반 클라이언트 컴포넌트라 SSR로는 안 보이고, 브라우저 자동화 도구가 없다.

## 알려진 이슈 / 후속

- **기간·단계 수를 다시 바꾸면 편집한 날짜가 재생성돼 초기화된다.** 기간·단계 수는 "생성기"이고 날짜 편집은 그 뒤의 조정이라, 생성기를 다시 돌리면 조정이 사라지는 게 자연스럽다고 봤다. 편집을 보존해야 하면 별도 과제다.
- 단계 이름은 여전히 `1단계`·`2단계`…로 자동 부여된다. 이름 편집은 이번 범위 밖(생성 후 단계 상세에서 바꾼다).

## 병렬 작업 메모

착수 시점 main = `2b197a7`. `project-create-dialog.tsx`·`stage-plan.ts`·`compose.ts`·`even-stages` 라우트를 만지는 세션이 없음을 확인하고 진행했다. 스키마 변경 없음. 문서 번호는 138까지 사용되어 139로 잡았다.
