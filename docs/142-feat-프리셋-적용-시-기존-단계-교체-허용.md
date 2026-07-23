# feat: 프리셋 적용 시 기존 단계 교체 허용

요청 사이클 `프로젝트-기본단계-프리셋-교체`의 2번(마지막) 태스크.

## 배경

"기존에 단계 있으면 프리셋 생성 안 되는데, 그냥 기존 거 다 지우고 프리셋으로 교체될 수 있도록" 요청.

기존에는 프로젝트 상세의 "프리셋 사용하기"가 **단계가 하나도 없는 프로젝트에만** 허용됐다. 서버(`ProjectNotEmptyError`), 화면 버튼(`disabled={hasStages}`), 두 겹으로 막혀 있었다. 게다가 태스크 1에서 **모든 빈 프로젝트에 기본 단계가 생기게 되면서**, 이제 사실상 모든 프로젝트가 "단계 있음" 상태라 프리셋 적용이 영구히 막힌다. 교체를 허용해야 태스크 1과 앞뒤가 맞는다.

## 결정 사항 (사용자 승인)

**기존 단계·할일을 전부 지우고 프리셋으로 교체 + 확인 다이얼로그.** 되돌릴 수 없는 삭제이므로 실행 전 경고를 띄운다.

## 변경 내용

### 1. `src/server/workspace/compose.ts` — `applyPresetToProject`

`ProjectNotEmptyError`와 빈 프로젝트 판정을 제거하고, **기존 구성을 지운 뒤 프리셋을 채우도록** 바꿨다.

```ts
await db.$transaction(async (tx) => {
  // 기존 구성을 전부 지운다. 단계에 속한 할일은 Stage cascade로 지워지지만,
  // 백로그 할일(stageId = null)은 단계에 매이지 않아 별도로 지워야 완전 교체가 된다.
  // 삭제·재생성을 한 트랜잭션에 묶어, 동시 요청이 섞여 중복이 남지 않게 한다.
  await tx.task.deleteMany({ where: { projectId: input.projectId } });
  await tx.stage.deleteMany({ where: { projectId: input.projectId } });
  …
```

**백로그 할일을 별도로 지우는 것이 핵심이다.** 처음엔 `stage.deleteMany`만 했는데, 검증에서 백로그 할일(`stageId=null`)이 그대로 남았다 — 단계에 속하지 않아 cascade가 닿지 않는다. `task.deleteMany({ projectId })`를 먼저 돌려 프로젝트의 **모든** 할일(단계 소속 + 백로그)을 지운다. "기존 거 다 지우고"라는 요청의 "다"가 백로그까지 포함한다.

삭제와 재생성을 한 트랜잭션에 묶어, 동시 요청이 섞여도 중복 단계가 남지 않는다.

`ProjectNotEmptyError` 클래스를 삭제했다.

### 2. `src/app/api/admin/projects/[projectId]/apply-preset/route.ts`

`ProjectNotEmptyError` import와 catch 분기를 제거했다. 상단 주석도 "단계가 없는 프로젝트만" → "기존 단계가 있으면 교체"로 수정했다.

### 3. `src/components/features/projects/project-detail-page.tsx`

"프리셋 사용하기" 버튼의 `disabled={hasStages}`와 안내 title을 제거해 **단계가 있어도 누를 수 있게** 했다.

```tsx
{/* 단계가 있어도 허용 — 적용 시 기존 단계를 지우고 교체한다.
    삭제 경고는 프리셋 적용 다이얼로그가 띄운다. */}
```

`hasStages` 상수는 "프리셋 저장하기" 버튼(`disabled={!hasStages}` — 저장할 구성이 있어야 함)에서 계속 쓰므로 남겼다.

### 4. `src/components/features/presets/preset-apply-dialog.tsx` — 확인

별도 AlertDialog를 겹치는 대신, **이 다이얼로그 자체를 확인창으로** 만들었다. 프리셋 사용하기 버튼 → 이 다이얼로그가 이미 한 단계이므로, 여기에 경고를 얹으면 확인이 자연스럽다.

- `useProjectBoard(projectId)`로 현재 단계 수를 읽어 `willReplace` 판정
- 단계가 있으면 상단에 붉은 경고 배너:
  > 이 프로젝트에는 이미 단계 N개가 있습니다. 적용하면 기존 단계와 할일이 모두 삭제되고 프리셋으로 교체됩니다. 되돌릴 수 없습니다.
- 적용 버튼을 `destructive` variant로, 라벨을 **"교체 적용"** 으로 (빈 프로젝트면 기존대로 "적용")

## 검증

`npm run build` 성공, `npm run lint` 경고 0.

dev 서버(포트 3131)로 API·화면 모두 확인했다. 태스크 1의 검증 프로젝트로 프리셋(단계 2개 + 할일 1개)을 만들어 재료로 썼다.

### API — 완전 교체

단계 있는 프로젝트(기본단계 + 백로그 할일)에 교체 적용:

```
교체 전: 단계 [프로젝트 생성] · 백로그 [덮어써질 백로그 할일]
교체 후: 단계 [프로젝트 생성, 원본 2단계] · 단계 할일 [원본 할일 A] · 백로그 (없음)
→ 기존 전부 삭제 + 프리셋 교체: 정상
```

기존 단계·백로그 할일이 모두 사라지고 프리셋 구성으로 바뀌었다. (첫 시도에서 백로그 할일이 남아 `task.deleteMany`를 추가한 뒤 통과 — 위 "변경 내용" 참고.)

### 화면 (헤드리스 브라우저)

```
프리셋 사용하기 버튼 disabled: false      ← 단계 있어도 활성
경고 배너 표시: true
적용 버튼 라벨: 교체 적용
```

스크린샷으로 붉은 경고 배너와 destructive "교체 적용" 버튼을 확인했다.

### 정리

검증용 프로젝트 2건·프리셋 1건을 삭제했다. 잔여 0건을 DB에서 확인했다.

## 변경 파일 내역

| 파일 | 구분 | 내용 |
|---|---|---|
| `src/server/workspace/compose.ts` | 수정 | `applyPresetToProject`가 기존 단계·할일을 지우고 교체, `ProjectNotEmptyError` 제거 |
| `src/app/api/admin/projects/[projectId]/apply-preset/route.ts` | 수정 | `ProjectNotEmptyError` 참조 제거, 주석 정정 |
| `src/components/features/projects/project-detail-page.tsx` | 수정 | "프리셋 사용하기" 버튼 `disabled={hasStages}` 해제 |
| `src/components/features/presets/preset-apply-dialog.tsx` | 수정 | 단계 있으면 경고 배너 + "교체 적용" destructive 버튼 |

## 알려진 이슈 / 주의점

### 확인이 한 겹이다

이 다이얼로그가 확인창 역할을 하지만, 프리셋을 고르고 "교체 적용"을 누르면 바로 삭제된다. AlertDialog로 한 번 더 묻지는 않는다. 경고 배너가 눈에 띄고 버튼이 destructive라 실수 여지는 낮지만, 데이터 삭제 치고는 마찰이 약한 편이다. 더 확실히 하려면 "교체 적용" 클릭 시 AlertDialog를 한 번 더 띄우면 된다.

### 낙관적 업데이트가 없다

프리셋 적용은 서버 왕복 후 `cache.refresh()`로 갱신한다. 적용~갱신 사이(수백 ms)에는 화면이 옛 단계를 보여준다. 낙관적으로 미리 지우면 실패 시 복구가 번거로워 하지 않았다 — 기존 동작 그대로다.

### 프리셋에 백로그 할일은 담기지 않는다

교체는 프로젝트의 백로그 할일을 지우지만, 프리셋 자체는 단계·단계할일만 담는다(프리셋 도메인 규격). 그래서 교체 후 백로그는 항상 비어 있다. 프리셋에 백로그를 포함하려면 프리셋 스냅샷 구조를 바꿔야 한다 — 이번 범위 밖이다.

### 마스터가 남의 프로젝트에 교체 적용 가능

`applyPresetToProject`는 프로젝트 소유권을 따로 확인하지 않는다(프리셋 소유권만 `getPreset`에서 확인). 기존 동작 그대로이며, 마스터가 전체를 다루는 현재 권한 모델과 일관된다. 스탭 권한을 세분화할 때 함께 볼 부분이다.
