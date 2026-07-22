# feat: 스탭 프로젝트 생성 권한 및 소속 그룹·작업자 자동 지정

요청 사이클 `스탭-프로젝트-생성`의 2번 태스크. 1번 태스크에서 만든 `User.groupId` / `Project.ownerId`를 실제로 사용해 **스탭(STAFF)의 프로젝트 생성을 허용**하고, 소속 그룹과 작업자를 서버가 결정하도록 한다.

사용자 요청 "step 권한에서 프로젝트 생성이 안 됨"의 **직접 원인을 제거하는 커밋**이다. 다만 생성된 프로젝트가 사이드바에 노출되는 것은 3번 태스크에서 완성된다.

## 문제

`src/app/api/admin/projects/route.ts`가 `user.role !== "MASTER"`이면 무조건 403을 반환했다.

```ts
if (user.role !== "MASTER") return forbidden();
```

반면 사이드바 `src/components/layout/projects-nav.tsx`는 `!isMaster && staffGroupId` 조건으로 스탭에게 "프로젝트 추가" 버튼을 노출한다. **UI는 허용하는데 API가 막는 불일치**였고, 사용자에게는 "버튼을 눌러도 아무 일도 안 일어남"으로 보였다.

## 변경 내용

### `src/app/api/admin/projects/route.ts`

**1) 역할 가드 제거 → 인증만 요구**

`forbidden()` 조기 반환을 삭제하고 `unauthorized()`만 남겼다. `forbidden` import도 제거했다(다른 라우트에서는 계속 사용하므로 `guard.ts`의 export는 유지).

**2) 소속 그룹을 역할별로 다르게 결정**

```ts
// 소속 그룹 결정 — 스탭은 클라이언트가 보낸 groupId를 신뢰하지 않고 세션
// 사용자의 소속 그룹으로 강제한다 (남의 그룹에 생성하는 우회 차단).
// 마스터는 전체 그룹을 다루므로 요청 값을 그대로 쓴다.
let groupId: string;
if (user.role === "MASTER") {
  if (!isName(body.groupId)) return badRequest();
  groupId = body.groupId;
} else {
  if (!user.groupId) {
    return badRequest("소속 그룹이 없어 프로젝트를 만들 수 없습니다.");
  }
  groupId = user.groupId;
}
```

핵심은 **스탭 요청의 `body.groupId`를 읽지 않는다**는 점이다. 검증 후 사용하는 것이 아니라 아예 세션 값으로 덮어쓴다. 사용자 요청의 "소속자도 자기가 속한 그룹으로 되어야 함"을 만족시키는 동시에, 스탭이 임의 `groupId`를 실어 다른 팀 그룹에 프로젝트를 만드는 권한 우회를 차단한다.

`body.groupId` 필수 검증도 마스터 분기 안으로 옮겼다. 스탭은 이 값을 보낼 필요가 없기 때문이다(현재 클라이언트는 여전히 보내지만 서버가 무시한다 — 클라이언트 정리는 3번 태스크).

소속 그룹이 없는 스탭은 400과 함께 사유를 문자열로 돌려준다. `guard.ts`의 `badRequest`가 이미 메시지 인자를 받도록 돼 있어 그대로 활용했다.

**3) 작업자 = 만든 사람**

```ts
ownerId: user.id, // 작업자 = 만든 사람
```

역할 분기 없이 마스터·스탭 모두 생성자를 작업자로 넣는다. 규칙이 하나여야 나중에 배정 도메인이 들어올 때 예외가 남지 않는다. (아래 "결정 사항" 참고)

### `src/server/workspace/service.ts`

`createProject` 입력에 `ownerId: string | null`을 추가했다. `db.project.create({ data: input })`은 그대로라 전달만 하면 된다.

```ts
export function createProject(input: {
  id: string;
  groupId: string;
  name: string;
  color: string;
  /** 작업자 — 생성한 사용자. 배정 도메인 도입 전까지 "만든 사람 = 작업자" */
  ownerId: string | null;
}) {
```

타입을 `string | null`로 둔 것은 스키마가 nullable이고, 향후 시스템 생성 등 작업자 없는 경로가 생길 수 있어서다. 현재 호출부는 항상 `user.id`를 넘긴다.

## 결정 사항

**마스터가 만든 프로젝트의 작업자도 생성자(마스터)로 둔다.** 사용자 요청의 "작업자는 자기 자신"은 스탭 맥락에서 나온 말이지만, 역할별로 다른 규칙을 두면 "마스터가 만들면 작업자 없음"이라는 예외가 생긴다. 배정 UI가 없는 현 시점에는 생성자를 넣어두고, 배정 도메인 도입 시 일괄 재정의하는 편이 정리하기 쉽다고 판단했다.

**마스터의 `groupId`는 계속 요청 값을 쓴다.** 마스터 사이드바는 그룹별로 "프로젝트 추가"가 달려 있어 어느 그룹에 만들지가 UI에서 이미 결정된다. 마스터까지 자기 소속(`g-soft`)으로 강제하면 기존 동작이 깨진다.

## 검증

`npm run build` 성공, `npm run lint` 경고 0. 이어서 dev 서버(포트 3011)를 띄우고 **실제 HTTP 호출로 end-to-end 검증**했다.

> 포트 3001·3002·3009는 다른 세션의 dev 서버가 점유 중이어서 3011을 사용했다. 최초에 3001로 띄우려다 실패했고, 그때 받은 404 응답은 다른 세션 서버의 것이었다.

### 1. 스탭 생성 + 그룹 위조 차단 (핵심)

```bash
curl -c step.txt -X POST /api/auth/login -d '{"username":"step01","password":"1111"}'
# {"user":{...,"role":"STAFF","groupId":"g-soft",...}}

# groupId를 g-printing으로 위조해서 전송
curl -b step.txt -X POST /api/admin/projects \
  -d '{"id":"p-verify-utf8","groupId":"g-printing","name":"한글 이름 검증","color":"#22c55e"}'
# {"ok":true} [HTTP 200]   ← 변경 전에는 403
```

DB 확인 결과 **위조한 `g-printing`이 무시되고 `g-soft`로 저장**됐고 작업자는 `step01`이었다.

| id | name | groupId | owner |
|---|---|---|---|
| `p-verify-utf8` | 한글 이름 검증 | **`g-soft`** | **`step01`** |

### 2. 마스터 회귀 — 요청 그룹이 유지되는가

```bash
curl -b master.txt -X POST /api/admin/projects \
  -d '{"id":"p-verify-master","groupId":"g-printing","name":"마스터 생성 검증","color":"#a855f7"}'
# {"ok":true} [HTTP 200]
```

| id | name | groupId | owner |
|---|---|---|---|
| `p-verify-master` | 마스터 생성 검증 | **`g-printing`** | `master01` |

요청한 그룹이 그대로 쓰였다 — 마스터 동작 회귀 없음.

### 3. 비로그인 차단

```bash
curl -X POST /api/admin/projects -d '{...}'
# {"error":"인증이 필요합니다."} [HTTP 401]
```

### 검증 중 확인한 것 — 한글 인코딩

첫 시도에서 프로젝트 이름이 `���� ���� ����`로 저장됐다. 앱 버그를 의심했으나, 같은 테이블의 기존 한글 이름(`화학강사 김한울 CMS 프로젝트`)은 정상 출력됐다. **셸 인라인 `-d`가 한글을 깨뜨린 것**으로, 본문을 UTF-8 파일에 써서 `--data-binary @file`로 보내니 `한글 이름 검증`이 정상 저장됐다. 앱 측 문제가 아니다.

### 정리

검증용으로 만든 `p-verify-staff`·`p-verify-utf8`·`p-verify-master` 3건은 삭제했다(`deleteMany` 반환 count = 3).

## 변경 파일 내역

| 파일 | 구분 | 내용 |
|---|---|---|
| `src/app/api/admin/projects/route.ts` | 수정 | MASTER 전용 가드 제거, 역할별 groupId 결정, ownerId 주입 |
| `src/server/workspace/service.ts` | 수정 | `createProject` 입력에 `ownerId` 추가 |

## 알려진 이슈 / 주의점

### 이 커밋만으로는 사용자 체감이 완결되지 않는다

스탭이 프로젝트를 만들면 DB에는 정상 생성되지만, 사이드바는 아직 하드코딩 상수 `STAFF_ASSIGNED_PROJECT_IDS`로 목록을 거르므로 **새 프로젝트가 화면에 나타나지 않는다.** 3번 태스크에서 `ownerId` 기준으로 바꿔야 "생성이 된다"가 눈에 보인다.

### 클라이언트는 아직 불필요한 `groupId`를 보낸다

`src/lib/api/workspace.ts`의 `createProjectApi`와 `project-store.tsx`의 `addProject(groupId, name)`은 그대로다. 스탭 경로에서 이 값은 서버가 버리므로 동작에는 영향이 없다. 3번 태스크에서 `staffGroupId` 배선을 걷어낼 때 함께 정리한다.

### 마스터의 잘못된 `groupId`는 여전히 500이다

존재하지 않는 `groupId`를 마스터가 보내면 FK 위반으로 Prisma가 던지고 500이 된다. 이번 변경 이전부터 있던 동작이라 범위 밖으로 두었다. 스탭 경로는 `onDelete: SetNull` 덕분에 그룹이 지워지면 `user.groupId`가 `null`이 되어 400으로 걸리므로 이 문제가 없다.

### 공유 개발 DB에서 관측된 외부 데이터 변경

검증 도중 시드 프로젝트 `p-cms`와 `p-wise`가 DB에서 사라진 것을 확인했다. 이 작업의 삭제는 `p-verify-*` 3건으로 한정돼 있었고 반환 count도 3이었다. 다른 세션 또는 브라우저에서 마스터 UI의 "프로젝트 삭제"로 지운 것으로 보인다(같은 시점에 `g-printing`에 이 작업과 무관한 `123` 프로젝트가 존재). 개발 DB가 전 세션 공유라는 CLAUDE.md 경고에 해당하는 사례이며, 이 커밋의 코드 변경과는 무관하다.
