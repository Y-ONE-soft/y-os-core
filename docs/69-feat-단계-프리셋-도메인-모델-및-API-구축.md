# 69. feat: 단계 프리셋 도메인 모델 및 API 구축

## 작업 요약

프로젝트의 **단계·할일 구성을 통째로 담는 개인용 템플릿**(단계 프리셋) 도메인을 만들었다. 모델 3테이블 + 마이그레이션 + 서비스 + Route Handler + 프론트 API 모듈까지, 화면 없이 데이터 계층만 완성한다.

Figma 기준: `Vmv6OlcsEHpHnf5vNDVDoX` (jimmy-design-system) — Preset Save · New `161:511`, Overwrite `161:1573`, 새 프로젝트 시작 `166:921`, 프리셋 관리 목록 `193:1696`.

## 설계 결정

### 프리셋이 담는 것

| 담는다 | 담지 않는다 |
| --- | --- |
| 단계 이름·색·순서 | 실제 날짜 (상대 오프셋으로 변환) |
| 각 단계의 할일 이름·순서 | 완료 여부, 설명, 댓글, 협업 요청 |

근거는 저장 다이얼로그 문구 "현재 단계와 할 일 구성이 그대로 저장됩니다"와 요약 "단계 3개 · 할 일 6개".

### 상대 일정으로 저장

실제 날짜 대신 **기준일 기준 오프셋**을 담는다. 기준일 = 저장 시점 그 프로젝트에서 **시작일이 있는 단계 중 가장 이른 날**. 하나도 없으면 모든 오프셋이 null.

적용할 때 시작일을 지정하면 같은 간격·길이로 재현된다. (적용은 태스크 3 — 이번 범위 밖)

```
저장 (기준일 07-06)                     적용 (시작일 09-01)
프로젝트 정의  07-06~07-17  off 0  dur 12   →  09-01~09-12
서비스 시스템 설계 07-18~07-23  off 12 dur 6  →  09-13~09-18
```

날짜가 없던 단계는 `offsetDays = null`로 저장돼 적용 후에도 날짜 없이 생성된다. 종료일이 없던 단계는 `durationDays = null`로 열린 막대 그대로다.

### 개인용

`ownerId` 필수. 목록·상세·덮어쓰기·삭제 모두 **세션 사용자 것만** 다룬다. 서비스 쿼리에 `ownerId`를 함께 걸어, 남의 프리셋 id로 요청해도 404로 떨어진다(403이 아닌 404 — 존재 여부 자체를 노출하지 않는다).

이름 중복은 `@@unique([ownerId, name])`로 **사용자 안에서만** 막는다. 덮어쓰기 모드가 이름으로 대상을 고르는 흐름이라 같은 사람 안에서 중복되면 모호해진다.

### 스냅샷은 서버가 만든다

클라이언트는 `projectId`만 보내고, 서버가 DB에서 단계·할일을 읽어 복제한다. 클라이언트가 구성 배열을 통째로 올리는 방식은 payload가 크고 신뢰 경계가 흐려진다.

## 변경 파일

### `prisma/schema.prisma` + `prisma/migrations/20260722093403_add_stage_preset/`

`StagePreset` / `StagePresetStage` / `StagePresetTask` 3테이블 추가. `User.stagePresets` 역참조 1줄 외에 **기존 테이블은 건드리지 않는 순수 추가**다.

- id 접두사 `ps-` / `pss-` / `pst-` (기존 `g-`·`p-`·`st-`·`tk-` 관례)
- `onDelete: Cascade` — 프리셋을 지우면 단계·할일이 함께, 사용자가 지워지면 프리셋이 함께 지워진다
- `@@unique([ownerId, name])`, `@@index([ownerId])`, 자식 테이블에 `@@index([presetId])`·`@@index([stageId])`

### `src/types/preset.ts` (신규)

`PresetTask`·`PresetStage`·`PresetSummary`·`PresetDetail`. 프론트와 서버가 공유하는 표현형이며, DB의 `null`을 `undefined`로 바꿔 노출한다(기존 `BoardStage` 관례와 동일).

### `src/server/presets/service.ts` (신규)

- `snapshotProject()` — 프로젝트 단계·할일을 상대 일정으로 변환. 기준일 산출과 오프셋 계산이 여기 한 곳에 모여 있다
- `listPresets` / `getPreset` / `createPresetFromProject` / `overwritePresetFromProject` / `deletePreset`
- `DuplicatePresetNameError`(→409) · `PresetNotFoundError`(→404) 도메인 에러
- 날짜 계산은 `Date.UTC` 컴포넌트 기반. DB가 `YYYY-MM-DD` 문자열을 쓰는 것과 같은 이유로 TZ가 끼면 하루씩 밀린다
- 덮어쓰기는 `$transaction`으로 단계 삭제 + 재생성을 묶는다 (Cascade로 할일도 함께 정리)

### `src/app/api/admin/presets/route.ts`, `[presetId]/route.ts` (신규)

| 메서드 | 경로 | 응답 |
| --- | --- | --- |
| GET | `/api/admin/presets` | `{ presets }` |
| POST | `/api/admin/presets` | `{ id }` · 이름 중복 409 |
| GET | `/api/admin/presets/[id]` | `{ preset }` · 없거나 남의 것 404 |
| PUT | `/api/admin/presets/[id]` | `{ ok }` — 덮어쓰기 |
| DELETE | `/api/admin/presets/[id]` | `{ ok }` |

핸들러는 얇게 유지하고 처리는 서비스에 위임한다. 인증·400 응답은 기존 `guard.ts` 헬퍼를 그대로 쓴다.

### `src/lib/api/presets.ts` (신규) · `src/lib/api/client.ts`

`fetchPresets`·`fetchPreset`·`createPresetApi`·`overwritePresetApi`·`deletePresetApi`.

공통 래퍼에 **`put`을 추가**했다. 기존에는 `get`/`post`/`patch`/`del`만 있었는데, 덮어쓰기는 부분 수정이 아니라 구성 통째 교체라 PUT이 맞다.

## 검증

```bash
npx prisma validate       # valid
npx prisma migrate dev --name add_stage_preset   # 적용 완료
npx tsc --noEmit          # 통과
npm run lint              # 통과
npm run build             # 성공 — /api/admin/presets, /api/admin/presets/[presetId] 라우트 등록 확인
npm run dev -- -p 3037
```

개발 DB에 실제 요청을 넣어 계약을 확인했다 (`step01` 로그인, 프로젝트 `Y.OS core`).

**상대 일정 변환** — 기준일 `2026-07-06` 기준

| 단계 | 실제 날짜 | 저장된 값 |
| --- | --- | --- |
| 프로젝트 정의 | 07-06~07-17 | `offset 0, duration 12` ✓ |
| 서비스 시스템 설계 | 07-18~07-23 | `offset 12, duration 6` ✓ |
| 날짜기본값 단계 | 07-30~08-07 | `offset 24, duration 9` ✓ |
| 개발 구현 | 07-31~08-19 | `offset 25, duration 20` ✓ |

할일 예정일도 같은 기준으로 `offset 17`(07-23)로 저장됐고, 예정일이 없던 할일은 `undefined`로 나왔다.

**계약**

- 생성 → `{ id: "ps-..." }`, 같은 이름 재생성 → **409**
- 목록 → `단계 4 · 할일 3` 요약 정확
- 덮어쓰기 → `{ ok: true }`, 이름 유지된 채 구성만 갱신(할일 2→3 반영)
- 없는 id → GET·PUT·DELETE 모두 **404**
- **교차 사용자 격리** — `master01` 목록 `[]`, `step01`의 프리셋 id로 GET·DELETE 모두 **404**
- UTF-8 이름 왕복 확인 (`"표준 개발 프로세스"`)

검증에 만든 프리셋 2건은 삭제했고, 개발 DB에는 남기지 않았다.

## 알려진 이슈 / 후속

- **마이그레이션 타임스탬프가 기존 것들보다 앞선다.** `20260722093403`이 `20260722145429`·`20260722160000`·`20260722175530`보다 사전순으로 앞이다(Prisma는 UTC로 이름을 짓는데 기존 일부는 손으로 붙인 이름으로 보인다). 이 마이그레이션은 `User`만 참조하고 `User`는 첫 마이그레이션에서 생기므로 **새 DB에서 순서대로 적용해도 문제가 없다.** 이미 공유 개발 DB에 적용돼 폴더명을 바꾸면 다른 세션에 drift가 생기므로 그대로 둔다.
- **적용(apply) API는 넣지 않았다.** 태스크 3(새 프로젝트 시작 다이얼로그)에서 화면과 함께 붙인다. 지금 넣으면 호출부 없는 죽은 코드가 된다.
- 프리셋 관리 목록(`/projects/presets`, `193:1696`)은 별도 요청 사이클 대상이다.

## 병렬 작업 메모

착수 전 `prisma/schema.prisma` 점유를 확인했다 — 커밋·미커밋 어느 쪽에도 스키마를 만지는 세션이 없어(`detail-overlay-align`·`task-completed-date`의 스키마 작업은 이미 머지 완료) 규칙대로 단독으로 진행했다.

태스크 3의 대상인 `src/components/layout/projects-nav.tsx`는 `project-color-system` 세션이 점유 중이라 이번 PR에서 제외했다.

문서 번호는 착수 시 67까지였으나 작업 중 다른 세션이 68을 선점해 69로 조정했다(66도 두 건 중복돼 있으나 다른 세션 소관이라 건드리지 않았다).
