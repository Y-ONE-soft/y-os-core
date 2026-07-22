# 116. feat: 할일 등록 시 담당자 기본값 지정

요청 사이클 `담당자-기본값-상태-라벨`의 **태스크 1/2**.

> 사용자 지적: "내프로젝트에서 할일을 등록하면 내가 고정 담당자인데 왜 담당자가
> 없다고 나와 이거 디폴트 아니야?"

docs/109에서 `Task.assigneeId`를 넣을 때 **기본값을 두지 않았다.** 그래서 할일을
등록하면 전부 `미배정`으로 들어갔고, 담당자 보드의 `미배정` 컬럼만 계속 쌓였다.
자기 프로젝트에 자기가 등록한 할일이 "담당자 없음"으로 보이는 건 명백히 어색하다.

## 규칙

**프로젝트 소유자 → 없으면 만든 사람.**

`Project.ownerId`는 생성 시 `ownerId: user.id`(= 만든 사람)로 채워지므로, 내
프로젝트에 등록하면 결국 내가 담당자가 된다. 프로젝트가 없는 할일(내 할일)은
소유자가 없으니 만든 사람이 담당이다.

| 상황 | 담당자 |
| --- | --- |
| 내 프로젝트(단계·백로그)에 등록 | 나 |
| 프로젝트 없이 등록 (내 할일) | 나 |
| 마스터가 **남의 프로젝트**에 등록 | 그 프로젝트 소유자 |
| `assigneeId`를 명시해 등록 | 명시한 사람 |
| `assigneeId: null`을 명시해 등록 | 미배정 (기본값 적용 안 함) |

마지막 두 줄이 핵심이다 — **"키를 안 보냄"과 "null을 보냄"을 구분**해야 한다.
전자는 "알아서 정해줘", 후자는 "일부러 미배정". 둘을 뭉개면 미배정을 선택할 수
없게 된다.

## 서버가 정한다

기본값은 서버에서 채운다. 클라이언트에도 같은 규칙을 두면 두 곳이 어긋나고,
API를 직접 호출하는 경로(다른 화면·추후 백엔드 분리)가 규칙을 비켜 간다.

```ts
export async function createTask(input: {
  ...
  /** 생략 = 기본값 규칙 적용, null = 미배정으로 명시 */
  assigneeId?: string | null;
  /** 기본값의 최후 후보 — 요청한 사용자 */
  createdById: string;
}) {
  const { createdById, ...data } = input;
  if (data.assigneeId !== undefined) {
    return db.task.create({ data });
  }
  const owner = data.projectId
    ? (await db.project.findUnique({
        where: { id: data.projectId },
        select: { ownerId: true },
      }))?.ownerId
    : null;
  return db.task.create({ data: { ...data, assigneeId: owner ?? createdById } });
}
```

라우트는 세 상태를 그대로 넘긴다.

```ts
assigneeId:
  body.assigneeId === undefined
    ? undefined
    : isName(body.assigneeId)
      ? body.assigneeId
      : null,
createdById: user.id,
```

## 화면이 바로 반영되게

`board-store`의 낙관적 갱신은 `{ id, name, done: false }`만 만든다 — 담당자는
서버가 정하므로 클라이언트가 알 수 없다. 그대로 두면 새 할일이 담당자 보드의
`미배정` 컬럼에 잘못 떠 있다가 새로고침해야 제자리를 찾는다.

`persist`는 **실패했을 때만** 재동기화하므로 성공 경로에서는 서버 값이 오지 않는다.
그래서 성공해도 맞추는 짝을 하나 만들었다.

```ts
/**
 * 성공해도 서버 상태로 다시 맞춘다 — **서버가 값을 채워 주는** 생성에 쓴다
 * (할일 담당자 기본값처럼). 같은 규칙을 클라이언트에도 복제하면 두 곳이
 * 어긋나므로, 낙관적 반영은 그대로 두되 응답 후 서버 값으로 덮는다.
 */
export function persistAndSync(operation: Promise<unknown>) {
  persist(operation.then(() => refresh()));
}
```

할일 생성 3경로(`addTask`·`addBacklogTask`·`addUnassignedTask`)를 이걸로 바꿨다.
규칙을 복제하지 않는 대신 생성 때 워크스페이스를 한 번 더 읽는 비용을 택했다.

## 프리셋 경로도 함께

프리셋으로 프로젝트를 만들 때 생기는 할일은 `createTask`를 거치지 않고
`compose.ts`에서 직접 `tx.task.create`로 만들어진다. 여기만 빠지면 프리셋으로 만든
프로젝트의 할일이 통째로 미배정이 된다.

```ts
// 프리셋으로 만든 할일도 담당자 기본값 규칙을 따른다 —
// 이 프로젝트의 소유자가 곧 만든 사람이다
assigneeId: input.ownerId,
```

`createProjectWithEvenStages`(직접 만들기)는 할일을 만들지 않아 해당 없음.

## 기존 할일은 건드리지 않았다

이미 미배정으로 쌓인 할일을 소유자로 채우는 **데이터 보정은 하지 않았다**(사용자
선택). 담당자 보드의 `미배정` 컬럼에 남아 있으며, 필요하면 할일 상세에서 지정하거나
별도 마이그레이션 태스크로 처리하면 된다.

## 검증

| 검증 | 결과 |
| --- | --- |
| 내 프로젝트 단계에 등록 → 나 | PASS |
| 내 프로젝트 백로그에 등록 → 나 | PASS |
| 프로젝트 없이 등록(내 할일) → 나 | PASS |
| 담당자를 명시하면 그대로 | PASS |
| `null` 명시는 미배정 유지 | PASS |
| 스탭이 자기 프로젝트에 등록 → 스탭 | PASS |
| 마스터가 남의 프로젝트에 등록 → 프로젝트 소유자 | PASS |
| UI(보드 `＋ 할일`)로 추가해도 기본값 적용 | PASS |

`npx tsc --noEmit`, `npm run build`, `npm run lint` 통과. 콘솔 에러 없음.

### 검증 중 겪은 것 — 남의 서버를 검증하고 있었다

처음 실행에서 기본값 관련 5건이 전부 FAIL이었다. 원인은 코드가 아니라
**dev 서버가 뜨지 않은 것**이었다.

```
⨯ Failed to start server
Error: listen EADDRINUSE: address already in use :::3061
```

포트 3061을 다른 세션이 이미 쓰고 있었고, `curl`은 200을 돌려줬다 — 그 세션의 앱이
응답한 것이다. 즉 **내 변경이 없는 앱을 검증**하고 있었다. 빈 포트를 찾아 다시 띄우고
로그에 `Ready`가 찍힌 걸 확인한 뒤 재실행했다.

여기서 2차 피해가 하나 더 있었다. 그 실행이 중단되면서 **공유 DB에 픽스처가 남았고**,
다음 실행이 같은 id로 만들려다 실패해 **옛 데이터를 읽어** 여전히 FAIL이 났다.
잔재를 지우고 나서야 8건 전부 통과했다.

교훈 두 가지.
1. dev 서버는 **로그에서 `Ready`를 확인**해야 한다. `curl` 200은 내 서버라는 증거가
   아니다 — 포트를 선점한 남의 서버일 수 있다.
2. 검증이 중간에 죽으면 **공유 DB에 픽스처가 남는다.** 고정 id를 쓰는 테스트는
   시작 전에 정리하거나 매번 새 id를 써야 한다.

## 변경 파일

- `src/server/workspace/service.ts`
- `src/server/workspace/compose.ts`
- `src/app/api/admin/tasks/route.ts`
- `src/components/features/projects/workspace-cache.ts`
- `src/components/features/projects/board-store.tsx`
