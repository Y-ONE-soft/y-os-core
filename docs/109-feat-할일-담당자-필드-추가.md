# 109. feat: 할일 담당자 필드 추가

요청 사이클 `작업현황-담당자-보드`의 **태스크 1/2**. 다음 태스크(담당자 보드 뷰)가
"누구의 할일인지"로 컬럼을 묶으려면 할일에 담당자가 있어야 하는데, 지금까지
배정 개념은 **프로젝트 소유자(`Project.ownerId`)뿐**이라 할일 단위로는 알 수 없었다.

이 태스크는 **필드와 지정 수단만** 만든다. 담당자 보드 화면은 태스크 2에서 만든다.

## 스키마

`Project.owner`와 같은 규칙을 따랐다 — FK 스칼라 + 관계 필드 + 인덱스,
그리고 `onDelete: SetNull`(사용자가 지워져도 할일은 남아야 한다).

```prisma
// Task
assigneeId String?
assignee   User?   @relation(fields: [assigneeId], references: [id], onDelete: SetNull)
@@index([assigneeId])

// User
assignedTasks Task[]
```

마이그레이션 `20260722210000_add_task_assignee`.

**추가 전용 변경이다.** nullable 컬럼이라 기존 행은 `NULL`(= 미배정)이 되고, 이
컬럼을 모르는 기존 코드도 그대로 동작한다. 개발·프로덕션이 DB를 공유하는 구조라
파괴적 변경은 즉시 장애가 되므로(docs/33의 `DROP COLUMN` 사고) 이 점을 먼저
확인하고 사용자 승인을 받아 적용했다.

## 계층별 변경

경로는 `페이지 → lib/api → route.ts → server/service → Prisma` 규약 그대로다.

| 계층 | 파일 | 변경 |
| --- | --- | --- |
| 타입 | `src/types/workspace.ts` | `BoardTask.assigneeId?: string` |
| 서비스 | `src/server/workspace/service.ts` | `toTask` 매핑, `createTask` 입력, `TaskPatch` |
| 라우트 | `src/app/api/admin/tasks/route.ts` | POST 본문에서 `assigneeId` 수용 |
| 라우트 | `src/app/api/admin/tasks/[taskId]/route.ts` | **`PATCHABLE`에 `assigneeId` 추가** |
| 클라 API | `src/lib/api/workspace.ts` | `createTaskApi` 입력 |
| 스토어 | `src/components/features/projects/board-store.tsx` | `updateTask` 낙관적 갱신 |
| 화면 | `src/components/features/projects/task-detail-overlay.tsx` | 담당자 선택기 |

DTO 규약은 기존 필드를 따랐다 — 서버가 `null → undefined`로 바꿔 내려주고
(`toTask`), 타입은 `?: string`으로 둔다. `| null`은 Prisma·`TaskPatch` 계층에만 남는다.

## 놓치기 쉬운 두 곳

### 1. `PATCHABLE` 화이트리스트 — 빠뜨리면 조용히 무시된다

`[taskId]/route.ts`는 허용 목록에 있는 키만 패치에 복사한다.

```ts
for (const key of PATCHABLE) if (key in body) patch[key] = body[key];
```

여기에 `assigneeId`를 넣지 않으면 PATCH가 **버려지는데 라우트는 `{ ok: true }`를
돌려준다.** 클라이언트에서는 성공으로 보이고 화면도 낙관적 갱신으로 바뀌므로,
새로고침해야 비로소 안 되는 걸 알게 된다. 검증 항목으로도 따로 넣었다.

### 2. 담당자 **해제**는 `null`이어야 한다

`undefined`는 `JSON.stringify`에서 키째 사라진다. 그러면 위의 `key in body`가
거짓이 되어 해제가 무시된다. 그런데 로컬 상태(`BoardTask`)는 미배정을
`undefined`로 표현한다. 두 규격이 반대라 스토어에서 갈라 놓았다.

```ts
// 로컬 상태는 BoardTask 규격(미배정 = undefined)이라 null을 맞춰 준다.
// 서버로는 null 그대로 보내야 한다 — undefined는 JSON에서 사라져
// 라우트의 `key in body` 검사를 통과하지 못하고 해제가 무시된다.
const localPatch: Partial<BoardTask> =
  "assigneeId" in patch
    ? { ...patch, assigneeId: patch.assigneeId ?? undefined }
    : (patch as Partial<BoardTask>);
```

## 담당자 선택기

할일 상세 오버레이의 `세부 사항` 패널에 넣었다. 프로젝트·단계 선택기와 같은
Radix `Select` 패턴이고, Radix가 빈 문자열 값을 금지하므로 기존
`BACKLOG_VALUE`·`UNASSIGNED_VALUE`와 같은 방식으로 `NO_ASSIGNEE_VALUE` 센티널을
두고 경계에서 `null`로 바꾼다.

항목은 아바타(이름 첫 글자, `avatarColor`로 id에서 결정적 파생) + 이름 + 직책이다.
`useUsers()` 훅과 `avatarColor`는 이미 있어 그대로 썼고, `admin/users`는 원래
**스탭도 호출 가능**하도록 열려 있어 API 변경이 필요 없었다.

목록은 **전체 직원**이다 — 마스터가 보는 담당자 범위를 "전체 직원 + 미배정"으로
정한 사용자 결정에 맞췄다.

## 검증

`localhost:3051`에서 실제 라우트를 쳐서 확인했다(UI는 puppeteer 클릭).

| 검증 | 결과 |
| --- | --- |
| 생성 시 `assigneeId` 저장 | PASS |
| 미지정 생성 시 `null` | PASS |
| PATCH로 담당자 지정 | PASS |
| PATCH `null`로 담당자 해제 | PASS |
| 다른 필드 PATCH가 담당자를 보존 | PASS |
| 다른 필드 PATCH는 정상 반영 | PASS |
| 할일 상세에 `담당자` 필드 존재 | PASS |
| 선택기가 현재 담당자를 표시 | PASS |

`npx tsc --noEmit`, `npm run build`, `npm run lint` 통과. 콘솔 에러 없음.

### 검증 중 겪은 공유 DB 간섭

첫 실행에서 2건이 FAIL이었는데, 원인은 코드가 아니라 **다른 세션이 검증 도중
워크스페이스를 리셋한 것**이었다. 확인해 보니 단계 id가 전부 바뀌어 있고 내가
만든 픽스처(단계·할일)가 사라져 있었다 — `resetWorkspace()`는 `ProjectGroup`을
지워 프로젝트·단계·할일까지 cascade로 날린다. 재실행하니 8건 전부 통과했다.

앞서 docs/94에서 "다른 세션이 공유 DB를 건드린 것으로 보이나 확증은 없다"고
남겼던 흔들림과 **같은 원인이며, 이번에는 확인됐다.** 개발·프로덕션 DB 공유
구조에서 병렬 세션이 검증할 때 반복될 수 있다.

## 다음 (태스크 2)

담당자 보드 뷰 — Figma `Task Status Layout — Master · Assignee`(`207:892`),
보드 본체 `207:1189`. 담당자별 컬럼(아바타·이름·직책·수치·부하 막대 + 할일 카드),
마스터는 전체 직원 + 미배정, 스탭은 본인만.
