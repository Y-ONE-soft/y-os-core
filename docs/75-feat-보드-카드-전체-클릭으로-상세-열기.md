# 75. feat: 보드 카드 전체 클릭으로 상세 열기

## 배경

프로젝트 상세 화면에서 상세를 열려면 **작업 이름 텍스트를 정확히 눌러야만** 했다.
카드의 여백, 단계 컬럼 헤더의 빈 자리, 백로그 항목의 빈 자리를 누르면 아무 일도
일어나지 않아, 카드를 눌렀는데 반응이 없는 것처럼 보였다.

> 사용자 요청: "프로젝트 상세에서 보드나 할일 이름만 누르는게 아니라 관련 컴포넌트
> 누르면 상세로 볼 수 있게 해줘"

Notion·Jira처럼 **카드(행) 전체가 클릭 대상**이 되도록 넓히되, 카드 안에 있는 다른
컨트롤(체크박스, 단계 지정 드롭다운)은 원래 동작을 그대로 유지해야 한다.

## 작업 범위

| 대상 | 클릭 시 | 예외로 남긴 컨트롤 |
| --- | --- | --- |
| 보드 작업 카드 | 할 일 상세 오버레이 | 완료 체크박스 |
| 보드 단계 컬럼 헤더 | 단계 상세 오버레이 | (없음) |
| 백로그 항목 | 할 일 상세 오버레이 | 완료 체크박스, 단계 지정 드롭다운 |

## 구현

### 1. 보드 작업 카드 — `src/components/features/projects/project-board.tsx`

카드 컨테이너 `<div>`에 `onClick`을 얹고, 클릭 가능한 표면임을 알리도록
`cursor-pointer`와 hover 배경을 추가했다. 작업 도중 main에 들어온 **완료 카드
음영 처리**(`task.done` → 배경에 잠기고 그림자 제거)와 합쳐, hover 배경은
완료/미완료 각각에 맞게 갈라 준다.

```tsx
{/* 카드 어디를 눌러도 상세가 열린다 — 체크박스만 예외.
    완료 카드는 컬럼 배경에 잠기고 그림자를 잃어 뒤로 물러난다 —
    글자 취소선만으로는 한눈에 구분되지 않았다 */}
<div
  onClick={() => setDetailTaskId(task.id)}
  className={cn(
    "flex w-full shrink-0 cursor-pointer items-center gap-2 rounded-[8px] px-2.5 py-2 transition-colors",
    task.done
      ? "bg-muted opacity-60 hover:opacity-80"
      : "bg-background shadow-xs hover:bg-accent/40",
  )}
>
```

체크박스는 카드로 이벤트가 올라가면 "완료 토글 + 상세 열림"이 동시에 일어나므로,
`<span>`으로 감싸 전파를 끊었다. Radix `Checkbox` 자체에 `onClick`을 얹으면
`onCheckedChange`와 순서가 얽히기 때문에 래퍼에서 막는 방식을 택했다.

```tsx
<span onClick={(event) => event.stopPropagation()} className="flex shrink-0 items-center">
  <Checkbox ... />
</span>
```

작업 이름 버튼은 그대로 두되, 부모의 `onClick`과 두 번 실행되지 않도록
`stopPropagation()` 후 직접 상세를 연다.

```tsx
<button
  type="button"
  onClick={(event) => {
    event.stopPropagation();
    setDetailTaskId(task.id);
  }}
  ...
>
  {task.name}
</button>
```

### 2. 단계 컬럼 헤더 — 같은 파일

헤더 전체가 단계 상세로 가는 진입점이 된다. 색 점·단계명·기간 배지 어디를 눌러도
열린다.

```tsx
{/* 헤더 어디를 눌러도 단계 상세가 열린다 */}
<header
  onClick={() => onOpenStage(stage.id)}
  className="flex shrink-0 cursor-pointer items-center gap-[7px] rounded-[6px] py-0.5 pl-1 pr-0.5 transition-colors hover:bg-background/60"
>
```

헤더는 `ContextMenuTrigger asChild`로 감싸져 있어 **우클릭 → 단계 삭제** 메뉴도
그대로 동작한다(왼쪽 클릭만 새로 잡았으므로 충돌하지 않는다).

### 3. 백로그 항목 — `src/components/features/projects/project-backlog.tsx`

백로그 항목은 이미 `draggable`이라 드래그와 클릭이 한 요소에 같이 붙는다.
브라우저는 드래그가 끝난 뒤에는 `click`을 쏘지 않으므로, "끌어다 놓기"와
"눌러서 상세 열기"가 서로를 잡아먹지 않는다. `cursor-grab`은 드래그가 주 기능임을
계속 알려주므로 그대로 뒀다.

```tsx
<div
  draggable
  onDragStart={(event) => setTaskDragData(event, item.id)}
  onClick={() => setDetailTaskId(item.id)}
  title="단계 컬럼으로 끌어다 놓으면 편입됩니다"
  className={cn(
    "flex shrink-0 cursor-grab items-center gap-2 rounded-[8px] bg-muted px-2.5 py-2 transition-colors hover:bg-accent/60 active:cursor-grabbing",
    // 완료 항목은 행 전체를 흐린다 — 보드 카드·내 작업 백로그와 같은 규칙
    item.done && "opacity-60 hover:opacity-80",
  )}
>
```

여기서는 예외가 둘이다. 체크박스는 보드와 같은 방식으로 래퍼에서 막았고,
단계 지정 드롭다운은 트리거에서 직접 막았다.

```tsx
<DropdownMenuTrigger
  aria-label={`${item.name} 단계 지정`}
  onClick={(event) => event.stopPropagation()}
  ...
>
```

## 검증

`localhost:3021` 개발 서버에 puppeteer로 접속해(master01), 검증용 단계 1개 +
보드 작업 1개 + 백로그 작업 1개를 API로 만들어 확인했다. 각 항목은 **페이지를
새로 로드해 상태를 격리**한 뒤 실제 마우스 좌표 클릭으로 눌렀다.

| 검증 | 결과 |
| --- | --- |
| 보드 카드 빈 영역 클릭 → 할 일 상세 열림 | PASS |
| 보드 컬럼 헤더 빈 영역 클릭 → 단계 상세 열림 | PASS |
| 백로그 항목 빈 영역 클릭 → 할 일 상세 열림 | PASS |
| 체크박스 클릭 → 상세 안 열림 | PASS |
| 체크박스 클릭 → 완료 상태 DB 반영 | PASS |
| 백로그 단계 지정 드롭다운 클릭 → 메뉴 열림, 상세 안 열림 | PASS |
| 카드 우클릭 → "작업 삭제" 메뉴 유지 | PASS |
| 백로그 → 단계 편입 경로 정상 | PASS |

`npm run build`, `npm run lint` 모두 통과. 콘솔 에러 없음.
**리베이스(`origin/main` = `6af7d21`) 이후 위 검증을 전부 다시 돌려 동일하게 통과**
하는 것까지 확인했다.

### 리베이스 중 겪은 사고 (기록)

작업 도중 main에 `feat: 내 작업 할일 상세 열기 및 완료 음영 통일`이 머지되어
두 파일 모두 충돌했다. 충돌을 손으로 풀어 놓고 `git checkout --theirs .`를
실행했는데, 이 명령이 **방금 푼 해소본을 stash 버전으로 되돌려** main의 완료 음영
처리(`task.done` 분기, `item.done && "opacity-60"`)를 통째로 날렸다.
`git diff origin/main`으로 "내 변경만 남았는지" 확인하다 발견해 되살렸다.

교훈: 충돌을 편집기로 해소한 뒤에는 `git add <파일>`만 할 것.
`git checkout --ours/--theirs`는 해소 결과를 덮어쓴다. 그리고 리베이스 후에는
**항상 `git diff origin/main`으로 내 변경만 남았는지 눈으로 확인**할 것.

### 테스트에서 배운 것 (다음 세션용)

이번 검증은 제품 버그가 아니라 **테스트 코드 문제로 세 번 헛짚었다.** 같은 함정을
다시 밟지 않도록 남긴다.

1. **뷰포트 밖 좌표를 클릭하고 있었다.** 단계를 새로 만들면 보드가 가로로 늘어나
   새 컬럼이 화면 밖(x=1607 > 뷰포트 1440)에 놓인다. `page.mouse.click`은 조용히
   빗나간다. → 좌표를 재기 전에 `scrollIntoView({ block: "center", inline: "center" })`,
   그리고 잰 좌표가 뷰포트 안인지 확인할 것.

2. **로드맵 헤더에도 같은 단계 이름 버튼이 있다.** `main header button`으로 찾으면
   보드 컬럼 헤더가 아니라 로드맵 행이 잡힌다. → 보드 컬럼은 `＋ 작업` 버튼을
   가진 `section`으로 한정해서 찾을 것.

3. **"빈 영역"을 눈대중 좌표로 잡으면 안 된다.** 이름 버튼 오른쪽 여백을 클릭했더니
   백로그에서는 단계 배지(=의도적으로 전파를 막는 영역) 위였고, 카드 왼쪽 끝을
   클릭했더니 체크박스 위였다. 둘 다 "상세가 안 열린다"로 보이지만 실제로는
   예외가 제대로 동작한 것이다. → `document.elementFromPoint(x, y) === card`가
   성립하는 지점을 **탐색해서** 클릭할 것.

4. Radix 컴포넌트는 `element.click()`(DOM 호출)에 반응하지 않는다. 체크박스도
   드롭다운도 실제 마우스 클릭이어야 한다. (docs/36에 기록된 교훈과 동일)

## 변경 파일

- `src/components/features/projects/project-board.tsx`
- `src/components/features/projects/project-backlog.tsx`
