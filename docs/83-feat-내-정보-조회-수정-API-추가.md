# feat: 내 정보 조회·수정 API 추가

요청 사이클 `내-정보-페이지`의 1번 태스크. "아바타 드롭다운 후 내 정보 페이지, 편집 기능도" 요청을 처리하기 위한 서버·클라이언트 API 계층. 화면은 2번 태스크.

## 배경

유저 메뉴 드롭다운에는 이미 "내 정보" 항목이 있었지만 `onSelect`가 없어 **눌러도 아무 일이 없는 상태**였다(`알림`·`프리셋 관리`·`설정`도 동일, 동작하는 건 `로그아웃`뿐). 내 정보 페이지 자체가 없었고, **사용자 정보를 수정하는 API도 전혀 없었다.**

## 결정 사항 (사용자 승인)

| 항목 | 선택 | 이유 |
|---|---|---|
| 비밀번호 변경 | **이번엔 제외** | 현재 비밀번호 검증·해싱·기존 세션 무효화가 딸린 별도 보안 흐름. 사이클을 나누는 게 안전하다 |
| 연락처(`phone`) | **세션에 추가해 편집** | DB에는 있는데 `SessionUser`에서만 빠져 있었다. 내 정보 페이지에 연락처가 없으면 어색하다 |

## 변경 내용

### 1. `src/types/auth.ts`

`SessionUser`에 `phone: string | null` 추가. 더해 편집 가능 범위를 타입으로 못박았다.

```ts
/** 내 정보 페이지에서 본인이 바꿀 수 있는 필드 — 아이디·역할·소속은 제외 */
export type ProfilePatch = Partial<{
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
}>;
```

`username`(로그인 아이디)·`role`·`groupId`가 **타입에 아예 없다.** 주석이 아니라 타입으로 막아야 나중에 누가 무심코 넓히지 못한다.

### 2. `src/server/auth/service.ts`

`toSessionUser`에 `phone` 추가. `updateProfile`과 전용 에러를 새로 만들었다.

```ts
export async function updateProfile(
  userId: string,
  patch: ProfilePatch,
): Promise<SessionUser | null> {
  // 이메일은 @unique — 먼저 확인해 Prisma 제약 위반(500) 대신 의미 있는 에러를 낸다.
  // 경합으로 빠져나가는 경우는 아래 catch가 받는다.
  if (patch.email) {
    const taken = await db.user.findFirst({
      where: { email: patch.email, id: { not: userId } },
      select: { id: true },
    });
    if (taken) throw new EmailTakenError();
  }
  try {
    const updated = await db.user.update({ where: { id: userId }, data: patch });
    return toSessionUser(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new EmailTakenError();
    }
    throw error;
  }
}
```

**이메일 중복을 두 겹으로 처리한다.** 사전 조회만 두면 두 요청이 동시에 같은 이메일을 넣을 때 통과해 Prisma가 P2002를 던지고 500이 된다. 사전 조회는 흔한 경우를 친절하게, `catch`는 경합을 안전하게 받는다.

`id: { not: userId }` 조건이 중요하다 — 이게 없으면 **자기 이메일을 그대로 저장하는 것도 "중복"으로 막힌다.**

`EmailTakenError`를 별도 클래스로 둔 것은 라우트가 상태 코드를 정하기 위해서다. 서비스가 HTTP를 알 필요는 없다.

### 3. `src/app/api/auth/me/route.ts` — `PATCH` 추가

**대상을 요청이 아니라 세션에서 정한다.**

```ts
// 수정 대상을 요청이 아니라 세션에서 정한다 — id를 아예 받지 않으므로
// 남의 계정을 가리키는 우회가 성립하지 않는다.
const current = token ? await getSessionUser(token) : null;
```

`/api/admin/users/[userId]` 형태로 만들었다면 "이 id가 정말 본인인가"를 매번 검사해야 하고, 한 번 빠뜨리면 남의 정보를 고칠 수 있다. **id를 받지 않으면 그 검사 자체가 필요 없다.**

허용 필드는 화이트리스트다.

```ts
/** 본인이 바꿀 수 있는 필드만 — username·role·groupId는 의도적으로 빠져 있다 */
const EDITABLE = ["name", "title", "email", "phone"] as const;
```

**빈 문자열은 `null`로 정규화한다.** 직책·이메일·연락처는 선택 항목이라 "지우기"가 가능해야 하는데, 빈 문자열로 저장하면 `null`인 기존 데이터와 두 가지 "비어 있음"이 생긴다. 이름만 필수로 두고 공백뿐이면 400을 낸다.

편집 가능한 필드가 하나도 없으면 400이다. `{"role":"MASTER"}`처럼 편집 불가 필드만 보낸 요청이 조용히 200으로 성공하면, 호출자는 반영된 줄 안다.

### 4. `src/lib/api/auth.ts`

```ts
/** 내 정보 수정 — 수정된 세션 사용자를 그대로 돌려받아 컨텍스트를 갱신한다 */
export async function updateMe(patch: ProfilePatch): Promise<SessionUser> {
  const { user } = await api.patch<{ user: SessionUser }>("/api/auth/me", patch);
  return user;
}
```

응답으로 수정된 `SessionUser`를 그대로 돌려준다. 저장 후 `fetchMe()`를 다시 호출하면 왕복이 한 번 더 늘고 그 사이 헤더가 옛 이름을 보여준다.

## 검증

`npm run build` 성공(타입 검사 포함), `npm run lint` 경고 0.

dev 서버(포트 3071)에 실제 HTTP 요청으로 검증했다.

### 정상 수정

```
① 현재   이름=스탭 직책=사원 이메일=step01@y-os.local 연락처=010-0000-0002
② 수정 [200]
        이름=스탭 수정 직책=선임 연락처=010-1234-5678
```

### 권한 상승 차단 (핵심)

편집 불가 필드를 함께 실어 보냈다.

```
요청: {"username":"hacker","role":"MASTER","groupId":"g-printing","name":"변조 시도"}
결과 [200]
  이름=변조 시도   ← name만 반영
  아이디=step01  역할=STAFF  소속=g-soft   ← 전부 그대로
```

`role: "MASTER"`를 보내도 `STAFF`가 유지된다. 화이트리스트가 의도대로 동작한다.

### 경계

| 시나리오 | 결과 |
|---|---|
| 다른 계정의 이메일로 변경 | **409** `이미 사용 중인 이메일입니다.` |
| 이름을 공백으로 | **400** `이름을 입력하세요.` |
| 편집 불가 필드만 전송 | **400** `잘못된 요청입니다.` |
| 비로그인 | **401** `인증이 필요합니다.` |
| 직책을 빈 문자열로 (지우기) | **200**, `title=null` |

검증 후 시드 값(`스탭 / 사원 / step01@y-os.local / 010-0000-0002`)으로 복구했다.

## 변경 파일 내역

| 파일 | 구분 | 내용 |
|---|---|---|
| `src/types/auth.ts` | 수정 | `SessionUser.phone`, `ProfilePatch` 타입 추가 |
| `src/server/auth/service.ts` | 수정 | `phone` 매핑, `updateProfile`·`EmailTakenError` 추가 |
| `src/app/api/auth/me/route.ts` | 수정 | `PATCH` 핸들러 — 세션 기준 대상 고정, 화이트리스트, 정규화 |
| `src/lib/api/auth.ts` | 수정 | `updateMe` 추가 |

## 알려진 이슈 / 주의점

### 이 커밋만으로는 화면에서 쓸 수 없다

페이지와 폼이 없어 사용자가 정보를 고칠 방법이 아직 없다. 2번 태스크에서 완결된다.

### 비밀번호는 바꿀 수 없다

이번 범위에서 제외했다. 시드 비밀번호가 `1111`로 고정돼 있고 변경 수단이 없으므로 **운영 전에는 반드시 비밀번호 변경 흐름이 필요하다.**

### 이메일 형식은 검증하지 않는다

`@unique` 충돌만 막고 형식은 보지 않는다. 브라우저 `input[type=email]`이 1차로 걸러주지만 API를 직접 호출하면 아무 문자열이나 들어간다. 이메일이 로그인 식별자로도 쓰이므로(`login`이 `username` 또는 `email`로 조회) 형식 검증을 추가할 가치가 있다.

### 이름 길이 제한이 없다

과도하게 긴 이름이 헤더·목록 레이아웃을 밀어낼 수 있다. 화면에서는 `truncate`로 잘리지만 저장 자체는 막지 않는다.

### 다른 세션의 캐시된 사용자 정보

같은 계정으로 여러 탭·기기가 열려 있으면 다른 곳의 세션 컨텍스트는 옛 값을 들고 있다. 새로고침 전까지 갱신되지 않는다. 실사용에 큰 문제는 아니지만 알고 있을 만하다.
