# feat: 할일 요청·도움 요청 도메인 추가

- **예정 커밋 메시지**: `feat: 할일 요청·도움 요청 도메인 추가`
- **작업일**: 2026-07-22
- **작업 브랜치**: `요청-알림-실데이터`

---

## 1. 작업 내용 요약

사람 간 **요청**을 DB에 저장하는 도메인을 만들었다. 화면 연결은 다음 태스크이고, 이번에는 모델·마이그레이션·서비스·API 경계까지다.

기존에는 요청이라는 개념 자체가 없었다. 공동 작업자 지정은 `Stage.requestedCollaborators` 배열에 id를 **즉시 밀어넣을 뿐**이라 상대가 수락·거절할 여지가 없었고, 도움 요청은 화면 로컬 상태로만 존재해 버튼을 눌러도 아무 일도 일어나지 않았다.

## 2. 스키마

```prisma
enum RequestKind   { ASSIGN, HELP }
enum RequestStatus { PENDING, ACCEPTED, REJECTED, CANCELED }

model Request {
  id, kind, status(@default PENDING), message?, createdAt, respondedAt?
  fromUserId → User("SentRequests")
  toUserId   → User("ReceivedRequests")
  taskId?    → Task     // 대상은 할일 또는
  stageId?   → Stage    // 단계 중 하나
  @@index([toUserId, status]) / ([fromUserId, status]) / ([taskId]) / ([stageId])
}
```

- 마이그레이션: `20260722111001_add_requests` (적용 완료)
- `User`에 `sentRequests`·`receivedRequests` 역관계, `Task`·`Stage`에 `requests` 역관계 추가

### 설계 결정

| 결정 | 선택 | 이유 |
|---|---|---|
| 요청 종류 | `ASSIGN`(할일 요청) / `HELP`(도움 요청) 2종 | 사용자 요구가 정확히 이 둘이다. 확장은 enum에 추가하면 된다 |
| 대상 | `taskId` / `stageId` 둘 중 하나 (nullable 2개) | 공동 작업자 지정은 단계에서, 도움 요청은 할일에서 나온다. 다형 참조 테이블을 따로 두기엔 종류가 2개뿐이라 과하다 |
| 대상 삭제 시 | `onDelete: Cascade` | 할일·단계가 사라지면 그 요청은 의미가 없다 |
| 여러 명에게 보낼 때 | **사람별 1건**씩 생성 | 수락·거절이 사람마다 따로 일어나야 한다. 한 건에 여러 수신자를 묶으면 상태를 하나로 못 잡는다 |
| id 생성 | 클라이언트가 `rq-<uuid>`로 만들어 전송 | 이 저장소의 기존 규약(낙관적 업데이트 시 임시 id 치환 회피) |
| `status` 기본값 | `PENDING` | 생성 즉시 대기 상태 |

## 3. 변경 파일 내역

| 구분 | 파일 | 내용 |
|---|---|---|
| 수정 | `prisma/schema.prisma` | `RequestKind`·`RequestStatus` enum, `Request` 모델, 역관계 3곳 |
| 추가 | `prisma/migrations/20260722111001_add_requests/migration.sql` | 마이그레이션 |
| 추가 | `src/types/requests.ts` | `RequestKind`·`RequestStatus`·`RequestTarget`·`WorkRequest` |
| 추가 | `src/server/requests/service.ts` | 조회·생성·응답·수락 반영 |
| 추가 | `src/app/api/admin/requests/route.ts` | `GET`(내 요청 목록) · `POST`(발송) |
| 추가 | `src/app/api/admin/requests/[requestId]/route.ts` | `PATCH`(수락·거절·취소) |
| 추가 | `src/lib/api/requests.ts` | 프론트 호출 함수 |
| 추가 | `docs/84-feat-할일-요청-도움-요청-도메인-추가.md` | 본 문서 |

## 4. 권한·정합성 처리

요청은 사람 간 데이터라 **누가 무엇을 바꿀 수 있는지**가 핵심이다.

- **보낸 사람은 세션 사용자로 고정** — 클라이언트가 보낸 `fromUserId`는 받지 않는다. 남의 이름으로 요청을 보내는 우회를 막는다. (단계 댓글 API가 작성자를 고정하는 것과 같은 방식)
- **자기 자신에게 요청 금지** — `toUserIds`에 본인이 있으면 400. UI에서도 목록에서 빼지만 서버가 최종 판정한다.
- **수락·거절은 받은 사람만, 취소는 보낸 사람만** — 상태별로 검사 주체가 다르다.
- **중복 응답 방지** — 권한 조건과 `status: "PENDING"`을 **UPDATE의 where에 함께** 넣었다. 조회 후 수정하는 방식이면 두 요청이 동시에 들어올 때 둘 다 통과할 수 있는데, 조건부 UPDATE 한 방이면 먼저 도착한 쪽만 `count > 0`이 된다.
- 바뀐 행이 0이면 "내 요청이 아님"과 "이미 처리됨"을 구분하지 않고 **403**으로 응답한다 — 남의 요청 존재 여부를 알려주지 않기 위해서다.

**수락 시 실제 반영**: `ASSIGN` 요청이 수락되면 대상 단계의 `requestedCollaborators`에 수신자를 추가한다(이미 있으면 건너뜀). 즉 공동 작업자 지정이 이제 **상대 동의 후에** 반영된다. `HELP`는 상태만 바뀌고 부수 효과가 없다.

## 5. 검증

1. `npm run lint` ✓ · `npm run build` ✓
2. 마이그레이션 `prisma migrate dev` 정상 적용 — "Your database is now in sync with your schema"
3. 빌드 라우트 목록에 `/api/admin/requests`·`/api/admin/requests/[requestId]` 등록 확인

> 실제 발송·수락 왕복 검증은 화면이 붙는 태스크 3~4에서 함께 수행한다. 이 태스크만으로는 호출부가 없어 의미 있는 E2E가 되지 않는다.

## 6. 알려진 사항 / 후속 과제

- **알림 읽음 처리는 없다.** 상태(`PENDING`/`ACCEPTED`/…)만 있고 "확인함" 개념은 두지 않았다. 요청 알림 카드가 상태로 충분히 구분되기 때문인데, 알림함이 커지면 필요해질 수 있다.
- **`HELP` 수락의 부수 효과가 없다.** 도움 요청은 수락해도 담당이 바뀌지 않는다 — 실제 도움은 오프라인/댓글로 이뤄진다고 보고 상태만 남겼다.
- `Stage.requestedCollaborators`는 여전히 **문자열 배열**이다. 이번에 담기는 값이 실제 `User.id`가 됐지만 FK는 아니라 사용자가 삭제돼도 남는다. 공동 작업자를 제대로 다루려면 별도 조인 테이블이 필요하다.
