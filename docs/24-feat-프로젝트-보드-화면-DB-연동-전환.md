# 24. 프로젝트·보드 화면 DB 연동 전환

- **예정 커밋 메시지**: `feat: 프로젝트·보드 화면 DB 연동 전환`
- **작업일**: 2026-07-22
- **작업 브랜치**: `할일-DB-전환` (커밋 2/2)

---

## 1. 작업 내용 요약

localStorage 기반이던 `project-store`·`board-store`를 **DB 연동(낙관적 업데이트)**으로 재구현했다. 커밋 23의 서버 레이어를 소비한다. **화면 컴포넌트의 import·훅·액션 시그니처는 그대로 유지**해, 병렬 진행 중인 다른 작업자 화면(작업 현황·내 작업 등)이 영향을 받지 않는다. 사용자 요구("실제로 할일 추가할 때 화면이 연결되고 데이터로 저장")대로, 할일 추가·완료·이동·상세 내용이 전부 Neon에 저장된다.

## 2. 구조 — 단일 캐시 + 낙관적 업데이트

```
project-store / board-store (기존 인터페이스 유지)
        │  낙관적 로컬 반영 + 서버 저장
        ▼
workspace-cache.ts (신규)  ── 단일 스냅샷 소스, useSyncExternalStore로 두 스토어가 공유
        │  fetch/persist
        ▼
lib/api/workspace.ts → /api/admin/** → server/workspace → Neon
```

- **부트스트랩**: `ProjectStoreProvider` 마운트 시 `cache.ensureLoaded()`가 `GET /api/admin/workspace` 1회 호출로 전체 트리를 채운다. (proxy가 비로그인 접근을 막으므로 이 시점엔 항상 세션 존재)
- **낙관적 업데이트**: 모든 액션이 `cache.apply(로컬 즉시 반영)` → `cache.persist(API 호출)`. 저장 실패 시 `refresh()`로 서버 상태를 다시 당겨 **로컬 어긋남을 자동 복구**.
- **SSR 정합성**: 서버 스냅샷은 빈 워크스페이스 → 하이드레이션 후 클라이언트가 fetch. `useSyncExternalStore` 공식 패턴 유지.

## 3. 스토어별 전환 내역

| 스토어 | 액션 | 저장 경로 |
|---|---|---|
| project-store | addGroup·deleteGroup·addProject·deleteProject | groups/projects API |
| project-store | resetData | reset API → refresh |
| board-store | addStage·updateStage(이름/기간/완료/내용/요청) | stages API |
| board-store | addComment | comments API (작성자=세션) |
| board-store | addTask·addBacklogTask | tasks API |
| board-store | toggleTask·moveTask·**updateTask(신규: 이름/내용)** | tasks PATCH |

- `useBoardState`/`useProjectBoard`/`useProjectStore` 반환 형태·`boardActions` 시그니처 **불변** → 소비 컴포넌트 무수정.
- 타입 원본을 `src/types/workspace.ts`로 이관하고 `project-detail-data.ts`는 **재노출 + 화면 상수(ROADMAP·TEAM_MEMBERS)만** 남김. `BOARD_SEED`/`SEED_GROUPS` 상수·localStorage 코드 제거.

## 4. 화면 연결 — 작업 상세 오버레이

- 작업 상세 오버레이 '내용' Textarea를 `task.description` 바인딩 + **onBlur 시 `boardActions.updateTask`로 저장**(세션 유지·새로고침 후 복원). 기존엔 미저장 로컬 입력이었다.
- 제목 완료 체크·단계 셀렉트(이동)는 이미 boardActions 경유라 자동으로 DB 저장으로 승격됨.

## 5. 변경 파일 내역

| 구분 | 파일 |
|---|---|
| 신규 | `src/components/features/projects/workspace-cache.ts` |
| 재작성 | `project-store.tsx`(DB 연동), `board-store.tsx`(DB 연동 + updateTask) |
| 축소 | `project-detail-data.ts`(타입 재노출 + 상수만) |
| 수정 | `task-detail-overlay.tsx`(내용 저장 연결) |
| 신규 | `docs/24-…`(이 문서) |

## 6. 검증 (프로덕션 빌드 + 실 Neon DB, puppeteer)

1. `npm run lint`·`npm run build` ✓ (최신 main 병합 후 재검증 — 작업 현황·내 작업 등 병렬 화면과 무충돌)
2. **부트스트랩**: 로그인 → `/projects/p-yos` → `GET /api/admin/workspace 200` → 사이드바(Lab/Soft/Printing)·보드(3단계·PRD 등 시드 작업)·백로그 전부 DB에서 렌더 (스크린샷 확인)
3. **UI→DB 저장·영속(핵심)**:
   - ＋작업으로 추가 → `POST /api/admin/tasks 200` → **새로고침 후에도 유지** ✓
   - PRD 완료 체크 → `PATCH /api/admin/tasks/tk-prd 200` ✓
   - 상세 오버레이 내용 입력·이동·데이터 초기화 → 각 API 200, curl로 workspace 반영·reset 정리 확인
4. **권한**: reset·그룹/프로젝트 변경은 MASTER 전용(STAFF 403) — 서버 가드
5. 참고: 검증 스크립트에서 Puppeteer `.type()`이 한글을 입력하지 못하는 하네스 특성 발견(앱 무관) → 네이티브 setter 주입으로 우회해 추가·영속 확인

## 7. 알려진 사항 / 후속 과제

- 낙관적 업데이트는 저장 실패 시 전체 refresh로 복구 — 세밀한 롤백/토스트 알림은 후속
- 다중 사용자 동시 편집 실시간 동기화 없음(부트스트랩 1회 + 로컬) — 필요 시 폴링/구독
- 산출물·연결 티켓·유형/난이도·이슈 등록은 여전히 오버레이 로컬 상태 — 각 도메인 태스크에서 스키마화
- 프로덕션 배포 후 로그인→할일 추가 동작은 머지 후 "사후 검증 결과 (추록)"로 확인 예정
