# 94. refactor: 보드 컴포넌트 단위 선택 스타일로 정리

## 배경

docs/75에서 카드·헤더 전체를 클릭할 수 있게 넓혔지만, 정작 **눈에 보이는 반응은
이름 텍스트에만** 남아 있었다. 이름에 밑줄이 그어지고 색이 바뀌니 "이름을 눌러야
하는 화면"으로 읽혔고, 단계는 헤더만 클릭 대상이라 컬럼 아래 빈 자리를 눌러도
아무 일이 없었다.

> 사용자 요청: "아니 보드가 지금 할일 리스트 하고 +작업 외 아래 부분도 포함인거자나
> 헷갈리게 이름이나 그 주변에 밑줄이나 호버 만들지 말고 그 컴포넌트 자체가
> 선택된것처럼 보이게 하고 클릭하면 상세로 가게 해줘"

핵심은 **경계를 컴포넌트 단위로 다시 긋는 것**이다. 단계 컴포넌트는 헤더가 아니라
컬럼 전체(헤더 + 할일 리스트 + `＋할일` + 아래 여백)이고, 할일 컴포넌트는 이름이
아니라 카드 전체다. 반응도 그 경계에 맞춰 통째로 준다.

## 구현

### 1. 이름에서 반응을 걷어냈다

단계명과 할일명은 클릭 대상이 아니라 **내용**이므로 버튼을 걷어내고 일반 텍스트로
되돌렸다. 밑줄(`hover:underline`)과 색 변화(`hover:text-primary/80`)도 함께 제거했다.

```tsx
// 단계명 — 이전에는 <button>이 h3 안에 들어 있었다
<h3 className="min-w-0 flex-1 truncate text-[13px] font-semibold">
  {stage.name}
</h3>
```

```tsx
// 할일명 — button → span
<span
  className={cn(
    "min-w-0 flex-1 truncate text-left text-[13px] font-medium leading-[18px]",
    task.done && "text-muted-foreground line-through",
  )}
>
  {task.name}
</span>
```

### 2. 단계 컴포넌트 = 컬럼 전체 — `project-board.tsx`

`onClick`을 헤더에서 `<section>`으로 올렸다. 이제 헤더든 할일 리스트의 빈 자리든
`＋할일` 아래 여백이든, 컬럼 안 어디를 눌러도 단계 상세가 열린다.

```tsx
<section
  onClick={() => onOpenStage(stage.id)}
  className={cn(
    "flex min-h-0 w-[260px] shrink-0 cursor-pointer flex-col gap-1.5 rounded-[8px] bg-border p-2 transition-shadow",
    // 컬럼 전체가 '단계' 컴포넌트다 — 호버하면 통째로 선택된 것처럼 보인다.
    // 단, 안쪽 카드·버튼을 가리키는 동안에는 컬럼 강조를 끈다(has-*가
    // :has() 특이도 덕에 hover 유틸리티를 순서와 무관하게 이긴다).
    "hover:ring-2 hover:ring-primary/40 has-[[data-column-child]:hover]:ring-0",
    dropStageId === stage.id &&
      "ring-2 ring-primary ring-offset-1 has-[[data-column-child]:hover]:ring-2",
  )}
>
```

### 3. 선택된 것처럼 보이는 표시 = `ring`

배경색을 바꾸는 대신 테두리 링을 쓴다. 이미 드롭 대상 하이라이트가
`ring-2 ring-primary`를 쓰고 있어 **같은 시각 언어**를 이어가는 편이 자연스럽고,
완료 카드처럼 배경이 이미 다른 요소에도 똑같이 얹힌다.

| 대상 | 평소 | 호버 |
| --- | --- | --- |
| 단계 컬럼 | `bg-border` | `ring-2 ring-primary/40` |
| 할일 카드 | `bg-background shadow-xs` | `ring-2 ring-primary/50` |
| 백로그 항목 | `bg-muted` | `ring-2 ring-primary/50` |

앞서 카드에 있던 `hover:bg-accent/40`, `hover:opacity-80`은 링과 중복이라 걷어냈다.
완료 카드의 `opacity-60`은 상태 표시이므로 유지한다.

### 4. 중첩 호버 억제 — 이 작업의 핵심 난점

컬럼과 카드가 부모–자식이라, 카드에 마우스를 올리면 **둘 다** 링이 켜져 지저분해진다.
자식이 호버 중일 때 부모 링을 끄는 방식으로 해결했다.

```
hover:ring-2 hover:ring-primary/40 has-[[data-column-child]:hover]:ring-0
```

`data-column-child`는 컬럼 안의 "직접 반응하는 자식"에 붙인 표식이다 — 할일 카드,
`＋할일` 버튼, 할일 추가 입력창.

이 방식을 고른 이유는 **특이도로 결판나서 클래스 순서에 의존하지 않기** 때문이다.
`:has()`의 특이도는 인자 중 가장 높은 것을 따르므로
`.has-[...]:ring-0:has([data-column-child]:hover)`는 `(0,3,0)`이 되어
`.hover:ring-2:hover`의 `(0,2,0)`을 **항상** 이긴다. Tailwind가 유틸리티를 어떤
순서로 뽑든 결과가 흔들리지 않는다. (React 상태로 호버를 추적하는 방법도 있지만
컬럼마다 상태와 리렌더가 늘어 과했다.)

드롭 대상 하이라이트는 예외로 되살려야 해서 `has-[...]:ring-2`를 덧붙였다 —
드래그 중에는 카드 위에 있어도 "여기 놓인다"가 계속 보여야 한다.

### 5. 클릭이 부모로 새지 않도록

컬럼이 클릭 대상이 되면서, 안쪽 요소의 클릭이 그대로 올라가면 **상세가 두 개 열린다.**
카드는 `stopPropagation()`으로 끊었고, `＋할일` 버튼과 추가 입력창도 같이 막았다.

```tsx
onClick={(event) => {
  // 막지 않으면 컬럼까지 올라가 단계 상세가 같이 열린다
  event.stopPropagation();
  setDetailTaskId(task.id);
}}
```

### 6. 키보드 접근성 보전

이름 버튼을 없앤 만큼 카드·백로그 항목이 `<div>`만 남아, 그대로 두면 키보드로
상세를 열 수 없다. `role="button"` + `tabIndex={0}` + Enter/Space 처리로 버튼 규약을
직접 지키고, `focus-visible:ring`으로 포커스도 보이게 했다.

```tsx
role="button"
tabIndex={0}
onKeyDown={(event) => {
  // div라 기본 동작이 없으니 버튼 규약을 직접 지킨다
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    event.stopPropagation();
    setDetailTaskId(task.id);
  }
}}
```

카드를 `<button>`으로 만들지 않은 이유는 안에 체크박스(역시 버튼)가 들어 있어
**버튼 중첩이 되기 때문**이다.

## 검증

`localhost:3031` 개발 서버에 puppeteer로 접속(master01), 검증용 단계 1개 + 보드 할일
1개 + 백로그 할일 1개를 API로 만들어 확인했다.

| 검증 | 결과 |
| --- | --- |
| 컬럼 하단(`＋할일` 아래 367px 여백) 클릭 → 단계 상세 | PASS |
| 컬럼 헤더 클릭 → 단계 상세 | PASS |
| 할일 카드 클릭 → 할일 상세 | PASS |
| 카드 클릭 시 오버레이가 **하나만** 열림 (단계 상세 동시 열림 없음) | PASS |
| `＋할일` → 입력창만 열리고 단계 상세는 안 열림 | PASS |
| 컬럼 호버 → 컬럼에 링 | PASS |
| 카드 호버 → 카드에 링 | PASS |
| 카드 호버 시 컬럼 링은 꺼짐 | PASS |
| 단계명·할일명이 버튼이 아님 (할일명 태그 `SPAN`) | PASS |
| 체크박스 → 상세 안 열리고 완료만 DB 반영 | PASS |
| 백로그 항목 클릭 → 할일 상세 | PASS |
| 카드 우클릭 → "할일 삭제", 헤더 우클릭 → "단계 삭제" | PASS |
| 카드 `tabIndex=0`·포커스 수용, Enter → 상세 | PASS |
| 백로그 항목 Space → 상세 | PASS |
| 드래그 오버 시 컬럼 하이라이트 유지 | PASS |
| 백로그 → 단계 편입 저장 | PASS |

`npm run build`, `npm run lint` 통과. 콘솔 에러 없음.

### 리베이스로 합친 것 — 단계 순서 변경 드래그

작업 중 main에 **컬럼을 끌어 단계 순서를 바꾸는 기능**이 들어와 충돌했다.
그쪽은 헤더를 드래그 손잡이로 삼았고(`draggable` + `setStageDragData`), 나는 헤더의
클릭·호버를 걷어내는 중이었다. 둘 다 살리는 방향으로 합쳤다.

- **손잡이는 유지** — `draggable`, `onDragStart`, `onDragEnd`, `cursor-grab`/
  `active:cursor-grabbing`. 드래그 가능하다는 신호는 "이름을 눌러야 하나"로 읽히는
  종류의 반응이 아니라 정당한 어포던스다.
- **헤더의 `onClick`은 제거** — 컬럼(`<section>`)이 이미 클릭을 받으므로 두면
  `onOpenStage`가 두 번 불린다.
- **헤더의 `hover:bg-background/60`도 제거** — 헤더에만 배경이 깔리면 이번 작업이
  없애려던 바로 그 오해가 남는다. 강조는 컬럼 전체가 맡는다.
- 컬럼 클래스는 양쪽을 합쳐 `relative`(끼워넣기 표식 기준점)와
  `draggingStageId === stage.id && "opacity-40"`를 그대로 두고, 그 위에 호버 링과
  `has-*` 억제를 얹었다.

합친 뒤 위 16개 검증을 다시 돌려 전부 통과했고, main 쪽 기능도 따로 확인했다.

| 검증 (main에서 새로 들어온 기능) | 결과 |
| --- | --- |
| 헤더를 끌어 단계 순서 변경 (순서B → 순서A 앞) | PASS |
| 드래그 중 끼워넣기 표식 표시 | PASS |

리베이스 때 `git checkout --theirs`는 쓰지 않았다 — docs/75에서 그 명령이 손으로 푼
해소본을 덮어써 사고가 났던 전례가 있어, 충돌 파일은 편집 후 `git add`만 했다.

### 검증에서 헛짚은 것 (테스트 코드 쪽 문제)

처음 실행에서 4건이 FAIL로 나왔지만 **전부 판정 방식이 틀린 것**이었고 제품 결함은
없었다. docs/75에 이어 같은 계열의 함정이라 남긴다.

1. **`ring`을 "box-shadow가 있냐 없냐"로 보면 안 된다.** `ring-0`은 레이어를 남기고
   두께만 `0px`로 만든다. 그래서 억제가 제대로 동작해도 `boxShadow !== "none"`이라
   "링이 켜져 있다"로 읽혔다. → `0px 0px 0px Npx`에서 **N을 파싱해 두께로 판정**할 것.
2. **카드 안 체크박스도 Radix `<button>`이다.** "카드 안에 button이 있으면 이름이
   버튼"이라는 판정이 체크박스에 걸렸다. → `button:not([role='checkbox'])`로 좁힐 것.
3. **눈대중 좌표는 또 빗나갔다.** 백로그 항목의 `left+5`는 체크박스 위였다
   (`elementFromPoint` → `BUTTON`). → docs/75와 같이 `elementFromPoint(x,y) === 항목`이
   성립하는 지점을 탐색할 것.
4. **React 상태 갱신 전에 스타일을 읽었다.** `dragover`를 dispatch한 직후 같은 틱에
   `getComputedStyle`을 읽으니 `setDropStageId` 반영 전이라 하이라이트가 꺼진 것으로
   보였다. → dispatch 후 한 틱 쉬고 읽을 것.

### 재현되지 않은 실패 1건

드래그 편입 검증이 한 번 "단계를 찾을 수 없음"으로 실패했다가 재실행에서 통과했다.
그 시점 UI에는 단계가 그려져 있는데 API 응답에는 없었으므로, **다른 세션이 공유
개발 DB를 건드린 것**(워크스페이스 리셋 등)으로 보인다 — 다만 확증은 없다.
개발·프로덕션이 DB를 공유하는 구조에서 반복될 수 있는 종류의 흔들림이다.

## 남은 것 (이번 범위 밖)

같은 "이름에만 밑줄" 패턴이 다른 화면에도 남아 있다. 이번 요청은 프로젝트 상세
보드였으므로 건드리지 않았다. 화면을 맞추려면 별도 태스크가 필요하다.

- `src/components/features/my-work/my-work-backlog.tsx:100` — 내 할일 백로그 (보드
  백로그와 같은 티켓 형태라 지금은 서로 달라 보인다)
- `src/components/features/projects/project-roadmap.tsx:200` — 프로젝트 로드맵 단계명
- `src/components/features/projects/workload-roadmap.tsx:303` — 작업 현황 로드맵

## 변경 파일

- `src/components/features/projects/project-board.tsx`
- `src/components/features/projects/project-backlog.tsx`
