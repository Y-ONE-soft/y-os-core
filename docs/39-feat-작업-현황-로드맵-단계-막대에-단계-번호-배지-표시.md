# feat: 작업 현황 로드맵 단계 막대에 단계 번호 배지 표시

## 작업 요약

작업 현황(`/projects`) 로드맵의 **단계 막대**에 내 작업 캘린더와 같은 형태의 **원형 단계 번호 배지**를 추가했다. 막대만 보고도 그 단계가 프로젝트의 몇 번째 단계인지 알 수 있게 하는 것이 목적이다.

## 배경 — "캘린더처럼 숫자"의 정체

내 작업 캘린더([`my-work-calendar.tsx`](../src/components/features/my-work/my-work-calendar.tsx))의 단계 막대에는 단계색 원형 배지 안에 흰 숫자가 들어간다. 이 숫자의 출처는 [`my-work-data.ts`](../src/components/features/my-work/my-work-data.ts)의 `count` 필드인데, 해당 파일은 Figma 시안 기반 **하드코딩 더미 데이터**라 값의 의미가 코드상 명시되어 있지 않았다.

실제 값을 보면 의미가 드러난다.

| label | count |
| --- | --- |
| 착수 | 1 |
| 개발구현 | 2 |
| 통합테스트 | 3 |
| 운영·유지보수 | 4 |
| 프로젝트 정의 (YOS) | 1 |
| 요구사항 분석 (Y.OS CONTENTS) | 1 |

작업 건수가 아니라 **프로젝트 내 단계 순번**이다. 프로젝트가 바뀌면 다시 1부터 시작하는 것도 순번임을 뒷받침한다. 따라서 로드맵에도 작업 수가 아닌 단계 순번을 넣었다.

> 처음에는 `stage.tasks.length`(작업 수)로 해석했으나 사용자 확인을 거쳐 단계 순번으로 확정했다. 로드맵 좌측 라벨의 `done/total`이 이미 작업 수를 담당하고 있어 의미 중복도 피할 수 있다.

## 순번 산출 근거

`stageIndex + 1` (보드 스토어 `stages` 배열의 0-based 인덱스 + 1)로 계산한다. 별도 순번 컬럼은 만들지 않았다.

- `Stage` 모델에는 `order` 컬럼이 없다 ([`prisma/schema.prisma`](../prisma/schema.prisma)).
- 대신 [`src/server/workspace/service.ts:15`](../src/server/workspace/service.ts#L15)의 `const ORDER = [{ createdAt: "asc" }, { id: "asc" }]`로 조회 순서가 **결정적**으로 고정된다. `createdAt` 동률까지 `id`로 tie-break하므로 재조회 시 순서가 흔들리지 않는다.
- 즉 화면 배열 순서 = 단계 생성 순서 = 보드에 표시되는 순서라, 인덱스 기반 순번이 보드·캘린더와 어긋나지 않는다.

**스키마 변경이 없다**는 점이 중요하다. 개발 DB는 전 세션 공유라 마이그레이션은 동시에 한 브랜치만 가능한데, 이 작업은 그 제약에 걸리지 않는다.

## 변경 파일

### `src/components/features/projects/workload-roadmap.tsx` (유일한 변경 파일)

`Bar` 컴포넌트에 선택적 `badge?: number` prop을 추가하고, 단계 막대 호출부에서 `badge={stageIndex + 1}`을 넘긴다.

1. **`Bar` prop 추가** — `badge?: number`. 주석으로 "단계 순번 — 내 작업 캘린더와 같은 원형 배지로 표시" 명시.
2. **배지 마크업** — 캘린더와 동일한 클래스를 그대로 이식했다.
   ```
   flex size-[11px] shrink-0 items-center justify-center rounded-full text-[7.5px] font-medium text-white
   + style={{ backgroundColor: color }}
   ```
   막대는 `overflow-hidden`이라 `shrink-0`이 없으면 좁은 막대에서 배지가 찌그러진다.
3. **`content`를 Fragment로 변경** — 기존에는 라벨 `<span>` 하나였으나 배지 + 라벨 2개 노드가 되어 `<>...</>`로 감쌌다.
4. **패딩 분기** — 배지가 없으면 기존 `pl-2` 유지(프로젝트 전체 막대의 기존 레이아웃 보존), 배지가 있으면 `gap-1 pl-1 pr-1.5`. 문자열 병합이 조건부가 되어 `cn()`으로 감쌌다.
5. **최소 폭 분기** — 기존 `Math.max(days * dayWidth, 26)`에서, 배지가 있을 때는 최소 `32px`. 배지(11) + gap(4) + 좌우 패딩(4+6) = 25px라 26px로는 라벨이 전혀 안 보이고 배지까지 잘릴 수 있다.

배지는 **단계 막대에만** 붙고 프로젝트 전체 막대(`전체 N%`)에는 붙지 않는다. 프로젝트 막대는 순번 개념이 없다.

`stages.map((stage) => ...)`를 `stages.map((stage, stageIndex) => ...)`로 바꿔 인덱스를 확보했다.

## 검증

| 항목 | 결과 |
| --- | --- |
| `npm run lint` | 통과 (경고 없음) |
| `npm run build` | 통과 — `/projects` 정적 프리렌더 포함 전체 라우트 빌드 성공 |
| dev 서버 (`-p 3007`) | Ready 4.2s, 런타임 오류 없음 |
| `/projects` 응답 | 로그인 쿠키 포함 `200` |
| `/api/admin/workspace` | 실데이터 정상 응답 (단계 `startDate`/`endDate`/`showDeadline` 확인) |

## 알려진 이슈 · 후속 판단 필요

- **화면 육안 확인은 미완**. 로드맵은 보드 스토어를 클라이언트에서 fetch한 뒤 렌더되는 CSR 영역이라 SSR HTML에 막대가 포함되지 않는다(`curl`로 받은 `/projects` HTML에 "로드맵" 문자열 0건). 저장소에 Playwright 등 브라우저 자동화 도구가 없고, 육안 확인만을 위해 의존성을 추가하는 것은 "새 의존성 추가는 신중하게" 규약에 어긋난다고 판단해 설치하지 않았다. **배지 렌더 형태는 사용자 검토 및 프리뷰 배포에서 확인**하고, 확인 결과는 이 문서에 "사후 검증 결과 (추록)"으로 보완한다.
- **날짜 없는 단계에는 번호가 보이지 않는다.** 막대는 `stage.showDeadline && stage.startDate`일 때만 렌더되므로(기존 동작), 기간이 안 잡힌 단계는 번호도 함께 사라진다. 모든 단계에 번호를 노출하려면 좌측 라벨 컬럼(단계명 옆)에도 번호를 넣어야 하는데, 이번에는 "캘린더처럼"이라는 요청에 맞춰 **막대에만** 넣었다. 좌측 라벨에도 필요하면 후속 태스크로 분리한다.
- **좁은 배율에서 가독성.** `분기` 배율은 `dayWidth: 2.4px`라 짧은 단계는 최소폭 32px에 걸려 배지만 겨우 보이고 라벨은 잘린다. 기존에도 26px 최소폭에서 같은 성질이었고 배지 쪽이 오히려 식별에 유리해 별도 대응은 하지 않았다.

## 병렬 작업 메모

- 베이스: `236e3f0` (PR #27 `내-작업-프로젝트-박스-레이아웃` 머지 직후 origin/main).
- 같은 작업 현황 페이지를 건드리는 `작업-현황-작업버튼-제거` 브랜치가 진행 중이다. 다만 그쪽은 [`task-status-page.tsx`](../src/components/features/projects/task-status-page.tsx)의 버튼이 대상으로 보이고 이 커밋은 [`workload-roadmap.tsx`](../src/components/features/projects/workload-roadmap.tsx) 단일 파일만 바꿔 충돌 가능성은 낮다. 머지 순서에 따라 리베이스로 대응한다.
- 참조 대상인 내 작업 캘린더는 `내-작업-프로젝트-박스-레이아웃`에서 개편됐으나(PR #27), 본 작업은 배지 **스타일만 이식**하고 해당 파일은 수정하지 않았다.
- 문서 번호: 병렬 브랜치에 미커밋 `31`·`32`가 존재해 충돌 시 나중 머지 쪽이 번호를 올린다.

## 사후 검증 결과 (추록)

푸시 이후 확정된 내용을 보완한다.

- **PR**: [#34](https://github.com/Y-ONE-soft/y-os-core/pull/34)
- **최종 커밋**: `9ce927f` (최신 main `ebc05e7` 리베이스 후 해시 변경, 리베이스 전 `26c63fe`)
- **문서 번호**: 병렬 브랜치가 33~38을 먼저 점유해 `33 → 39`로 조정했다 (커밋 `56c71a2`).
- **프리뷰 배포**: Vercel 체크 `pass`, `mergeable: MERGEABLE / CLEAN`.
- **육안 확인은 프리뷰로도 불가.** 프리뷰 URL(`.../projects`)이 `302`로 SSO 리다이렉트된다. 게다가 한글 브랜치라 별칭이 `y-os-core-git-project-hosting-center`로 뭉뚱그려져 다른 브랜치 배포를 가리킬 수 있다. 배지 렌더 형태 확인은 **로컬 dev 서버 또는 머지 후 프로덕션**에서 해야 한다.
