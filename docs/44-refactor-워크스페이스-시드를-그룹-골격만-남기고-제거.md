# refactor: 워크스페이스 시드를 그룹 골격만 남기고 제거

요청 사이클 `시드-데이터-정리`의 단일 태스크. "시드 데이터는 유저 데이터 말고 삭제하면 됨, 실제 테스트하면서 진행할 거라서" 요청에 따라, DB에 자동으로 만들어지던 **자리표시 프로젝트·단계·작업을 제거**한다. 앞으로는 화면에서 직접 만든 실제 데이터로 검증한다.

## 결정 사항 (사용자 승인)

착수 전 세 가지를 확인받았다.

| 항목 | 선택 | 이유 |
|---|---|---|
| 공유 DB의 기존 데이터 | **코드만 변경, 삭제는 보류** | 진행 중인 세션 3개가 보고 있는 프로젝트·보드가 사라진다. 필요할 때 초기화 버튼으로 직접 비울 수 있다 |
| 초기화(`resetWorkspace`) 동작 | **빈 상태로 비우기** | 실사용 테스트 중 엉켰을 때 초기화 수단으로 계속 쓸 수 있다 |
| 자리표시 범위 | **prisma 시드만** | `my-work-data.ts`(캘린더·요청), `project-detail-data.ts`, `TEAM_MEMBERS` 등 UI 자리표시는 유지. 지우면 해당 화면이 빈 채로 남는다 |

### 그룹은 남긴다 — 지우면 스탭이 아무것도 못 만든다

"유저 데이터 말고 삭제"를 문자 그대로 적용하면 `ProjectGroup`도 지워야 하지만, **그러면 스탭이 프로젝트를 만들 수 없게 된다.** 착수 전 사용자에게 보고하고 그룹 유지로 합의했다.

연쇄는 이렇다.

1. 그룹이 0개 → `User.groupId`가 참조할 대상이 없어 `null`
2. 사이드바의 "프로젝트 추가" 버튼 노출 조건이 `!isMaster && user?.groupId`이므로 **버튼이 사라진다**
3. API도 `"소속 그룹이 없어 프로젝트를 만들 수 없습니다"`로 400
4. **사용자 소속 그룹을 지정하는 UI·API가 존재하지 않는다** (`/api/admin/users` 없음) → DB를 직접 고치지 않는 한 복구 불가

그룹(Lab·Soft·Printing)은 테스트용 가짜 데이터라기보다 조직 구조에 가깝고, 이를 남겨야 로그인 직후 바로 실제 프로젝트를 만들어볼 수 있다. 그룹까지 비우려면 **사용자 소속 지정 수단**(마스터용 UI 또는 그룹 최초 생성 시 자동 배정)이 선행돼야 한다.

## 변경 내용

### 1. `src/server/workspace/seed-data.ts` — 185줄 → 28줄

프로젝트·단계·작업 시드를 전부 제거하고 그룹 3건만 남겼다. `SeedTask`/`SeedStage`/`SeedBoard` 타입과 `BOARDS` 상수(약 80줄)가 통째로 사라졌다.

```ts
const GROUPS = [
  { id: "g-lab", name: "Lab" },
  { id: "g-soft", name: "Soft" },
  { id: "g-printing", name: "Printing" },
];

export function workspaceSeedRows() {
  const base = Date.parse("2026-07-22T00:00:00.000Z");
  const at = (index: number) => new Date(base + index * 1000);
  const groups = GROUPS.map((group, i) => ({ id: group.id, name: group.name, createdAt: at(i) }));
  return { groups };
}
```

반환 타입을 `{ groups, projects, stages, tasks }`에서 **`{ groups }`로 좁혔다.** 빈 배열을 남겨두면 소비자 쪽에 `createMany({ data: [] })` 같은 죽은 코드가 그대로 남는다. 키를 없애면 컴파일러가 모든 소비자를 찾아준다.

`GROUPS`에서 중첩 `projects` 배열도 제거해 구조를 평탄화했다.

### 2. `prisma/seed.ts`

- `STAFF_OWNED_PROJECT_IDS` 상수와 **작업자 백필 블록 제거** — 백필 대상이던 `p-cms`·`p-yos`·`p-contents`를 더 이상 만들지 않으므로 의미가 없다
- 프로젝트·단계·작업 `createMany` 제거
- `staffUserId` 추적 변수 제거 (백필에만 쓰였다)
- **그룹 시드를 `skipDuplicates`로 전환**

```ts
// 그룹을 먼저 만든다 — User.groupId가 ProjectGroup을 참조하는 FK이므로
// 사용자보다 그룹이 존재해야 한다. 이미 있는 그룹은 건드리지 않는다.
const created = await db.projectGroup.createMany({
  data: seed.groups,
  skipDuplicates: true,
});
```

기존에는 `projectGroup.count() === 0`일 때만 시드하고 아니면 통째로 건너뛰는 구조였다(`seedWorkspace` 플래그). 그룹만 남은 지금은 `skipDuplicates`가 더 정확하다 — **일부 그룹만 지워진 상태에서도 빠진 것만 채운다.** 기존 방식은 그룹이 하나라도 있으면 아무것도 하지 않았다.

### 3. `src/server/workspace/service.ts` — `resetWorkspace()`

```ts
export async function resetWorkspace(): Promise<void> {
  const seed = workspaceSeedRows();
  await db.$transaction([
    db.projectGroup.deleteMany(), // 프로젝트·단계·작업까지 cascade 삭제
    db.task.deleteMany(), // 그룹 밖에 남을 수 있는 잔여 행 방어
    db.projectGroup.createMany({ data: seed.groups }),
  ]);
}
```

`project`/`stage`/`task`의 `createMany` 3줄을 제거했다. 시드를 공유하는 구조 덕분에 **초기화 동작이 자동으로 "그룹만 남기고 비우기"가 된다** — 별도 로직 분기가 필요 없었다. 주석도 "시드 상태로 되돌린다" → "그룹 골격만 남긴다"로 수정.

## 검증

`npm run build` 성공(타입 검사 포함), `npm run lint` 경고 0, `seed.projects`/`seed.stages`/`seed.tasks`/`STAFF_OWNED` 잔여 참조 0건.

**공유 DB의 기존 데이터를 지우지 않는다**는 지시를 지키며 검증했다.

### 1. 시드 멱등성 — 기존 데이터 보존

```
시드 실행 전: 그룹 3 · 프로젝트 4 · 단계 8 · 작업 12 · 사용자 2
$ npx prisma db seed
  그룹 시드: 신규 0 / 전체 3
  seeded: master01 (MASTER) 소속=g-soft
  seeded: step01 (STAFF) 소속=g-soft
시드 실행 후: 그룹 3 · 프로젝트 4 · 단계 8 · 작업 12 · 사용자 2
```

기존 프로젝트·단계·작업이 **하나도 삭제되지 않았다.** 시드는 순수 추가형이다.

### 2. 빈 DB에서의 시드 결과

```
반환 키: groups
그룹: g-lab(Lab), g-soft(Soft), g-printing(Printing)
```

프로젝트·단계·작업 키 자체가 없다 — 새 DB에 시드하면 그룹 3건만 생긴다.

### 3. 초기화 동작 — 롤백 트랜잭션으로 검증

`resetWorkspace()`를 실제로 실행하면 공유 DB의 데이터가 전부 날아간다. 그래서 **동일한 문장을 인터랙티브 트랜잭션 안에서 실행하고 마지막에 예외를 던져 롤백**하는 방식으로 검증했다.

```
실행 전: 그룹 3 · 프로젝트 4 · 단계 8 · 작업 12
실행 후: 그룹 3 · 프로젝트 0 · 단계 0 · 작업 0
→ 그룹만 남고 나머지 cascade 삭제: 정상
(롤백 완료 — 공유 DB 원상복구)
롤백 후 실제 DB: 그룹 3 · 프로젝트 4 · 단계 8 · 작업 12
```

그룹 삭제가 프로젝트·단계·작업까지 cascade로 지우고 그룹 3건이 재생성되는 것을 확인했으며, 롤백 후 원본이 그대로임도 확인했다.

### 4. 그룹을 남긴 목적 달성 — 스탭 생성 가능

dev 서버(포트 3021)로 확인. 포트 3001·3002·3005·3011·3013은 다른 세션이 점유 중이었다.

```
login=[200] {"ok":true} create=[200]
세션 소속: g-soft
```

시드 정리 후에도 step01의 소속이 유지되고 프로젝트 생성이 정상 동작한다. 검증용 프로젝트는 삭제했다.

## 변경 파일 내역

| 파일 | 구분 | 내용 |
|---|---|---|
| `src/server/workspace/seed-data.ts` | 수정 | 프로젝트·단계·작업 시드 및 관련 타입 제거 (185→28줄), 반환 타입을 `{ groups }`로 축소 |
| `prisma/seed.ts` | 수정 | 작업자 백필·프로젝트 이하 시드 제거, 그룹 시드를 `skipDuplicates`로 전환 |
| `src/server/workspace/service.ts` | 수정 | `resetWorkspace()`가 그룹만 재생성하도록 |

## 알려진 이슈 / 주의점

### 기존 개발 DB에는 자리표시 데이터가 그대로 남아 있다

지시대로 삭제하지 않았다. 비우려면 사이드바의 **"데이터 초기화"** 를 쓰면 된다(이제 그룹만 남기고 전부 지운다). 단, **공유 DB이므로 다른 세션의 작업 데이터도 함께 사라진다** — 병렬 세션이 없을 때 실행할 것.

### 그룹까지 비우려면 선행 작업이 필요하다

위 "그룹은 남긴다" 절 참고. 사용자 소속 그룹 지정 수단이 없는 한 그룹 삭제는 스탭을 잠근다. 멤버·배정 도메인 작업 시 함께 다뤄야 한다.

### `resetWorkspace`가 이제 되돌릴 수 없는 삭제에 가깝다

기존에는 초기화해도 시드 프로젝트·보드가 복원돼 "되돌리기"에 가까웠지만, 이제는 **순수 삭제**다. 실사용 데이터가 쌓인 뒤 잘못 누르면 복구 수단이 없다. 확인 다이얼로그 유무는 이번 범위 밖이라 손대지 않았으나, 실사용 단계에서는 점검할 가치가 있다.

### 시드 계정 소속은 여전히 `g-soft` 하드코딩

`SEED_GROUP_ID = "g-soft"`가 남아 있다. 그룹 목록이 바뀌면 함께 조정해야 한다.
