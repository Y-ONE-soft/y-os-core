# feat: 데이터 초기화 확인 다이얼로그 추가

요청 사이클 `초기화-확인-다이얼로그`의 단일 태스크. 사이드바 하단 "데이터 초기화" 버튼에 확인 단계를 넣는다.

## 배경 — 왜 지금 필요해졌나

docs/46(워크스페이스 시드 정리) 이전에는 초기화를 눌러도 시드 프로젝트·단계·작업이 다시 만들어졌다. 사실상 **"시드 상태로 되돌리기"** 였고, 잘못 눌러도 손실이 크지 않았다.

시드에서 프로젝트 이하를 제거하면서 초기화는 **순수 삭제**가 됐다. 이제 누르는 즉시 모든 프로젝트·단계·작업이 사라지고 복구 수단이 없다. 게다가 버튼은 사이드바 하단에 상시 노출돼 있고 `onClick`에 직접 묶여 있어 **한 번의 오클릭으로 전체가 날아가는 구조**였다.

docs/46 문서에 "실사용 단계에서는 점검할 가치가 있다"고 남겨둔 항목을 처리한다.

## 변경 내용

### 1. `src/components/ui/alert-dialog.tsx` (신규)

shadcn/ui의 alert-dialog 컴포넌트를 추가했다. **`npx shadcn@latest add alert-dialog`를 쓰지 않고 직접 작성**했다.

이유는 import 규약이다. 이 저장소의 기존 UI 컴포넌트는 개별 Radix 패키지가 아니라 **통합 패키지 `radix-ui`에서 가져온다.**

```ts
// 기존 dialog.tsx, context-menu.tsx와 동일한 방식
import { AlertDialog as AlertDialogPrimitive } from "radix-ui"
```

shadcn CLI는 보통 `@radix-ui/react-alert-dialog`를 새 의존성으로 설치하는데, 통합 패키지에 이미 포함된 프리미티브라 **중복 의존성이 된다.** "새 의존성 추가는 신중하게 — 가볍고 빠른 서비스가 목표"라는 규약에 따라 기존 패턴을 그대로 따랐다.

결과적으로 **`package.json`·`package-lock.json` 변경이 0건**이다.

구성은 shadcn 표준과 동일하다 — `AlertDialog`/`Trigger`/`Portal`/`Overlay`/`Content`/`Header`/`Footer`/`Title`/`Description`/`Action`/`Cancel`. `Action`·`Cancel`은 `buttonVariants()`를 재사용해 버튼 스타일을 맞췄다.

### 2. `src/components/layout/projects-nav.tsx`

기존에는 버튼이 초기화를 직접 실행했다.

```tsx
<button type="button" onClick={resetData} ...>
  <RotateCcw className="size-3.5 shrink-0" />
  데이터 초기화
</button>
```

이제 같은 버튼을 `AlertDialogTrigger`로 감싸고, 실제 실행은 다이얼로그의 확인 버튼으로 옮겼다.

```tsx
{/* 초기화는 되돌릴 수 없다 — 시드 정리 이후 프로젝트·단계·작업이
    복원되지 않으므로 확인 단계를 둔다 (docs/46) */}
<AlertDialog>
  <AlertDialogTrigger asChild>
    <button type="button" className="...">…</button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>데이터를 초기화할까요?</AlertDialogTitle>
      <AlertDialogDescription>
        모든 프로젝트·단계·작업이 삭제되고 그룹만 남습니다. 삭제된
        데이터는 복구할 수 없습니다.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>취소</AlertDialogCancel>
      <AlertDialogAction
        className={cn(buttonVariants({ variant: "destructive" }))}
        onClick={resetData}
      >
        초기화
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

버튼의 마크업·클래스는 그대로 유지해 시각적 변화가 없다. `asChild`로 트리거를 위임하므로 DOM에 래퍼 엘리먼트가 추가되지도 않는다.

**문구 선정** — "그룹만 남습니다"를 명시했다. docs/46에서 그룹은 삭제 대상이 아니므로, "전부 삭제"라고만 쓰면 실제 동작과 어긋난다. 복구 불가라는 점도 함께 적었다.

확인 버튼에 `destructive` variant를 적용해 취소(outline)와 시각적으로 구분했다. 기본 포커스는 Radix가 `Cancel`에 두므로, 엔터를 잘못 눌러도 초기화가 실행되지 않는다.

`cn`은 이 파일에서 이미 import 중이라 추가하지 않았고, `buttonVariants`만 새로 가져왔다.

## 검증

`npm run build` 성공(타입 검사 포함), `npm run lint` 경고 0, **`package.json`/`package-lock.json` diff 0건**(새 의존성 없음).

dev 서버(포트 3031)로 렌더 결과를 확인했다. 3001·3002·3011은 다른 세션이 점유 중이었다.

master01 로그인 후 `/projects` HTML에서 초기화 버튼이 다이얼로그 트리거로 바뀐 것을 확인했다.

```html
<button type="button" class="flex h-8 w-full items-center gap-2 …"
        aria-haspopup="dialog" aria-expanded="false"
        data-state="closed" data-slot="alert-dialog-trigger">
```

`aria-haspopup="dialog"`와 `data-state="closed"`가 붙어 있고, **더 이상 클릭 즉시 초기화가 실행되지 않는다.** 버튼 클래스는 변경 전과 동일해 외형 회귀도 없다.

### 검증하지 못한 것

**다이얼로그를 실제로 열고 "초기화"를 눌러보는 클릭 스루는 하지 못했다.** 두 가지 이유다.

1. 이 저장소에 브라우저 자동화 도구(playwright·puppeteer)가 없고, 이 작업만을 위해 새 devDependency를 넣는 것은 과하다고 판단했다
2. 확인 버튼을 실제로 누르면 **공유 개발 DB의 모든 프로젝트·단계·작업이 삭제된다.** 다른 세션 5개가 작업 중이라 실행할 수 없다

따라서 검증 범위는 "트리거로 정상 전환됐고 즉시 실행이 사라졌다"까지다. 다이얼로그 내용 렌더와 확인 버튼 동작은 Radix Portal이 열릴 때 마운트되므로 SSR HTML에 나타나지 않는다. **사용자가 화면에서 한 번 눌러 확인해 주시는 것이 확실하다.**

## 변경 파일 내역

| 파일 | 구분 | 내용 |
|---|---|---|
| `src/components/ui/alert-dialog.tsx` | 신규 | shadcn alert-dialog — 통합 `radix-ui` 패키지 기반으로 직접 작성 |
| `src/components/layout/projects-nav.tsx` | 수정 | 초기화 버튼을 `AlertDialogTrigger`로 전환, 실행을 확인 버튼으로 이동 |

## 알려진 이슈 / 주의점

### 초기화는 여전히 공유 DB 전체에 영향을 준다

확인 단계가 생겼을 뿐, 실행하면 **다른 세션의 작업 데이터까지 함께 사라진다.** 병렬 세션이 없을 때 실행해야 한다는 점은 그대로다. 다이얼로그 문구에 이 내용까지 넣을지 고민했으나, 개발 환경 사정이라 제품 문구에는 넣지 않았다.

### 마스터 전용 노출은 아니다

초기화 버튼은 `!collapsed`일 때 역할과 무관하게 노출된다. 스탭도 누를 수 있고, `POST /api/admin/workspace/reset`도 역할 가드가 없다. 이번 범위 밖이라 손대지 않았으나, **스탭이 전체 워크스페이스를 지울 수 있다는 뜻이므로** 권한 정리가 필요하다. 프로젝트 생성 권한을 정비한 docs/36~38의 후속으로 다룰 만하다.

### 사이드바 접힘 상태에서는 버튼이 없다

기존 동작 그대로다(`!collapsed` 조건). 변경하지 않았다.
