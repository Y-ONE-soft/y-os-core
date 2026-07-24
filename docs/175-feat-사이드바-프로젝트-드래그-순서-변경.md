# feat: 사이드바 프로젝트 드래그 순서 변경

Task ①(order 필드)을 토대로, **왼쪽 사이드바에서 프로젝트를 위아래로 드래그해 순서를 바꾼다.** 마스터는 그룹 안에서, 스탭은 자기 소유 프로젝트 목록 안에서.

## 변경 내역

### 서버 — `src/server/workspace/service.ts`
- `reorderProjects(groupId, projectIds, opts?)` 신설.
  - **슬롯 재배정 방식**: 대상 프로젝트들이 원래 차지하던 `order` 값들을 오름차순으로 모아, 보낸 순서(projectIds)대로 그 슬롯들을 다시 나눠 준다.
  - 그래서 **마스터**(그룹 전체 전달)는 0..N-1 전면 재배치가 되고, **스탭**(자기 소유분만 전달)은 그 부분집합만 자기 슬롯 안에서 재정렬돼 **비소유 프로젝트의 상대 위치가 보존**된다.
  - `opts.ownerId`(스탭)면 그 작업자 소유 프로젝트만 대상. 보낸 목록이 실제 대상 집합과 정확히 일치하지 않으면(남의/딴 그룹/중복 id) 0건 반환 → 라우트가 403.
  - Project.order는 유니크가 아니라 Stage처럼 음수 피신이 필요 없다.

### API — `src/app/api/admin/groups/[groupId]/projects/order/route.ts` (신규)
- `PATCH { projectIds }`. 단계 순서 라우트와 같은 규약(마스터=전체, 스탭=소유분, 서버 재검증). 부분 갱신이 아니라 순서 재배치라 그룹 하위 리소스로 뒀다.

### 프론트 API — `src/lib/api/workspace.ts`
- `reorderProjectsApi(groupId, projectIds)`.

### 클라이언트 스토어 — `src/components/features/projects/project-store.tsx`
- `reorderProjects(groupId, projectIds)` 낙관적 액션. 서버와 같은 **슬롯 재배정**을 배열 위치로 재현한다(대상들이 차지한 배열 인덱스를 새 순서로 채움) → 스탭 부분 재정렬도 비소유 프로젝트를 건드리지 않는다. 이후 `reorderProjectsApi`로 저장.

### 드래그 규약 — `src/components/features/projects/project-drag.ts` (신규)
- MIME `application/x-yos-project`, 값에 `groupId:projectId`를 담는다. order가 그룹별이라 **드롭 시 같은 그룹 안에서만** 재정렬한다(다른 그룹으로의 이동은 다루지 않음).

### 사이드바 UI — `src/components/layout/projects-nav.tsx`
- 프로젝트 행(마스터·스탭 양쪽)의 `Link`를 draggable로, `li`를 드롭 대상으로 배선.
- **대상 행 앞에 끼우는** 방식: 끌어온 프로젝트를 드롭한 행의 앞자리로 옮긴 새 순서를 만들어 `reorderProjects` 호출. 보이는 목록 기준(마스터=그룹 전체, 스탭=그 그룹의 소유분).
- 드롭 대상은 링(`ring-primary/50`), 끌고 있는 원본은 흐림(`opacity-40`)으로 표시.

## 결정 이유
- **슬롯 재배정**으로 마스터 전면 재배치와 스탭 부분 재정렬을 한 함수로 처리. 스탭이 소유분만 옮겨도 같은 그룹의 남 프로젝트가 딸려 움직이지 않는다.
- **같은 그룹 안에서만**: order가 그룹 스코프라 그룹 간 이동은 별도 개념(프로젝트 그룹 이동 UI도 없음). 드래그 값에 groupId를 실어 교차 그룹 드롭을 무시한다.
- **앞에 끼우기**: 위아래 재정렬에 충분하고 구현이 단순하다(대상 행 위로 놓으면 그 앞으로).

## 실행/검증
```bash
npm run lint / npm run build   # 통과
```
**실앱 검증 (dev + 헤드리스 Edge, 전용 테스트 데이터):**
- 서버 API: 그룹에 P0·P1·P2 생성 → `PATCH .../projects/order`로 [P2,P0,P1]·[P1,P2,P0] 재정렬이 GET workspace에 그대로 반영. 잘못된 입력(없는 id 섞음)은 403·순서 불변. → PASS
- 사이드바 드래그: `/projects`에서 zzRC를 zzRA 앞으로 드래그 → 사이드바 DOM·서버 저장 모두 [zzRC,zzRA,zzRB]. → PASS
