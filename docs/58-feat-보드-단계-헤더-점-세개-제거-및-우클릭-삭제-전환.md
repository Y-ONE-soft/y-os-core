# feat: 보드 단계 헤더 점 세개 제거 및 우클릭 삭제 전환

요청 사이클 `보드-단계-우클릭-삭제`의 2번(마지막) 태스크. 1번 태스크에서 만든 단계 삭제 API를 화면에 연결한다. 이 커밋으로 요청이 완결된다.

## 배경

프로젝트 상세 보드의 단계 헤더에는 점 세개(`Ellipsis`) 버튼이 있었지만 **`onClick`이 없는 껍데기**였다.

```tsx
<button
  type="button"
  aria-label={`${stage.name} 단계 메뉴`}
  className="text-muted-foreground transition-colors hover:text-foreground"
>
  <Ellipsis className="size-3.5" />
</button>
```

메뉴가 열릴 것처럼 보이지만 눌러도 아무 일이 없다. 반면 같은 파일의 작업 카드는 이미 우클릭 삭제가 구현돼 있었고, 사이드바 프로젝트·그룹과 백로그도 모두 `ContextMenu` 방식이다. **단계만 다른 규약을 흉내 내다 만 상태**였다.

## 변경 내용

### 1. `src/components/features/projects/board-store.tsx` — `deleteStage` 액션

```ts
/**
 * 단계 삭제 — 서버(deleteStage)와 동일하게 안의 작업은 지우지 않고 백로그로
 * 옮긴다. 낙관적 값이 서버와 어긋나면 새로고침 시 작업이 사라졌다 되살아난다.
 */
deleteStage(projectId: string, stageId: string) {
  updateBoard(projectId, (board) => {
    const target = board.stages.find((stage) => stage.id === stageId);
    return {
      ...board,
      backlog: [...board.backlog, ...(target?.tasks ?? [])],
      stages: board.stages.filter((stage) => stage.id !== stageId),
    };
  });
  cache.persist(deleteStageApi(stageId));
},
```

**낙관적 업데이트가 서버 동작을 그대로 흉내 내야 한다.** 단순히 단계만 제거하면 화면에서는 작업이 사라졌다가, 새로고침하면 백로그에서 되살아난다. 사용자에게는 "지웠는데 왜 다시 생기지?"로 보인다. 그래서 제거 전에 `target.tasks`를 백로그 끝에 붙인다.

`target`이 없을 수 있는 경우(이미 삭제된 단계에 대한 중복 호출)를 `?? []`로 방어했다.

`deleteStageApi` import 추가.

### 2. `src/components/features/projects/project-board.tsx`

점 세개 버튼과 `Ellipsis` import를 제거하고, 헤더를 `ContextMenu`로 감쌌다.

```tsx
{/* 단계 메뉴는 헤더 우클릭 — 작업 카드·프로젝트·백로그와 같은 방식.
    컬럼 전체를 트리거로 잡으면 작업 카드 메뉴와 중첩되므로 헤더만 잡는다 */}
<ContextMenu>
  <ContextMenuTrigger asChild>
    <header className="flex shrink-0 items-center gap-[7px] py-0.5 pl-1 pr-0.5">
      …단계 색상 점 / 이름 / 개수 배지…
    </header>
  </ContextMenuTrigger>
  <ContextMenuContent className="w-44">
    <ContextMenuItem
      variant="destructive"
      onSelect={() => boardActions.deleteStage(projectId, stage.id)}
    >
      단계 삭제
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

**트리거 범위를 헤더로 한정한 이유** — 컬럼(`section`) 전체를 트리거로 잡으면 빈 공간 우클릭도 잡혀 편하지만, 안쪽 작업 카드에 이미 자기 컨텍스트 메뉴가 있어 **두 메뉴가 중첩**된다. 카드 위에서 우클릭했을 때 "작업 삭제"가 떠야 하는데 부모 메뉴와 경합한다. 헤더만 잡으면 경계가 명확하다.

`ContextMenuContent`의 `w-44`, `ContextMenuItem`의 `variant="destructive"`는 바로 아래 작업 카드 메뉴와 동일하게 맞췄다. 단계 이름 클릭 시 상세를 여는 기존 `onOpenStage` 동작은 그대로다 — 좌클릭은 상세, 우클릭은 메뉴로 갈린다.

헤더 마크업·클래스는 변경하지 않았고 `asChild`로 위임하므로 **DOM 래퍼가 추가되지 않고 레이아웃도 그대로다.** 점 세개가 빠진 만큼 개수 배지 오른쪽 여백만 줄어든다.

## 검증

`npm run build` 성공(타입 검사 포함), `npm run lint` 경고 0. `project-board.tsx`의 `Ellipsis` 참조 **0건**.

dev 서버(포트 3041)로 확인했다. 3001·3002·3011은 다른 세션 점유 중이었다. **전용 픽스처를 만들어 검증하고 전부 삭제했다.**

### 1. 점 세개 제거

프로젝트 상세 페이지 HTML에서 확인.

| 항목 | 결과 |
|---|---|
| `단계 메뉴` aria-label | 0건 |
| `lucide-ellipsis` 아이콘 | 0건 |

### 2. 낙관적 업데이트가 서버와 일치하는가 (핵심)

보드는 클라이언트 렌더라 SSR HTML에 단계·작업이 나오지 않는다(스켈레톤 3개만). 그래서 **스토어의 낙관적 계산을 동일 입력으로 재현해 서버 실제 결과와 비교**했다.

```
낙관적 예측 → 단계: (없음) / 백로그: 살아남을 작업
DELETE=[200]
서버 실제   → 단계: (없음) / 백로그: 살아남을 작업
→ 낙관적 값과 서버 일치: 정상 (새로고침해도 튀지 않음)
```

단계가 사라지고 그 안의 작업이 백로그로 이동하는 결과가 화면 예측과 서버에서 동일하다.

### 검증하지 못한 것

**헤더를 실제로 우클릭해 메뉴가 뜨고 "단계 삭제"를 누르는 클릭 스루는 하지 못했다.** 이 저장소에 브라우저 자동화 도구(playwright·puppeteer)가 없고, 이 작업만을 위해 devDependency를 추가하는 것은 과하다고 판단했다. 컨텍스트 메뉴는 Radix Portal로 열릴 때 마운트되므로 SSR HTML에도 나타나지 않는다.

검증 범위는 "점 세개가 제거됐고, 삭제 경로가 서버까지 정확히 동작하며, 낙관적 값이 서버와 일치한다"까지다. **우클릭 → 메뉴 표시 → 삭제 클릭은 화면에서 한 번 확인이 필요하다.** 붙인 패턴 자체는 같은 파일 작업 카드에서 이미 동작 중인 것과 동일하다.

## 변경 파일 내역

| 파일 | 구분 | 내용 |
|---|---|---|
| `src/components/features/projects/board-store.tsx` | 수정 | `deleteStage` 액션 추가 — 작업을 백로그로 옮기는 낙관적 업데이트, `deleteStageApi` import |
| `src/components/features/projects/project-board.tsx` | 수정 | 점 세개 버튼·`Ellipsis` import 제거, 헤더를 `ContextMenu`로 감싸 "단계 삭제" 제공 |

## 알려진 이슈 / 주의점

### 스탭이 남의 단계를 우클릭하면 메뉴는 뜨지만 삭제는 실패한다

서버가 403으로 막지만(docs/56), UI는 권한을 모른 채 메뉴를 띄우고 낙관적으로 단계를 지운다. `cache.persist`가 실패를 처리하는 방식에 따라 화면이 잠깐 어긋날 수 있다. 프로젝트 삭제·작업 삭제도 동일한 구조라 이번에 새로 생긴 문제는 아니며, 권한 기반 메뉴 노출은 별도 사이클에서 일괄로 다루는 편이 낫다.

### 확인 다이얼로그는 넣지 않았다

작업이 백로그로 보존되므로 프로젝트 삭제만큼 파괴적이지 않다고 판단했다. 다만 **단계 자체(이름·색상·기간·설명·댓글)는 복구되지 않는다.** docs/55의 `alert-dialog`를 재사용하면 붙이기는 쉽다.

### 터치 환경에는 진입점이 없다

우클릭 전용이라 터치 기기에서는 단계 메뉴에 접근할 수 없다. 점 세개가 그 역할을 할 수 있었지만 애초에 동작하지 않았고, 요청이 "점 세개를 없애고 우클릭으로"였으므로 그대로 따랐다. 작업 카드·프로젝트·백로그도 모두 같은 제약이라 일관성은 유지된다.
