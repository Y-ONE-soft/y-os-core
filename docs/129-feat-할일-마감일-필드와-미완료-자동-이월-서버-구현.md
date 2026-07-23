# feat: 할일 마감일 필드와 미완료 자동 이월(롤오버) 서버 구현

## 작업 요약

"할일이 하루가 지나면 자동으로 다음으로 넘어가도록" — 미완료 할일의 예정일이 매일 오늘로 밀리되, 처음 잡은 목표일은 **마감일**로 보존해 "며칠 미뤄졌는가"를 알 수 있게 하는 기능의 **서버 기반**을 만들었다.

이 태스크는 스키마·서버까지다. 상세 화면 표시(태스크 2), 캘린더 강조(태스크 3)는 후속이다.

## 데이터 모델

할일이 세 날짜를 갖는다.

| 필드 | 의미 | 변화 |
| --- | --- | --- |
| `deadline` (신규) | 마감일 — 처음 잡은 목표일 | 예정일을 명시적으로 지정/변경할 때만 갱신 |
| `scheduledDate` (기존) | 작업일 — 실제로 할 날 | 미완료면 조회 때마다 오늘로 이월 |
| `completedDate` (기존) | 완료한 날 | 완료 체크 시 오늘로 고정 |

`deadline`과 `scheduledDate`의 차이가 곧 **미뤄진 일수**다. 예: 마감 `07-16`, 오늘 `07-23` → 7일 미뤄짐.

## 설계 판단

### 1. 자동 이월은 크론이 아니라 조회 시점 보정

이 프로젝트엔 크론 인프라가 없다. 그래서 **워크스페이스를 조회할 때** 서버가 한 번 보정한다.

```ts
async function rollOverOverdueTasks(): Promise<void> {
  const today = todayISO();
  await db.task.updateMany({
    where: { done: false, scheduledDate: { not: null, lt: today } },
    data: { scheduledDate: today },
  });
}
```

`getWorkspace`가 스냅샷을 읽기 **전에** 이 함수를 호출한다. 앱을 열면(부트스트랩 조회) 미완료·지난 할일이 오늘로 당겨지고, 매일 열면 매일 당겨지니 결과적으로 "하루마다 미뤄짐"이 된다. `updateMany` 한 방이라 조회당 부담도 작다.

`YYYY-MM-DD` 문자열은 **사전순 = 날짜순**이라 `lt: today` 문자열 비교로 지난 것을 고른다(기존 `scheduledDate` 규격이 이미 이 문자열이라 그대로 활용).

### 2. 명시적 변경과 자동 이월은 다른 코드 경로 — 그래서 마감일이 안 흔들린다

마감일이 보존되려면 "자동 이월"이 `deadline`을 건드리면 안 되고, "사용자가 날짜를 다시 잡음(재계획)"은 `deadline`을 갱신해야 한다. 이 둘은 자연히 다른 경로다.

- **자동 이월** = `rollOverOverdueTasks`가 `scheduledDate`만 UPDATE. `deadline` 무관.
- **명시적 변경** = API `updateTask`에 `scheduledDate`가 실려 옴 → `withDeadline`이 `deadline`도 같은 값으로.

```ts
function withDeadline(patch: TaskPatch): TaskPatch {
  if (patch.scheduledDate === undefined) { /* 예정일 변경 없음 → 마감일 그대로 */ }
  return { ...patch, deadline: patch.scheduledDate }; // 예정일 지정/변경 = 재계획
}
```

캘린더에서 할일을 드래그해 옮기는 것도 `scheduledDate`를 patch로 보내는 경로라, 재계획으로 간주돼 마감일이 함께 갱신된다(사용자 확인 사항 — "드래그로 옮기면 재계획").

### 3. 마감일은 서버가 파생 — 클라이언트 위조 차단

`completedDate`가 서버 전용인 것과 같은 이유로, `deadline`도 클라이언트가 직접 보내지 못하게 했다. `withDeadline`은 항상 `scheduledDate`에서만 파생하고, `scheduledDate` 변경이 없으면 patch에 실려 온 `deadline`을 제거한다. 라우트의 `PATCHABLE` 목록에도 `deadline`을 넣지 않았다(애초에 patch로 안 들어온다). 이중 방어다.

검증에서 클라이언트가 `deadline: "2020-01-01"`을 보내도 무시되는 것을 확인했다.

### 4. 완료하면 고정

`rollOverOverdueTasks`의 `where`에 `done: false`가 있어, **완료된 할일은 이월되지 않는다.** 완료 시점의 `scheduledDate`가 그대로 남고 `completedDate`가 오늘로 박힌다. 완료를 해제하면 다시 이월 대상이 된다(검증함).

## 변경 파일 내역

### `prisma/schema.prisma` + 마이그레이션

`Task.deadline String?` 추가. 마이그레이션에 **백필**을 넣었다.

```sql
ALTER TABLE "Task" ADD COLUMN "deadline" TEXT;
UPDATE "Task" SET "deadline" = "scheduledDate" WHERE "scheduledDate" IS NOT NULL;
```

기존에 일정이 잡혀 있던 할일도 그 예정일을 최초 마감일로 삼는다. 그러면 첫 조회에서 지난 미완료 할일의 `scheduledDate`는 오늘로 튀고 `deadline`은 원래 날짜로 남아, 곧바로 "미뤄짐"이 올바르게 표시된다.

`deadline`은 **nullable**이라, 이 컬럼을 모르는 다른 세션 코드가 `Task`를 insert해도 깨지지 않는다(이전 `Stage.order` 사고는 NOT NULL + DROP DEFAULT라 기존 insert가 막혔던 것과 대비된다). `prisma db push`가 아니라 `prisma migrate dev`로 마이그레이션 파일을 남겼다.

### `src/server/workspace/service.ts`

- `rollOverOverdueTasks` 추가, `getWorkspace` 진입부에서 호출
- `withDeadline` 추가, `updateTask`에서 `withCompletedDate` 다음에 적용
- `TaskPatch`에 `deadline` 추가 (서버 내부 파생용)
- `toTask` 매핑에 `deadline` 추가

### `src/types/workspace.ts`

`BoardTask.deadline` 추가.

## 검증

dev 서버(`localhost:3025`, 본 워크트리 전용 포트)에서 실제 API를 호출했다. 과거·미래 예정일을 실제로 지정해 이월 동작을 확인했고, **12개 시나리오 전부 통과.**

| 시나리오 | 결과 |
| --- | --- |
| 과거(7일 전) 예정일 지정 → 마감일이 그 날짜로 세팅 | ✅ `deadline=07-16` |
| 미완료·지난 할일 → 조회 시 예정일이 오늘로 이월 | ✅ `scheduledDate=07-23` |
| 이월 후 마감 대비 '미뤄짐' 성립 | ✅ `07-16 → 07-23` |
| 미래(5일 후) 예정일 → 이월되지 않음 | ✅ |
| **재계획**: 예정일 재지정 시 마감일도 함께 갱신 | ✅ 미뤄짐 리셋 |
| **완료 고정**: 완료된 지난 할일은 이월되지 않고 예정일 과거 유지 | ✅ |
| 완료 시 완료일이 오늘로 기록 | ✅ |
| **위조 차단**: 클라이언트가 보낸 `deadline`은 무시 | ✅ |
| **완료 해제** 시 다시 오늘로 이월 | ✅ |
| 완료 해제 시 마감일은 원래 값 유지 | ✅ |

검증이 만든 프로젝트·할일은 삭제하고 잔여 0건을 확인했다.

- `npm run lint` 통과 (종료코드 0, 경고 0)
- `npx tsc --noEmit` 통과
- `npm run build` 통과

## 알려진 이슈 / 후속

- 이 커밋은 서버까지다. 화면에 마감일·미뤄진 일수는 아직 안 보인다(태스크 2에서).
- **`getWorkspace`가 쓰기(UPDATE)를 하게 됐다.** 조회가 부수효과를 갖는 lazy-보정 패턴으로, 흔하지만 이례적이긴 하다. 부하가 커지면 별도 배치로 분리할 수 있다.
- 이월 판정은 **서버 로컬 자정** 기준이다(`todayISO`가 서버 시계). 사용자 타임존이 크게 다르면 "하루"의 경계가 어긋날 수 있으나, 기존 `completedDate`도 같은 기준이라 일관된다.
- docs 번호는 병렬 머지로 125·126이 선점돼 이 브랜치 네 문서를 129~132로 재조정했다.
