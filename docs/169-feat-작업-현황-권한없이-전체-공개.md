# feat: 작업 현황을 권한과 무관하게 전체 공개(마스터 뷰로 통일)

## 요청

> 작업 현황은 권한 상관없이 지금 master 가 볼 수 있는 방법으로 다 볼 수 있게 해줘.

작업 현황(`/projects`)은 그동안 역할(MASTER/STAFF)에 따라 보이는 범위가 달랐다. 이를 없애 **누구나 마스터와 동일한 전체 뷰**를 보게 한다.

## 배경 — 제한은 프론트에만 있었다

서버 `getWorkspace()`는 원래 **권한 필터 없이 전체 데이터를 모두에게** 내려준다(로그인만 요구, `src/app/api/admin/workspace/route.ts`). 사이드바 노출·라우트(`proxy.ts`)에도 역할 게이트가 없다. 제한은 순전히 프론트의 `isMaster` 분기였다:

- `task-status-page.tsx` — 프로젝트 풀(마스터=전체 / 스탭=자기 소유), 섹션(그룹별 / 단일 "assigned"), 그룹 필터 칩(마스터만).
- `task-status-assignees.tsx` — 담당자 뷰(마스터=전 직원+미배정 / 스탭=자기 컬럼만).

따라서 **프론트 두 파일의 `isMaster` 분기만 제거**하면 된다(서버 변경 없음).

## 변경 내용

### `src/components/features/projects/task-status-page.tsx`
- `const isMaster = user?.role === "MASTER"` 및 그에 따른 분기 제거.
- `projectChipPool` = 선택된 그룹들의 전체 프로젝트(항상). `sections` = 그룹별(항상).
- 그룹 필터 칩을 감싸던 `{isMaster && …}` 제거 → **항상 표시**.
- `<TaskStatusAssignees>`에서 `isMaster`·`currentUserId` prop 제거.
- 그 결과 미사용이 된 `user`를 세션 구조분해에서 제거(`{ loading }`만 사용).

### `src/components/features/projects/task-status-assignees.tsx`
- `isMaster`·`currentUserId` prop 제거.
- 스탭 전용 분기(`if (!isMaster) return [자기 컬럼]`) 제거 → **항상 전 직원 + 미배정** 컬럼.
- `useMemo` 의존성에서 제거된 값 정리.

## 결정 이유

- 서버가 이미 전체를 공개하므로, 이 변경은 **화면 표시만** 바꾼다(새 데이터 노출 경로를 여는 게 아니라, 이미 내려오던 데이터를 화면에서 가리던 분기를 없앨 뿐).
- 스탭 전용 분기를 남겨 두면 죽은 코드가 되므로 제거해 자기문서화했다.

## 검증 (실제 앱 · 스탭 세션)

로컬 dev에서 **STAFF 사용자(김주웅, Y.OS core 소유)** 세션으로 `/projects`:

- 로그인 역할 = STAFF 확인.
- **그룹 필터 칩(Lab/Soft/Printing) 노출** — 예전 마스터 전용.
- **프로젝트 칩: 전 그룹 9개 전부** 표시(예전엔 자기 소유 1개만). "선택: 9개 프로젝트 · 60개 할일".
- **담당자 뷰: 김주웅 + 노윤기 + 미배정** 컬럼(예전엔 자기 컬럼만).
- `npm run lint` 통과 · `npm run build` 성공(exit 0).

(검증 전용 — 데이터 변경 없음.)

## 알려진 이슈 / 참고

- 이 변경은 **작업 현황(`/projects`)에 한정**된다. 내 할일 필터의 마스터 전용 그룹 필터 등 다른 화면의 역할 분기는 그대로다(요청 범위 밖).
- docs 번호 169는 작성 시점 기준(최대 168). 병렬 머지 충돌 시 나중 머지 쪽이 조정.
