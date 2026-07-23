# feat: 단계 상세에서 단계명 수정 가능하게

- **예정 커밋 메시지**: `feat: 단계 상세에서 단계명 수정 가능하게`
- **작업일**: 2026-07-23
- **작업 브랜치**: `단계-이름-수정` (워크트리 `.claude/worktrees/stage-name-edit`)

---

## 1. 작업 내용 요약

단계 상세 오버레이의 **제목이 읽기 전용 텍스트라 단계명을 고칠 수 없던 것**을, 편집 가능한 입력으로 바꿨다.

기존에는 `<DialogTitle>{stage.name}</DialogTitle>` 정적 텍스트였다. 그 아래 내용·기간·데드라인은 모두 편집되는데 이름만 못 고쳤다. 스토어(`updateStage`)와 API(`PATCH /api/admin/stages/[id]`)는 이미 `name`을 받고 있었으므로 **UI만 없던 상태**였다 — 화면 입력만 붙이면 됐다.

## 2. 변경 파일 내역

| 구분 | 파일 | 내용 |
|---|---|---|
| 수정 | `src/components/features/projects/stage-detail-overlay.tsx` | 제목을 편집 `Input`으로 교체, sr-only `DialogTitle` 유지 |
| 추가 | `docs/126-feat-단계-상세에서-단계명-수정-가능하게.md` | 본 문서 |

## 3. 구현 방식

바로 아래 **내용(description) 필드와 동일한 패턴**을 그대로 따랐다 — 비제어 입력(`defaultValue` + `key={stage.id}`)에 `onBlur`로 커밋.

- **접근성**: Radix Dialog는 `DialogTitle`을 요구한다. 화면용 제목은 `Input`으로 두고, 실제 타이틀은 `<DialogTitle className="sr-only">`로 유지했다 (단계 추가 오버레이와 같은 방식).
- **저장 시점**: `onBlur` — 포커스가 벗어날 때. Enter는 `onKeyDown`에서 `blur()`를 불러 같은 경로로 커밋한다.
- **빈 이름 방지**: 공백만 남기고 나가면 저장하지 않고 입력을 원래 이름으로 되돌린다.
- **변경 없으면 저장 안 함**: 값이 그대로면 `patch`를 부르지 않는다.
- **스타일**: 단계 추가 오버레이의 이름 입력과 동일(`h-auto border-0 px-0 py-0 text-[30px] leading-tight font-semibold`). 완료 상태면 취소선(`line-through`)도 그대로 적용.

## 4. 검증

`npm run lint` ✓ · `npx tsc --noEmit` ✓ · `npm run build` ✓

**브라우저 실검증** — dev 서버(워크트리 전용 포트 3062, 점유 프로세스 확인), 실제 로그인(`master01`), 임시 프로젝트·단계로 확인.

| # | 검증 | 결과 |
|---|---|---|
| 1 | 제목이 편집 입력으로 렌더 | `input[aria-label="단계명"]`, 초기값 = 단계명 |
| 2 | 이름 변경 후 blur | `PATCH {"name":"ProbeRenamed"}` 전송 → 서버 단계명 갱신 확인 |
| 3 | 공백만 입력 후 blur | 저장 안 함(PATCH 0), 입력이 원래 이름으로 복원 |
| 4 | 대조 — 내용 필드 | 같은 방식으로 저장됨(동일 onBlur→patch 경로) |

## 5. 검증 노트 (재현 시 함정)

이번 검증은 헤드리스 puppeteer의 포커스 처리 때문에 애를 먹었다. 남겨둔다.

- **Radix Dialog 안 입력의 마우스 클릭이 포커스를 훔친다.** `page.mouse.click(input좌표)`가 입력이 아니라 헤더의 `닫기` 버튼으로 focusin을 일으켰다 — Radix 포커스 트랩이 "포커스 불가 영역 클릭"으로 보고 되돌린 것. `elementFromPoint`는 입력을 가리키는데도 그랬다.
- **`ElementHandle.focus()`로 포커스는 되지만, 이어지는 `page.keyboard.type`이 입력에 안 들어갔다** (값이 원본 그대로). 그래서 "값이 안 바뀜 → onBlur는 발화하나 patch 없음"으로 오인하기 쉬웠다.
- 확정 방법: `onBlur`(= React가 위임 처리하는 `focusout`)에 대해, **네이티브 value setter로 값을 바꾸고 `focusout`을 직접 디스패치**하니 `PATCH {"name":...}`가 나가고 서버에 저장됐다. `focusout:단계명`이 이벤트 로그에 찍혀 **onBlur 자체는 정상 발화**함을 먼저 확인한 뒤였다.

즉 실패는 전부 테스트 도구의 포커스 아티팩트였고, 컴포넌트 로직(내용 필드와 동일)은 정상이다.

## 6. 알려진 사항 / 후속 과제

- **할일 상세도 제목이 읽기 전용이다** — 같은 방식으로 편집 가능하게 만들 수 있으나, 이번 요청 범위(단계)에 맞춰 손대지 않았다.
- 보드 컬럼 헤더의 단계명은 여전히 정적 텍스트다 — 인라인 리네임(더블클릭 등)은 넣지 않았다. 이름 수정 진입점은 단계 상세로 일원화한다.
