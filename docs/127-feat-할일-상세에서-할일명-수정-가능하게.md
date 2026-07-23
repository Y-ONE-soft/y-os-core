# feat: 할일 상세에서 할일명 수정 가능하게

- **예정 커밋 메시지**: `feat: 할일 상세에서 할일명 수정 가능하게`
- **작업일**: 2026-07-23
- **작업 브랜치**: `할일-이름-수정` (워크트리 `.claude/worktrees/task-name-edit`)

---

## 1. 작업 내용 요약

할일 상세 오버레이의 **제목이 읽기 전용이라 할일명을 고칠 수 없던 것**을 편집 가능한 입력으로 바꿨다. 단계 상세에 이미 적용한 것(docs/126)과 같은 방식이다.

스토어 `updateTask`와 API(`PATCH /api/admin/tasks/[id]`)는 이미 `name`을 받고 있어 UI만 붙였다.

## 2. 변경 파일 내역

| 구분 | 파일 | 내용 |
|---|---|---|
| 수정 | `src/components/features/projects/task-detail-overlay.tsx` | 제목을 편집 `Input`으로 교체, sr-only `DialogTitle` 유지 |
| 추가 | `docs/127-feat-할일-상세에서-할일명-수정-가능하게.md` | 본 문서 |

## 3. 구현 방식

docs/126(단계명)과 동일하다 — 바로 아래 내용(description) 필드와 같은 비제어 입력 + `onBlur` 커밋.

- Radix `DialogTitle`은 sr-only로 유지(접근성), 화면 제목은 `Input(aria-label="할일명")`
- blur 시 저장, Enter는 `blur()`로 같은 경로
- 공백만 남기면 저장 안 하고 원래 이름으로 복원, 변경 없으면 미저장
- 저장은 `boardActions.updateTask(projectId, stageId, task.id, { name })` — 내용 필드가 쓰는 것과 같은 액션
- 스타일·완료 취소선은 단계 상세 제목 입력과 동일

## 4. 검증

`npm run lint` ✓ · `npx tsc --noEmit` ✓ · `npm run build` ✓

**브라우저 실검증** — dev 서버(워크트리 전용 포트 3063, 점유 프로세스 확인), 실제 로그인(`master01`), 임시 프로젝트·단계·할일로 확인.

| # | 검증 | 결과 |
|---|---|---|
| 1 | 제목이 편집 입력으로 렌더 | `input[aria-label="할일명"]`, 초기값 = 할일명 |
| 2 | 이름 변경 후 blur | `PATCH {"name":"RenamedTask"}` → 서버 할일명 갱신 확인 |
| 3 | 공백만 입력 후 blur | 저장 안 함(PATCH 0), 입력이 원래 이름으로 복원 |

검증 방식은 docs/126의 노트를 따랐다 — headless에서 마우스 클릭/`keyboard.type`이 Radix 다이얼로그 포커스와 충돌하므로, 값 setter로 변경 후 `focusout`을 직접 디스패치해 확인했다.

## 5. 알려진 사항

- 보드 카드의 할일명은 여전히 정적 텍스트다 — 인라인 리네임은 넣지 않고, 이름 수정 진입점을 할일 상세로 일원화한다(단계와 동일 방침).
