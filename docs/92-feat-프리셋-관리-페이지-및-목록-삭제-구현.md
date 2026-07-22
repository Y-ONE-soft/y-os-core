# feat: 프리셋 관리 페이지 및 목록·삭제 구현

## 작업 요약

`/projects/presets` 페이지를 만들어 저장한 단계 프리셋을 목록으로 보고 삭제할 수 있게 했다.

프리셋 도메인은 이미 도메인 모델(docs/69)·저장 다이얼로그(docs/70)·UI 규약 정리(docs/78)까지 되어 있었으나 **관리 화면만 없었다.**

## 깨져 있던 링크를 메운다

사이드바에 프리셋 항목이 **이미 있었다.**

```tsx
// projects-nav.tsx:57
{ label: "프리셋", href: "/projects/presets", icon: SlidersHorizontal }
```

그런데 `/projects/presets` 라우트가 없었다. `app/(main)/projects/` 아래에는 `[projectId]`·`my-tasks`·`page.tsx`뿐이라, 이 링크를 누르면 **동적 라우트 `[projectId]`가 "presets"를 프로젝트 id로 받아** 존재하지 않는 프로젝트의 상세 화면이 열렸다. 사실상 깨진 링크였고 이번 작업이 그 자리를 채운다.

`user-menu`의 `프리셋 관리` 드롭다운 항목도 아직 동작이 없다(아래 알려진 이슈 참조).

### RESERVED_SLUGS는 건드리지 않았다

`[projectId]/page.tsx`에는 `RESERVED_SLUGS = new Set(["my-tasks", "analytics"])`가 있어 예약어를 `notFound()`로 넘긴다. `presets`를 여기 넣을지 검토했으나 **넣지 않았다.** Next.js는 정적 세그먼트가 동적 세그먼트보다 우선하므로, 실제 라우트 디렉터리가 생긴 이상 `[projectId]`는 "presets"를 받을 일이 없다. 빌드 산출물에서도 `○ /projects/presets`로 정적 라우트로 잡힌 것을 확인했다.

(`analytics`가 그 목록에 남아 있는 것은 네비 링크만 있고 라우트가 없기 때문이다 — 기존 상태이며 이번 범위 밖이다.)

## 도메인 폴더 규약 준수

docs/78이 **"앞으로 만들 적용 다이얼로그·프리셋 관리 목록도 같은 도메인"** 이라고 못박아 뒀으므로 컴포넌트를 `components/features/presets/`에 두었다.

| 계층 | 위치 |
| --- | --- |
| 라우트 | `app/(main)/projects/presets/page.tsx` (신규) |
| 컴포넌트 | `components/features/presets/preset-list-page.tsx` (신규) |
| 프론트 API | `lib/api/presets.ts` (기존 재사용) |
| API 라우트 | `app/api/admin/presets/` (기존) |
| 서비스 | `server/presets/service.ts` (기존) |

**서버 코드는 한 줄도 건드리지 않았다.** 목록·삭제 모두 기존 엔드포인트로 충분하다.

## 디자인 — 임의 값 없이 기존 선례만

docs/78이 지적한 "Figma px를 그대로 박는" 실수를 반복하지 않도록, 모든 값을 저장소에 선례가 있는 것으로 골랐다.

| 요소 | 값 | 출처 |
| --- | --- | --- |
| 페이지 셸 | `flex h-full min-h-0 flex-col gap-4 px-6 pb-6 pt-5` | `my-work-page.tsx` |
| 제목 | `text-[22px] font-semibold` | `my-work-page.tsx` |
| 부제 | `text-[13px] text-muted-foreground` | `my-work-page.tsx` |
| 목록 행 | `rounded-[8px] border px-3` | 공동 작업자 요약 행 / 저장 다이얼로그 |
| 행 제목 / 메타 | `text-sm font-medium` / `text-xs text-muted-foreground` | 저장 다이얼로그 |
| 빈 상태 | `h-9 rounded-[8px] border border-dashed px-3 text-[13px]` | 저장 다이얼로그의 "저장된 프리셋이 없습니다" |
| 아이콘 버튼 | `size-7 rounded-[8px] hover:bg-accent/60` | 사이드바 버튼 계열 |
| 삭제 확인 | `AlertDialog` + `buttonVariants({ variant: "destructive" })` | `projects-nav.tsx`의 데이터 초기화 |

빈 상태 문구는 저장 다이얼로그와 **의도적으로 같은 톤**으로 맞췄다("저장된 프리셋이 없습니다" + 다음 행동 안내).

## 상호작용

- **삭제** — 아이콘 버튼 → `AlertDialog` 확인 → 낙관적으로 목록에서 제거하고 `deletePresetApi` 호출. 실패하면 에러 문구를 띄우고 서버 목록을 다시 읽어 되돌린다.
- **로딩** — `presets === null`인 동안 `Skeleton` 3줄. 목록 행 높이(57px)에 맞춰 레이아웃이 튀지 않게 했다.
- **빈 상태** — 프리셋이 0개일 때만. 로딩 중과 구분된다.

삭제 확인 문구에 **"이 프리셋으로 이미 만든 프로젝트는 영향을 받지 않습니다"** 를 넣었다. 프리셋은 스냅샷이라 삭제해도 기존 프로젝트와 무관한데, 그게 자명하지 않다.

## 린트에 걸린 것 — effect 안의 동기 setState

처음에는 조회 함수 하나를 만들어 `useEffect(load, [load])`로 불렀는데 `react-hooks/set-state-in-effect`에 걸렸다. `load`가 첫 줄에서 `setError(null)`을 **동기로** 호출하기 때문이다(cascading render 유발).

최초 조회와 재조회를 분리해 해결했다.

- **최초 조회** — effect 본문에서는 `fetchPresets()`만 걸고, 상태는 `.then`/`.catch` 콜백에서만 바꾼다. 언마운트 대비 `alive` 플래그를 둔다.
- **재조회(`load`)** — 삭제 실패 시 **이벤트 핸들러 경로**에서만 부른다. 여기서는 동기 `setError(null)`이 문제되지 않는다.

## 검증

### 데이터 경로 — 실제 API로 왕복

dev 서버(포트 3021) + 실 DB로 전 경로를 태웠다.

```
POST   /api/admin/presets  {name, projectId}  → 200 {"id":"ps-9b14…"}
GET    /api/admin/presets                     → stageCount 1, taskCount 3
GET    /api/admin/presets/ps-9b14…            → stages[0] {offsetDays:0, durationDays:19,
                                                 tasks:[{할일1,1},{할일2,8},{할일3,15}]}
DELETE /api/admin/presets/ps-9b14…            → 200 {"ok":true}
GET    /api/admin/presets                     → {"presets":[]}   (원복 확인)
```

**개발 DB는 전 세션 공유**이므로 만든 프리셋은 확인 직후 삭제해 원래 상태(0건)로 되돌렸다. 상세 응답 형태까지 확인해 둔 것은 다음 태스크(상세 구성 보기)에서 그대로 쓰기 때문이다.

### 페이지 렌더

```
GET /projects/presets → 200
<h1 class="text-[22px] font-semibold">프리셋</h1>
"프로젝트 상세에서 저장한 단계 구성입니다"
```

동적 라우트로 새지 않고 새 페이지가 잡히는 것을 응답 본문으로 확인했다.

### 정적 검증

| 항목 | 결과 |
| --- | --- |
| `npm run lint` | 통과 (`set-state-in-effect` 해소 후) |
| `npx tsc --noEmit` | 통과 |
| `npm run build` | 통과 — `○ /projects/presets` 정적 라우트 등록 확인 |

### 검증 과정에서 헛다리를 짚은 것 — 포트 충돌

처음에 dev 서버를 **3009**로 띄우고 확인했는데, 페이지에 `<h1>`이 없고 본문 문구도 안 잡혀 "SSR이 안 되나" 하고 레이아웃·클라이언트 경계를 한참 뒤졌다.

원인은 `EADDRINUSE: 3009` — **다른 세션이 이미 그 포트를 쓰고 있어 내 서버가 뜨지 않았고**, 모든 응답이 그쪽 서버(내 페이지가 없는 빌드)에서 온 것이었다. 그쪽은 `/projects/presets`를 `[projectId]`로 받아 200을 돌려주고 있었으므로 **상태 코드만으로는 구분이 안 됐다.**

빈 포트(3021)로 다시 띄우니 정상 렌더됐다. 병렬 세션 환경에서는 **dev 서버 기동 로그에서 `Ready`를 확인한 뒤** 검증에 들어가야 한다. `curl`이 200을 주는 것은 내 서버라는 증거가 아니다.

## 알려진 이슈

- **`user-menu`의 `프리셋 관리` 항목은 여전히 동작이 없다.** `DropdownMenuItem`에 `onSelect`도 링크도 없다. 이 페이지로 연결하면 자연스럽지만, `user-menu.tsx`를 다른 세션(`내-정보-페이지`)이 만지고 있어 충돌을 피해 손대지 않았다. 별도 소형 작업으로 분리하는 편이 낫다.
- **이름 변경 기능이 없다.** 서버 API에 이름 수정 경로가 없다(`PUT`은 `projectId`로 구성을 통째 교체하는 덮어쓰기 전용). 이름을 고치려면 엔드포인트 추가가 필요해 이번 범위에서 제외했다.
- **프리셋 적용 기능이 없다.** `server/presets/service.ts`에 적용 로직이 아예 없다(`listPresets`·`getPreset`·`createPresetFromProject`·`overwritePresetFromProject`·`deletePreset`뿐). 사용자와 협의해 이번 사이클에서는 목록·상세·삭제까지로 범위를 정했다.
- **화면 육안 확인은 미완.** 저장소에 브라우저 자동화 도구가 없다. 다만 이번에는 SSR HTML에 페이지 본문이 실려 제목·부제까지 응답으로 확인할 수 있었다(클라이언트 컴포넌트지만 서버에서도 렌더된다). 목록 행·삭제 다이얼로그는 클라이언트 데이터가 들어와야 보이므로 여전히 눈으로 봐야 한다.

## 병렬 작업 메모

- 베이스 `85c2763`.
- `프리셋-저장-UI-밀도-정합` 세션이 프리셋 도메인을 동시에 만지고 있으나 대상이 `preset-save-dialog.tsx`·`project-detail-page.tsx`로 **이번 작업의 신규 2파일과 겹치지 않는다.**
- **용어 회귀 발견** — `preset-save-dialog.tsx`에 `할 일`(띄어쓰기)이 3곳 다시 생겼다(110·119·175행). docs/79에서 저장소 전체를 `할일`로 통일했는데, 그 뒤 병렬 세션이 새로 쓴 UI에 옛 표기가 들어온 것이다. 해당 파일을 그 세션이 수정 중이라 이번에 건드리지 않았고, 이 브랜치의 신규 파일에는 `할일`을 썼다. 그 PR 머지 후 정리가 필요하다.
- 스키마·마이그레이션 변경 없음. 서버 코드 변경 없음.
- 문서 번호: 작성 시점 main 최대가 84라 85를 잡았으나, 머지 직전 85가 3중 중복이 되어 92로 조정했다(짝 문서도 93으로 함께 이동). 이 저장소는 번호 충돌이 잦아 머지 직전 재확인이 필요하다.
