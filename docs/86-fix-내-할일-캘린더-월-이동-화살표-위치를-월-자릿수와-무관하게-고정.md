# fix: 내 할일 캘린더 월 이동 화살표 위치를 월 자릿수와 무관하게 고정

## 작업 요약

내 할일 캘린더 뷰 상단 툴바에서 달을 넘길 때마다 좌우 이동 화살표(`◀` `▶`) 위치가 달라지는 문제를 고쳤다.

제목 `2026년 7월` / `2026년 12월`처럼 **월 숫자의 자릿수에 따라 제목 폭이 변해서**, flex 행에서 뒤따르는 `▶` 버튼과 그 뒤 요소들이 통째로 밀렸다. 사용자 요청대로 **2자리를 기준으로 폭을 고정**해 1자리 달에서도 같은 자리를 차지하도록 했다.

- 사용자는 "년도 화살표"라고 표현했지만, 년도는 항상 4자리이므로 실제 변동 요인은 월 숫자다.

## 원인

[src/components/features/my-work/my-work-calendar-panel.tsx](../src/components/features/my-work/my-work-calendar-panel.tsx) 툴바가 `buildMonthGrid()`가 만든 단일 문자열 `grid.title`(`"2026년 7월"`)을 그대로 `<h2>`에 넣고 있었다.

```
<div class="flex items-center gap-2.5">
  ◀  [ 2026년 7월 ]  ▶   ← 제목 폭이 가변이라 ▶ 이후가 전부 밀림
```

`flex` 행에서 `<h2>`가 내용 폭만큼만 차지하므로, 제목이 한 글자 좁아지면 그 뒤 요소가 그만큼 왼쪽으로 당겨진다.

## 변경 내용

`grid.title` 문자열 대신 `MonthGrid`에 이미 있던 `year` / `month` 필드로 나눠 렌더하고, **월 숫자만 2자리 고정폭 슬롯**에 담았다.

```tsx
{/* 월 숫자는 2자리 고정폭 슬롯에 넣는다 — 1자리 달(7월)에도 제목 폭이 같아야
    양옆 화살표가 달을 넘길 때마다 밀리지 않는다 */}
<h2 className="text-[15px] font-semibold tabular-nums">
  {grid.year}년{" "}
  <span className="inline-block w-[2ch] text-right">
    {grid.month + 1}
  </span>
  월
</h2>
```

- `w-[2ch]` — `ch`는 현재 폰트 `0` 글자의 advance 폭. 슬롯 폭이 **내용과 무관한 상수**가 되므로 자릿수가 바뀌어도 제목 폭이 고정된다.
- `tabular-nums` — 모든 숫자 글리프 폭을 `0`과 같게 맞춘다. 이게 있어야 `12`가 정확히 `2ch`에 들어차고 넘치지 않는다.
- `text-right` — 남는 자리를 숫자 **앞**에 둔다. (아래 "결정 이유" 참고)

## 결정 이유

### 왜 고정폭 슬롯인가 (vs `<h2>`에 `min-w` + 가운데 정렬)

`min-w`만 주는 1줄 수정으로도 화살표는 고정되지만, 적정 값을 한글 글리프 폭에 의존해 눈대중으로 잡아야 하고 제목 텍스트 자체가 반 글자씩 흔들린다. `2ch` 슬롯은 폰트 메트릭에서 값이 나오므로 추정치가 없고 제목까지 완전히 고정된다.

### 왜 `text-right`인가 (vs `text-center`)

처음에 `text-center`로 구현했으나 실제 렌더를 보고 바꿨다. 두 방식 모두 화살표 정렬은 **0.00px로 동일하게 완벽**하지만, 가운데 정렬은 1자리 달에서 숫자가 슬롯 중앙에 떠서 `2026년  7 월`처럼 **"7"이 "월"에서 떨어져** 보인다. 우측 정렬은 여백이 전부 숫자 앞으로 가서 `7월`이 한 덩어리로 읽힌다.

| 방식 | `▶` 위치 차이 | 1자리 달 표시 |
|---|---|---|
| BEFORE (단일 문자열) | **7.81px 어긋남** | `2026년 7월` |
| `text-center` | 0.00px | `2026년  7 월` — 숫자가 분리돼 보임 |
| **`text-right` (채택)** | **0.00px** | `2026년  7월` — 자연스러움 |

### `MonthGrid.title` 필드는 남겨뒀다

이 수정으로 `grid.title`은 참조하는 곳이 없어졌지만 [my-work-month.ts](../src/components/features/my-work/my-work-month.ts)에서 **제거하지 않았다.** 현재 캘린더 영역을 건드리는 워크트리가 여럿(`calendar-task-check` 등) 병렬 진행 중이고, 한쪽이 export를 지우고 다른 쪽이 그것을 쓰는 파일을 추가해 main 빌드가 깨진 전례가 있다(docs/13). 병렬 캘린더 브랜치들이 정리된 뒤 별도로 제거하는 편이 안전하다.

## 검증

### 빌드 · 린트

```bash
npm run lint    # 통과 (출력 없음)
npm run build   # ✓ Compiled successfully in 7.1s, 19/19 static pages
```

### Tailwind 클래스 생성 확인

임의값 유틸리티가 실제로 CSS에 나오는지 빌드 산출물에서 확인했다.

```bash
grep -o "[^{}]*2ch[^{}]*[{][^}]*[}]" .next/static/chunks/3tqonxtewgz_p.css
# .w-\[2ch\]{width:2ch}

grep -o "\.tabular-nums{[^}]*}" .next/static/chunks/3tqonxtewgz_p.css
# .tabular-nums{--tw-numeric-spacing:tabular-nums;font-variant-numeric:...}
```

### 실제 렌더 측정 (헤드리스 Chrome)

앱과 동일한 조건(Geist 폰트, `text-[15px] font-semibold`, `flex items-center gap-2.5`)으로 BEFORE/AFTER 툴바를 만들어 `▶` 버튼의 `getBoundingClientRect().left`를 7월 · 12월에 대해 측정했다.

```
BEFORE  ▶ left:   212.95 vs   220.76   차이 7.81px  MISALIGNED
AFTER   ▶ left:   224.07 vs   224.07   차이 0.00px  ALIGNED
RIGHT   ▶ left:   224.07 vs   224.07   차이 0.00px  ALIGNED
```

- 하네스는 스크래치패드에서만 실행했고 저장소에는 커밋하지 않는다.
- 로그인·DB가 필요한 `/projects/my-tasks` 전체 플로우 대신, 검증 대상인 **툴바 레이아웃 폭**만 동일 CSS·동일 폰트로 격리 측정했다. 정렬 성립 여부는 폰트 메트릭과 flex 규칙만으로 결정되므로 이 범위로 충분하다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `src/components/features/my-work/my-work-calendar-panel.tsx` | 툴바 제목을 `grid.title` 단일 문자열 → `grid.year` / `grid.month` 분리 렌더로 교체, 월 숫자에 `w-[2ch] text-right` 고정폭 슬롯 + `tabular-nums` 적용, 의도 설명 주석 추가 |
| `docs/86-fix-내-할일-캘린더-월-이동-화살표-위치를-월-자릿수와-무관하게-고정.md` | 본 문서 (신규) |

동작 변경 없음 — 표시 레이아웃만 조정했다. `shiftMonth()`, `buildMonthGrid()`, 캘린더 그리드·드래그 로직은 손대지 않았다.

## 병렬 작업 확인

작업 시작 전 `git worktree list` · `gh pr list`로 범위 중복을 확인했다.

- `calendar-task-check` 워크트리가 같은 `my-work-calendar-panel.tsx`를 미커밋 상태로 수정 중이었으나(할일 체크박스 토글 — 136행 `handleToggleTask` 추가, 312행 `onToggleTask` prop 전달), 이번 변경 지점인 툴바 헤더(255~287행)와 **겹치지 않아** 충돌 위험 없음.
- 그 외 워크트리(`board-select-style`, `my-info-page`, `preset-manage-page`, `request-notifications`)는 이 파일의 미커밋 변경 없음.

작업 도중 `calendar-task-check`가 `docs/85-feat-캘린더-할일-칩-체크박스로-완료-토글.md`로, `my-info-page`가 `docs/83`·`docs/84`로 먼저 main에 머지됐다. 이에 따라:

- **본 문서 번호를 85 → 86으로 조정했다.** (병렬 번호 충돌 시 나중에 머지되는 쪽이 올린다는 규칙)
- 최신 `origin/main` 위로 리베이스했고, 같은 파일을 건드린 체크박스 변경과 **충돌 없이 적용**됐다(예상대로 서로 다른 hunk). 리베이스 후 린트·빌드를 다시 돌려 통과를 확인했다.

## 사용 버전

- Next.js 16.2.11 (App Router + Turbopack)
- React 19.2.4
- Tailwind CSS v4
- TypeScript 5
- 폰트: Geist (`next/font/google`)

## 알려진 이슈

- **3자리 월은 없으므로 2자리 고정으로 충분하다.** 다만 향후 제목 형식이 바뀌면(예: 요일·주차 추가) 같은 문제가 재발할 수 있다.
- `ch` 단위는 폰트에 의존한다. Geist가 아닌 폰트로 바꾸면 슬롯 폭은 그 폰트 기준으로 자동 재계산되므로 정렬 자체는 유지되지만, `tabular-nums`를 지원하지 않는 폰트로 교체할 경우 2자리 숫자가 슬롯을 살짝 넘칠 수 있다.
- `MonthGrid.title`은 이 커밋 이후 참조처가 없는 상태로 남아 있다. 병렬 캘린더 브랜치가 정리된 뒤 별도 소형 PR로 제거하는 것이 좋다.
