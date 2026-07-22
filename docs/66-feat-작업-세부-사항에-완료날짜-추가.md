# feat: 작업 세부 사항에 작업날짜·완료날짜 추가

요청 사이클 `작업-완료날짜`의 단일 태스크. "할일 세부사항에 작업날짜·완료날짜 추가, 완료날짜는 체크박스 선택하면 완료됨" 요청을 처리한다.

## 배경 — 두 번 차단됐다가 선점으로 진행

이 요청은 착수까지 두 번 막혔다.

1. **`작업-미배정-예정일` 세션**이 `Task`에 `scheduledDate`를 추가 중이었다 → 사용자 확인 결과 **"작업날짜"는 이 `scheduledDate`와 같은 개념**으로 확정. 저쪽 PR(#45)이 머지되며 해소
2. **`detail-overlay-align` 세션**이 같은 `Task` 모델에 `updatedAt`·`comments`를 추가 중이었다 → 대기하다가, 해당 브랜치가 `schema.prisma` 한 줄만 잡은 채 정체(base가 `dcdab27`로 main보다 한참 뒤, 마이그레이션 파일도 없음)되어 **사용자 지시로 선점 진행**

작업날짜를 기존 `scheduledDate` 재사용으로 정하면서 신규 스키마는 `completedDate` 하나로 줄었다.

## ⚠️ 작업 중 발견한 공유 DB 스키마 드리프트

마이그레이션을 생성하자 Prisma가 만든 SQL에 **제 변경이 아닌 문장**이 섞여 나왔다.

```sql
ALTER TABLE "Task" ADD COLUMN "completedDate" TEXT;   -- 이번 변경
ALTER TABLE "User" DROP COLUMN "group";               -- 이번 변경 아님
```

`User.group`은 docs/36의 마이그레이션(`20260722145429`)이 이미 제거한 컬럼이다. 그런데 라이브 DB에 되살아나 있었다. **마이그레이션 파일 6개 전부를 확인했지만 `group`을 다시 추가하는 문장은 없다.** 마이그레이션 기록 없이 컬럼이 복원됐다는 뜻으로, CLAUDE.md가 금지한 `prisma db push`가 실행됐을 가능성이 크다.

### 왜 그대로 두면 안 되는가

`migrate deploy`를 돌리며 드리프트 자체는 정리됐지만, **마이그레이션 파일에 `DROP COLUMN "group"`이 남으면 새 DB에서 배포가 깨진다.** 신규 환경에서 순서대로 재생하면 `145429`가 이미 그 컬럼을 지운 뒤라 "컬럼이 없다"며 실패한다. 운영 DB를 분리하는 순간 터질 지뢰다.

### 조치

1. 마이그레이션 파일을 **이번 변경만 남기도록 수정**
2. Prisma는 적용 시점 체크섬을 기록하므로 파일 수정 시 불일치가 발생 → `_prisma_migrations`의 해당 행을 삭제하고 `prisma migrate resolve --applied`로 재등록
3. `migrate diff`로 **드리프트 완전 해소 확인**(`-- This is an empty migration.`)

DB 스키마·데이터는 건드리지 않았고 메타 기록만 맞췄다. `User.group`은 이미 폐기된 자유 문자열(`"Y-ONE"`)이라 데이터 손실도 없다. 사용자 소속은 `groupId`(= `g-soft`)로 정상 유지된다.

## 변경 내용

### 1. `prisma/schema.prisma` — `Task.completedDate`

```prisma
// 완료 체크 시 서버가 기록하는 날짜. 체크를 풀면 null로 되돌린다.
// scheduledDate와 같은 YYYY-MM-DD 문자열 규격 (DateTime이 아님 — 화면이 날짜만 쓴다)
completedDate String?
```

**`DateTime`이 아니라 `String`을 택했다.** "언제 완료했는지"는 시각까지 남기는 게 자연스러워 보이지만, 이 저장소는 `Stage.startDate`·`Task.scheduledDate` 모두 **TZ 이슈 회피를 위해 `String` YYYY-MM-DD 규격**을 쓴다. 화면에도 날짜만 표시하므로 기존 규격을 따랐다. 시각이 필요해지면 그때 올리는 편이 낫다.

마이그레이션: `20260722175530_add_task_completed_date`.

### 2. `src/server/workspace/service.ts` — 완료날짜 자동 기록

```ts
/** 오늘 날짜(YYYY-MM-DD) — 서버 로컬 기준. scheduledDate와 같은 표기 규격 */
function todayISO() { … }

/**
 * 완료 상태 전환에 따른 완료날짜 자동 기록.
 * 체크하면 오늘, 해제하면 null. 날짜는 **서버가 만든다** — 클라이언트 시계를
 * 신뢰하면 기기 설정만 바꿔도 임의 날짜로 완료 기록을 남길 수 있다.
 * done이 패치에 없으면 완료날짜도 건드리지 않는다.
 */
function withCompletedDate(patch: TaskPatch): TaskPatch {
  if (patch.done === undefined) return patch;
  return { ...patch, completedDate: patch.done ? todayISO() : null };
}

export async function updateTask(id: string, patch: TaskPatch) {
  patch = withCompletedDate(patch);
  …
}
```

핵심은 **날짜를 서버가 만든다**는 점이다. 클라이언트가 보낸 값을 쓰면 기기 시계만 바꿔도 완료 기록을 위조할 수 있다.

`done`이 패치에 없으면 완료날짜를 건드리지 않는다. 이름·내용만 수정할 때 완료 기록이 날아가면 안 된다.

`toTask` 매퍼와 `TaskPatch` 타입에도 `completedDate`를 추가했다.

### 3. `src/app/api/admin/tasks/[taskId]/route.ts` — 허용 목록 유지

`PATCHABLE`에 `completedDate`를 **넣지 않았다.** 이 허용 목록이 이미 클라이언트의 직접 지정을 걸러낸다. 나중에 무심코 추가하지 않도록 주석을 남겼다.

```ts
// completedDate는 일부러 뺐다 — done 전환에 맞춰 서버(updateTask)가 채우는 값이라
// 클라이언트가 직접 보내면 임의 날짜로 완료 기록을 위조할 수 있다.
```

방어가 두 겹이다 — 라우트 허용 목록에서 걸러지고, 설령 통과해도 `withCompletedDate`가 `done` 기준으로 덮어쓴다.

### 4. `src/types/workspace.ts` — DTO

`BoardTask.completedDate?: string` 추가. `scheduledDate` 주석에 화면 표기명("작업날짜")을 병기해 용어 혼동을 줄였다.

### 5. `src/components/features/projects/board-store.tsx` — 낙관적 업데이트

```ts
// 완료날짜는 서버(updateTask)가 done 전환에 맞춰 채운다. 낙관적 값도 같은
// 규칙으로 맞춰야 새로고침 시 날짜가 늦게 나타나거나 남아 있지 않는다.
const completedDate = done ? todayISO() : undefined;
const toggle = (task: BoardTask) =>
  task.id === taskId ? { ...task, done, completedDate } : task;
```

`roadmap-utils`의 기존 `todayISO()`를 재사용했다(브라우저 로컬 기준). 서버와 클라이언트가 각자 오늘을 계산하므로 자정 근처나 TZ가 다른 환경에서 하루 차이가 날 수 있다 — 아래 "알려진 이슈" 참고.

### 6. `src/components/features/projects/task-detail-overlay.tsx` — 세부 사항 UI

우측 "세부 사항" 패널의 `단계`와 `작업 유형` 사이에 두 필드를 넣었다. 예정일이 단계 배정과 함께 정해지므로 그 옆이 자연스럽다.

**작업날짜** — `Input type="date"`. 기존 `stage-add-overlay.tsx`·`stage-detail-overlay.tsx`가 쓰는 것과 같은 패턴이라 별도 컴포넌트를 만들지 않았다. 변경 시 `boardActions.updateTask`로 `scheduledDate`를 patch한다. 빈 값이면 `undefined`(일정 미정).

**완료날짜** — **읽기 전용 표시**. 값이 없으면 "완료 체크 시 자동 기록" 안내를 뮤트 색으로 보여준다.

```tsx
{/* 읽기 전용 — 위 체크박스를 켜면 서버가 오늘 날짜를 기록하고,
    풀면 지운다. 직접 고칠 수 있으면 완료 기록의 의미가 없다 */}
```

입력 필드로 만들지 않은 것이 의도다. 편집 가능하면 서버가 위조를 막는 의미가 없다.

## 검증

`npm run build` 성공(타입 검사 포함), `npm run lint` 경고 0, `migrate diff` 결과 **드리프트 0**.

dev 서버(포트 3051)로 실제 HTTP 검증했다. 3001·3002·3011·3012는 다른 세션 점유 중이었다. **전용 픽스처를 만들어 검증하고 삭제했다.**

### 완료 토글 → 완료날짜 자동 기록 (핵심)

```
① 생성 직후        done=false  완료날짜=(없음)  작업날짜=(없음)
② 완료 체크        done=true   완료날짜=2026-07-22  작업날짜=(없음)
③ 체크 해제        done=false  완료날짜=(없음)  작업날짜=(없음)
```

### 위조 방어

```
④ 완료날짜만 직접 전송 {"completedDate":"2020-01-01"}
   → 400 잘못된 요청 (허용 목록에서 걸러져 빈 패치가 됨), 데이터 변화 없음

⑤ done과 함께 위조 {"done":true,"completedDate":"2020-01-01"}
   → done=true  완료날짜=2026-07-22   ← 서버 값이 이김
```

### 필드 독립성

```
⑥ 작업날짜 편집 {"scheduledDate":"2026-08-15"}
   → done=true  완료날짜=2026-07-22  작업날짜=2026-08-15   (완료날짜 보존)

⑦ done 없이 이름만 수정 {"name":"이름만 변경"}
   → done=true  완료날짜=2026-07-22  작업날짜=2026-08-15   (완료날짜 보존)
```

### 검증하지 못한 것

**오버레이를 실제로 열어 두 필드가 보이는지, 체크박스를 눌러 완료날짜가 화면에 뜨는지는 확인하지 못했다.** 브라우저 자동화 도구(playwright·puppeteer)가 없고, 작업 상세 오버레이는 Radix Dialog Portal로 열릴 때 마운트되어 SSR HTML에 나타나지 않는다.

검증 범위는 "API 계층이 요구대로 동작하고 위조가 막힌다"까지다. **화면에서 한 번 열어 확인이 필요하다.**

## 변경 파일 내역

| 파일 | 구분 | 내용 |
|---|---|---|
| `prisma/schema.prisma` | 수정 | `Task.completedDate String?` 추가 |
| `prisma/migrations/20260722175530_add_task_completed_date/migration.sql` | 신규 | 컬럼 추가 (드리프트 문장 제거 후 재등록) |
| `src/server/workspace/service.ts` | 수정 | `todayISO`·`withCompletedDate` 추가, `updateTask` 연결, `toTask`·`TaskPatch` 확장 |
| `src/app/api/admin/tasks/[taskId]/route.ts` | 수정 | `PATCHABLE` 제외 의도를 주석으로 명시 |
| `src/types/workspace.ts` | 수정 | `BoardTask.completedDate` 추가 |
| `src/components/features/projects/board-store.tsx` | 수정 | `toggleTask` 낙관적 업데이트에 완료날짜 반영 |
| `src/components/features/projects/task-detail-overlay.tsx` | 수정 | 세부 사항에 작업날짜(편집)·완료날짜(읽기 전용) 추가 |

## 알려진 이슈 / 주의점

### 서버와 클라이언트가 각자 "오늘"을 계산한다

낙관적 업데이트는 브라우저 로컬 기준, 실제 저장은 서버 로컬 기준이다. **자정 근처이거나 서버·클라이언트 TZ가 다르면 화면에 잠깐 하루 다른 날짜가 보였다가 새로고침 시 서버 값으로 바뀔 수 있다.** 서버가 응답으로 확정 날짜를 돌려주고 그것으로 갱신하면 해소되지만, 현재 patch 응답이 `{ok:true}`뿐이라 구조 변경이 필요해 이번 범위에서 제외했다.

### 배포 환경의 서버 TZ

`todayISO()`가 서버 로컬 시각을 쓰므로 Vercel 런타임 TZ(보통 UTC)가 KST와 9시간 차이 난다. **한국 시간 오전 9시 이전 완료는 전날로 기록된다.** 운영 전에 TZ 고정(예: `Asia/Seoul` 환경변수) 또는 명시적 오프셋 처리가 필요하다. 기존 `scheduledDate`도 클라이언트가 만들어 보내는 값이라 같은 축의 문제를 안고 있어, 날짜 기준을 한 번에 정리하는 편이 낫다.

### 작업날짜 편집은 즉시 저장된다

`onChange`에서 바로 patch하므로 날짜 입력 중간 상태가 저장될 수 있다(브라우저 date input은 보통 완성된 값만 change를 쏘지만 구현 편차가 있다). 내용(Textarea)이 `onBlur` 저장인 것과 다르다. 실사용에서 문제가 되면 `onBlur`로 바꾸면 된다.

### 완료 기록의 이력은 남지 않는다

체크를 풀면 완료날짜가 `null`이 된다. "언제 완료했다가 언제 취소했는지"는 추적되지 않는다. 이력이 필요하면 별도 이벤트 테이블이 있어야 한다.

### 공유 DB에 `db push` 정황

위 "스키마 드리프트" 절 참고. 현재 DB는 정상이지만, 같은 일이 반복되면 마이그레이션 히스토리와 실제 스키마가 계속 어긋난다. 병렬 세션들에 **`prisma db push` 금지**(CLAUDE.md 규약)를 다시 환기할 필요가 있다.

---

## 사후 보완 — 작업날짜는 이미 있었다 (리베이스 중 발견)

PR 준비 중 최신 main(`2cac16b`)으로 리베이스하면서, **PR #57(`티켓-헤더-예정일`)이 같은 세부 사항 패널에 "예정일" 필드를 이미 추가**한 것을 발견했다. 텍스트 충돌은 없었지만 결과적으로 **같은 `task.scheduledDate`를 쓰는 입력이 두 개** 생겼다.

더 나쁜 건 동작 차이였다. PR #57의 필드는 `setSchedule`을 거쳐 **예정일이 단계 범위 밖이면 단계 기간을 늘려준다**(캘린더 드래그와 같은 규칙). 반면 이 브랜치가 넣은 "작업날짜"는 `updateTask`를 직접 호출해 **그 로직을 우회**했다.

### 조치

이 브랜치가 추가한 "작업날짜" 입력을 **제거**하고 PR #57의 "예정일" 필드를 남겼다. 기능이 더 온전하고, 사용자가 확정한 "작업날짜 = `scheduledDate` 재사용" 방침과도 어긋나지 않는다 — 같은 값을 가리키는 필드가 이미 화면에 있다.

결과적으로 이 커밋이 세부 사항에 추가하는 것은 **완료날짜 하나**다. 문서 제목도 그에 맞춰 조정했다.

### 남은 판단 — 라벨

화면에 표시되는 이름은 **"예정일"**이고, 사용자가 요청에 쓴 표현은 **"작업날짜"**다. 같은 값이므로 라벨만 바꾸면 요청 문구와 정확히 일치하지만, PR #57이 방금 정한 표기를 이 브랜치가 임의로 바꾸는 셈이라 **손대지 않고 사용자 판단에 맡겼다.** 관련 안내 문구("단계에 편성하면 예정일이 잡힙니다")도 함께 바꿔야 한다.

### 재검증

리베이스 후 완료날짜 동작을 다시 확인했다.

```
체크:  done=true   완료날짜=2026-07-22
해제:  done=false  완료날짜=(없음)
위조:  done=true   완료날짜=2026-07-22   ← 2020-01-01 무시
```

`scheduledDate` 입력이 화면에 하나만 남은 것도 확인했다. 빌드·린트 통과.

## 문서 번호

머지 직전 main의 최대 번호가 65였고 `docs/64`가 선점되어 **66**으로 확정했다.
