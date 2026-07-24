# feat: 새 느슨한 할일을 공통 작업 기본 프로젝트로 생성

## 요청 (사이클 B 태스크 3)

새로 만드는 느슨한 할일(내 할일 백로그 입력·캘린더 빈 칸 클릭)이 `projectId=null`(미배정)이 아니라 **내 "공통 작업"(기본 프로젝트)**에 들어가게 한다. 공통 작업은 실제 프로젝트라 캘린더/작업 현황에 일반 프로젝트로 그대로 표시된다(B2에서 이미 노출).

## 변경

### 서버 DTO — 공통 작업 식별용 마커 노출
- `src/types/workspace.ts` — `Project`에 `isDefault?: boolean` 추가.
- `src/server/workspace/service.ts` — `getWorkspace`의 groups 매핑에 `isDefault: project.isDefault` 포함.

### 프론트 — 본인 공통 작업 id 해석
- `src/components/features/my-work/my-work-scope.ts` — `defaultProjectIdOf(groups, userId)` 신설. 소유자=나 && `isDefault`인 프로젝트 id(없으면 null).

### 생성 경로 전환
- `src/components/features/projects/board-store.ts` — `addUnassignedTask(name, assigneeId?, projectId?)`에 `projectId` 인자 추가. 주면 그 프로젝트 백로그로(낙관), 없으면(로드 전 폴백) 미배정으로. 미배정은 다음 로드에 이관된다.
- `src/components/features/my-work/my-work-backlog.tsx` — "+" 입력이 `defaultProjectIdOf`로 내 공통 작업을 찾아 거기에 생성.
- `src/components/features/my-work/my-work-calendar-panel.tsx` — 캘린더 빈 칸 클릭(`projectId=null`)이면 내 공통 작업으로 대체해 생성(`projectId ?? defaultProjectIdOf(...)`).

## 표시 전환

- 공통 작업은 **실제 프로젝트**라 캘린더에서 일반 프로젝트 박스로, 작업 현황 그리드에도 일반 프로젝트로 그대로 그려진다. 별도 UNASSIGNED_BOX 특수 렌더는 미배정 버킷이 비면서 자연히 잠든다(코드는 폴백용으로 남겨 둠).

## 폴백/일관성

- 부트스트랩 로드 전 등 공통 작업 id를 못 찾으면 기존대로 미배정(`projectId=null`)으로 만들고, 다음 워크스페이스 로드의 `ensureDefaultProjects`가 담당자 기준으로 공통 작업에 이관한다(B2). 즉 어떤 경우에도 결국 공통 작업으로 수렴.

## 알려진 이슈 / 후속

- 백로그 티켓의 "프로젝트 없음" 드롭다운 옵션·공통 작업 삭제 가드·UNASSIGNED_BOX 코드 제거 등 잔여 정리는 후속(기능엔 영향 없음).

## 검증

- `npm run lint` 통과 / `npx tsc --noEmit` 통과(exit 0).
- **실제 공유 DB 확인**: dev 기동 → master01 로그인 → `GET /api/admin/workspace`(200) → 응답의 공통 작업 프로젝트가 `isDefault: true`로 노출됨("노윤기의 공통 작업", "김주웅의 공통 작업"). 프론트의 `defaultProjectIdOf`가 이걸로 본인 공통작업을 찾는다.
- 생성 경로(백로그 입력·캘린더 빈 칸 → 공통 작업)는 클라이언트 로직으로 타입 검증됨. 시각 확인은 머지 후 프로덕션/사용자.
