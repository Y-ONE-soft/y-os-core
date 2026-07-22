# 78. refactor: 프리셋 저장 UI를 도메인 규약·디자인 시스템에 맞춰 정리

## 작업 요약

docs/70에서 만든 프리셋 저장 UI가 **프로젝트 규약과 어긋나 있어** 바로잡는다. 기능·디자인 의도는 그대로고 배치와 표현만 고친다.

1. 컴포넌트를 `presets` 도메인 폴더로 이동
2. 다이얼로그를 Dialog 프리미티브로 재조립
3. 임의 px 값을 기존 선례에 있는 값으로 교체
4. 버튼을 Button 사이즈 스케일로

## 무엇이 틀렸었나

### 1. 도메인 폴더 규약 위반

CLAUDE.md의 새 도메인 흐름은 이렇다.

```
page.tsx → components/features/<도메인> → lib/api/<도메인>.ts
         → app/api/admin/<도메인>/route.ts → server/<도메인>/service.ts
```

프리셋은 나머지 계층을 전부 `presets`로 만들어 놓고 **컴포넌트만 `projects/`에 넣었다.**

| 계층 | 위치 | |
| --- | --- | --- |
| API 라우트 | `app/api/admin/presets/` | ✅ |
| 서비스 | `server/presets/service.ts` | ✅ |
| 프론트 API | `lib/api/presets.ts` | ✅ |
| 타입 | `types/preset.ts` | ✅ |
| 컴포넌트 | `components/features/projects/preset-save-dialog.tsx` | ❌ |

프로젝트 상세에서 호출된다는 이유로 호출부 폴더에 넣은 것인데, 호출 위치가 도메인을 정하지는 않는다. 앞으로 만들 적용 다이얼로그·프리셋 관리 목록도 같은 도메인이라 지금 바로잡지 않으면 계속 어긋난다.

### 2. 집 스타일을 쓰지 않고 Figma px를 그대로 박음

같은 성격의 폼 다이얼로그인 `collaborator-request-dialog.tsx`와 비교하면 거의 모든 항목이 달랐다.

| 항목 | 기존 규약 | docs/70에서 한 것 | 이번 |
| --- | --- | --- | --- |
| 구조 | `DialogHeader`·`DialogFooter`·`DialogClose` | div로 직접 조립 | 프리미티브 사용 |
| 너비 | `sm:max-w-[400px]` | `w-[480px] max-w-[calc(100vw-32px)]` | `sm:max-w-[400px]` |
| 패딩 | `DialogContent` 기본값 | `px-6 py-5`로 덮어씀 | 기본값 |
| 제목 | `text-[15px] font-semibold` | `text-base` | `text-[15px]` |
| 설명 | — | 직접 `<p>` | `DialogDescription` |
| 본문 | `text-sm` / `text-[13px]` | `text-[12.5px]`·`text-[11.5px]` | `text-sm`·`text-[13px]`·`text-xs` |
| 라운딩 | `rounded-[8px]` | `[10px]`·`[8px]`·`[6px]` 혼용 | `[8px]` + 세그먼트만 `[6px]` |
| 취소 버튼 | `variant="ghost"` | `variant="outline"` | `variant="ghost"` |
| 구분선 | `DialogFooter`가 상단 보더 제공 | 수동 `Separator` 추가 | 제거 |
| 닫기 ✕ | `DialogContent` 기본 제공 | — | 기본값 사용 |

임의 값 사용량이 이렇게 줄었다.

```
전:  text-[12.5px] ×5, text-[11.5px] ×2, rounded-[10px], w-[480px], px-6, py-5
후:  text-[15px] ×1, text-[13px] ×3, rounded-[8px] ×3, rounded-[6px] ×1
```

남은 값은 전부 **기존 코드에 선례가 있는 값**이다 — `text-[15px]`는 `DialogTitle`, `text-[13px]`·`rounded-[8px]`는 공동 작업자 다이얼로그, `rounded-[6px]`는 로드맵 레인지 스위처.

### 3. 버튼 높이를 임의로 둠

헤더의 `프리셋 저장`을 `Button` 기본 사이즈(h-8)로 뒀다. Figma는 36px이고, 이는 사이즈 스케일의 `lg`(h-9)에 대응한다. 임의 높이를 주는 대신 **스케일 값으로** 지정했다.

## 변경 파일

### `src/components/features/presets/preset-save-dialog.tsx` (이동 + 재작성)

`git mv`로 옮겨 이력을 보존했다. 내부는 위 표대로 프리미티브 기반으로 재조립했다.

두 군데는 **기존 화면의 형식을 그대로 빌려왔다.**

- 포함 구성 행 — 공동 작업자 다이얼로그의 요약 행과 같은 `flex h-9 items-center rounded-[8px] border px-3 text-sm`
- 모드 스위처 — 로드맵 레인지 스위처와 같은 세그먼트(`bg-muted p-[3px]` 컨테이너, 활성만 `bg-background` + 미세 그림자). 다이얼로그 안이라 글자만 `text-[13px]`로 올렸다

### `src/components/features/projects/project-detail-page.tsx`

- import 경로를 `features/presets/`로 수정 (참조는 이 한 곳뿐이었다)
- 헤더 버튼에 `size="lg"` 지정

## 바꾸지 않은 것

- **버튼의 화면 위치** — 페이지 헤더 제목 줄 오른쪽(Figma `180:901`)이 맞다는 확인을 받았다
- **다이얼로그 너비** — Figma는 480px이지만 저장소의 유일한 폼 다이얼로그 선례가 `sm:max-w-[400px]`라 그쪽을 따랐다. 화면 간 통일이 4px 단위 일치보다 중요하다고 봤다
- 기능·상태 관리·API 호출 — 그대로다

## 검증

```bash
npx tsc --noEmit          # 통과
npm run lint              # 통과
npm run build             # 성공 — Compiled successfully
```

임의 값 잔존 여부를 grep으로 직접 셌다(위 "전/후" 수치).

**미검증** — 브라우저에서 다이얼로그를 열어본 확인은 이번에도 못 했다. 저장소에 브라우저 자동화 도구가 없고, 워크스페이스 캐시의 `getServerSnapshot()`이 항상 빈 값이라 SSR HTML에도 프로젝트 상세 본문이 렌더되지 않는다. 시각 확인은 사용자 몫으로 남는다.

## 병렬 작업 메모

착수 시점 main = `6af7d21`. `project-detail-page.tsx`를 만지는 다른 세션이 없음을 확인하고 진행했다. 문서 번호는 main 기준 77까지 사용되어 78로 잡았다.
