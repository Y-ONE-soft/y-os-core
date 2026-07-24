# feat: 할일에 예정 시각 필드 추가

## 작업 요약

할일(Task)에 **예정 시각** `scheduledTime`(HH:mm)을 추가했다. 다음 태스크의 일 뷰 시간대 그리드가 이 값으로 할일을 시간에 배치한다. 이번 커밋은 **데이터·API 계층만** 다룬다 — 화면은 아직 이 필드를 그리지 않는다.

## 표기 규격 — 날짜와 같은 문자열, TZ 회피

`scheduledDate`가 `DateTime`이 아니라 `YYYY-MM-DD` 문자열인 이유(화면이 날짜만 쓰고 TZ 이슈를 피한다)를 시각에도 그대로 적용했다. `scheduledTime`은 `HH:mm` **문자열**이다. `DateTime`으로 날짜+시각을 합치면 TZ 변환이 끼어 화면 값이 흔들리므로, 날짜와 시각을 각각 로컬 문자열로 둔다.

```prisma
scheduledDate String? // YYYY-MM-DD ... null = 일정 미정
scheduledTime String? // HH:mm — 예정 시각 ... null = 시각 미정(하루 종일)
```

## 불변식 — 시각은 예정일 없이 존재하지 않는다

시각만 있고 날짜가 없는 상태는 의미가 없다("14시"가 어느 날인지 알 수 없다). 서버가 이 불변식을 강제한다: 예정일이 `null`로 지워지면(백로그·미배정으로 이동) 시각도 함께 지운다.

```ts
// updateTask
if (patch.scheduledDate === null) patch = { ...patch, scheduledTime: null };
```

클라이언트가 시각을 남긴 채 날짜만 지워도, 서버에서 시각이 정리된다. 실 API로 이 경로를 확인했다(아래 검증).

## 마이그레이션 — nullable add-column (하위 호환)

```sql
ALTER TABLE "Task" ADD COLUMN "scheduledTime" TEXT;
```

`nullable` 컬럼 추가라 **기존 코드·데이터와 완전히 호환**된다. 기존 프로덕션 코드는 이 컬럼을 몰라도 무시하고, 기존 할일은 `null`(시각 미정)이 된다. 개발 DB(공유)에 `prisma migrate dev`로 선반영했으나, add-column이라 다른 세션의 실행 중 앱이나 프로덕션에 지장을 주지 않는다.

## 변경 파일

| 파일 | 변경 |
| --- | --- |
| `prisma/schema.prisma` | `scheduledTime String?` |
| `prisma/migrations/…_add_task_scheduled_time/` | add-column |
| `server/workspace/service.ts` | `toTask` 읽기 / `createTask` 입력 / `TaskPatch`에 `scheduledTime` / `updateTask`의 불변식 |
| `types/workspace.ts` | `BoardTask.scheduledTime?: string` |
| `app/api/admin/guard.ts` | `isTimeOfDay` (HH:mm 24시간 정규식) |
| `app/api/admin/tasks/route.ts` (POST) | 생성 시 `scheduledTime` 수용 + `isTimeOfDay` 검증 |
| `app/api/admin/tasks/[taskId]/route.ts` (PATCH) | 화이트리스트에 `scheduledTime` 추가 |
| `components/features/projects/board-store.tsx` | `updateTask` 패치에 `scheduledTime?: string \| null`, null→undefined 로컬 변환 |

### board-store의 null 처리

`updateTask`의 로컬 낙관적 상태는 `BoardTask` 규격(부재 = `undefined`)이지만, 서버로는 해제를 뜻하는 `null`을 그대로 보내야 한다(`undefined`는 JSON에서 사라져 라우트의 `key in body`를 통과하지 못한다 — 기존 `assigneeId`와 같은 함정). `scheduledTime`도 같은 규칙으로, 로컬만 `null → undefined`로 바꾸고 서버 페이로드는 `null`을 유지한다.

## 검증 — 실 API + DB 왕복

dev 서버(포트 3042, `Ready` 확인 후) + 실 DB로 전 경로를 태웠다. 검증용 할일은 확인 직후 삭제해 **공유 DB를 원복**했다.

| 단계 | 결과 |
| --- | --- |
| 생성 (date `2026-07-24` + time `14:30`) | `{date:"2026-07-24", time:"14:30"}` |
| 시각만 PATCH `09:00` | `{date:"2026-07-24", time:"09:00"}` |
| 예정일 `null` PATCH | `{date:null, time:null}` — **시각도 함께 해제(불변식)** |
| 삭제 | 정리 완료 |

| 정적 검증 | 결과 |
| --- | --- |
| `npx prisma generate` | 통과 |
| `npm run lint` / `npx tsc --noEmit` / `npm run build` | 통과 |

## 알려진 이슈

- **PATCH는 시각 형식을 검증하지 않는다.** POST는 `isTimeOfDay`로 검증하지만, PATCH는 화이트리스트 키를 그대로 신뢰한다 — 이는 `scheduledDate`의 기존 동작과 동일한 관례다(POST 검증, PATCH 신뢰). 다음 태스크의 UI는 시간대 그리드·시각 입력에서 항상 유효한 `HH:mm`만 보내므로 실사용 경로에서는 문제되지 않는다. 서버 측 PATCH 검증을 조이려면 `scheduledDate`와 함께 별도 사이클로 다루는 편이 일관적이다.
- **화면은 아직 이 값을 쓰지 않는다.** 다음 태스크(일 뷰 시간대 그리드)에서 소비한다.

## 병렬 작업 메모

- 베이스 `cd0abe0`. 착수 시점에 `prisma/schema.prisma`를 만지는 다른 브랜치가 없음을 확인했다("스키마 변경은 동시에 한 브랜치만"). 이 브랜치가 스키마를 잡고 있는 동안 다른 세션은 스키마 작업을 시작하면 안 된다 — 머지를 지체 없이 진행한다.
- 서버·타입·API·스토어에 걸쳐 있으나 전부 **기존 흐름에 필드 하나를 더한 것**이며, 다른 세션이 이 파일들을 동시에 수정 중이지 않음을 확인했다.
- 문서 번호: 작성 시점 main 최대가 169라 앞 커밋(170)에 이어 171을 썼다. 머지 직전 재확인이 필요하다.
