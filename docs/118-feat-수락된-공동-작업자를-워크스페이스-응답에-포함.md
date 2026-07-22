# feat: 수락된 공동 작업자를 워크스페이스 응답에 포함

요청 사이클 `작업자-표시`의 1번 태스크. 세 상세 화면에 작업자 칸을 그리려면 **사람의 이름**과 **수락된 공동 작업자**가 필요한데 둘 다 응답에 없었다. 서버 DTO만 먼저 채운다. 화면은 2번 태스크.

## 배경

요청은 "프로젝트 상세·단계 상세·할 일 상세에 작업자 칸을 만들어 아바타와 이름이 같이 보이게, 세 곳 동일 위치로 통일"이었다. 대화 중 두 가지가 더 확정됐다.

- **셀렉트가 아니라 선택된 사람이 보여야 한다** — 할 일 상세에는 담당자 셀렉트가 이미 있었지만 "고르는 UI"였지 "지금 누가 작업자인지"를 보여주지 않았다
- **공동 작업자 요청이 수락되면 그 사람도 함께** 보여야 한다

### 응답에 없던 것

| 필요한 값 | 기존 응답 |
|---|---|
| 할일 담당자 **이름** | `assigneeId`(id)만 있음 |
| 프로젝트 작업자 **이름** | `ownerId`(id)만 있음 |
| 수락된 공동 작업자 | **아예 없음** |

id만으로는 아바타·이름을 그릴 수 없다. 화면에서 별도 조회를 붙일 수도 있지만, 보드 전체를 한 번에 내려주는 `getWorkspace`의 성격상 함께 담는 편이 맞다.

**`Stage.requestedCollaborators`는 답이 아니다.** 이름이 비슷해 오해하기 쉬운데, 이 배열은 *요청을 보내기 전 화면에서 고른 값*이라 수락 여부와 무관하다. 수락된 공동 작업자의 진실은 `Request` 테이블(`kind=ASSIGN`, `status=ACCEPTED`)에 있다.

## 결정 사항 (사용자 승인)

| 항목 | 선택 |
|---|---|
| 단계의 담당 | `Stage`에 필드를 추가하지 않고 **상위 프로젝트 작업자를 표시** (스키마 변경 없음) |
| 화면 표기 | **"작업자"로 통일** (할 일 상세의 기존 "담당자" 라벨도 변경 — 2번 태스크) |
| 프로젝트 작업자 칸 | **읽기 전용** — `ownerId`는 스탭 권한 판정 기준이라 화면에서 바꾸면 권한이 함께 움직인다 |

## 변경 내용

### 1. `src/types/workspace.ts`

사람을 그리는 데 필요한 최소 정보를 타입으로 뽑았다.

```ts
/** 화면에 사람을 아바타+이름으로 그리는 데 필요한 최소 정보 */
export type WorkspaceMember = {
  id: string;
  name: string;
  title?: string;
};
```

- `Project.owner?: WorkspaceMember` 추가
- `BoardTask.assignee?: WorkspaceMember` 추가
- `BoardTask.collaborators?: WorkspaceMember[]` 추가
- `BoardStage.collaborators?: WorkspaceMember[]` 추가

`ownerId`·`assigneeId`는 **그대로 뒀다.** 스탭 사이드바 필터·담당자 보드 그룹핑이 id로 판정하고 있어, 바꾸면 무관한 화면이 함께 흔들린다.

`collaborators` 주석에 `requestedCollaborators`와 다른 값임을 명시했다.

### 2. `src/server/workspace/service.ts`

**사람 정보는 필요한 필드만 select한다.**

```ts
/** 화면에 사람을 그릴 때 필요한 필드만 — User 전체를 include하지 않는다 */
const MEMBER_SELECT = { id: true, name: true, title: true } as const;
```

`include: { assignee: true }`로 두면 `passwordHash`까지 응답에 실린다. 워크스페이스는 로그인한 모든 사용자가 받는 데이터라 그대로 두면 안 된다.

**수락된 요청을 대상 id별로 묶는다.**

```ts
async function acceptedCollaborators(): Promise<CollaboratorMap> {
  const accepted = await db.request.findMany({
    where: { kind: "ASSIGN", status: "ACCEPTED" },
    select: { taskId: true, stageId: true, toUser: { select: MEMBER_SELECT } },
    orderBy: { respondedAt: "asc" },
  });
  …
}
```

- `Request`는 `taskId` 또는 `stageId` 중 하나만 채워지므로 `taskId ?? stageId`로 대상 키를 잡는다
- **같은 사람이 여러 번 수락된 이력이 있어도 한 번만 넣는다.** 요청이 취소·재발송될 수 있어 중복이 가능하다
- `respondedAt` 오름차순 — 먼저 수락한 사람이 앞에 온다

조회는 `Promise.all`에 합류시켰다. 순차로 붙이면 왕복이 하나 늘어난다.

**`Project`에 `owner`를 include**하고 `toMember`로 변환해 내려보낸다.

## 검증

`npm run build` 성공(타입 검사 포함), `npm run lint` 경고 0.

dev 서버(포트 3121)에서 실제 요청 흐름을 태워 검증했다. **전용 픽스처**(프로젝트·단계·할일)를 만들어 확인했다.

### 수락 전

```
단계 collaborators: null
할일 collaborators: null
할일 assignee: 노윤기
프로젝트 owner: 노윤기
```

`assignee`·`owner`가 **이름과 함께** 내려오고, 요청을 보내기만 한 상태에서는 `collaborators`가 비어 있다 — `requestedCollaborators`와 구분되는 것이 확인된다.

### 마스터 → 스탭 지정 요청 2건(할일·단계)을 스탭이 수락한 뒤

```
프로젝트 owner   : 노윤기
단계 collaborators: 김주웅(사원)
할일 assignee     : 노윤기
할일 collaborators: 김주웅(사원)
```

수락 즉시 공동 작업자가 **이름·직책과 함께** 실린다.

## 변경 파일 내역

| 파일 | 구분 | 내용 |
|---|---|---|
| `src/types/workspace.ts` | 수정 | `WorkspaceMember` 추가, `Project.owner`·`BoardTask.assignee`·`collaborators`(할일·단계) 노출 |
| `src/server/workspace/service.ts` | 수정 | `MEMBER_SELECT`·`toMember`·`acceptedCollaborators` 추가, `getWorkspace`가 owner·assignee·collaborators를 채우도록 |

## 알려진 이슈 / 주의점

### 이 커밋만으로는 화면이 바뀌지 않는다

응답에 값이 실릴 뿐 어느 화면도 아직 쓰지 않는다. 2번 태스크에서 작업자 칸을 그린다.

### 프로젝트에는 공동 작업자가 없다

`Request`의 대상이 `taskId`·`stageId`뿐이라 프로젝트 단위 공동 작업자는 개념 자체가 없다. 프로젝트 상세의 작업자 칸은 **작업자 1명만** 표시된다. 필요해지면 `Request.projectId` 추가가 선행돼야 한다.

### 단계 작업자는 프로젝트에서 빌려온 값이다

`Stage`에 담당 필드가 없어 상위 프로젝트의 작업자를 보여준다. 단계마다 다른 사람이 주担당인 운영 방식이라면 맞지 않는다. `Stage.assigneeId`를 추가하는 편이 정확하지만 이번 결정은 스키마를 건드리지 않는 쪽이었다.

### 요청이 늘면 조회가 전체 스캔이다

`acceptedCollaborators()`는 수락된 ASSIGN 요청을 **전부** 가져온다. 지금 규모에서는 문제없지만, 요청이 쌓이면 보드와 무관한 행까지 읽는다. `taskId`/`stageId` 인덱스는 있으나 `kind`·`status` 복합 인덱스는 없다. 프로젝트 범위로 좁히거나 인덱스를 추가할 여지가 있다.

### 거절·취소 후 재수락 이력

같은 사람이 여러 번 수락된 경우 중복 제거로 한 번만 보여준다. 다만 "언제부터 공동 작업자인지"는 알 수 없다 — 목록에 시각을 표시할 계획이 생기면 `respondedAt`을 함께 내려야 한다.
