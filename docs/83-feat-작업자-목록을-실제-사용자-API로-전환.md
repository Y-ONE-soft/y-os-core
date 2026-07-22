# feat: 작업자 목록을 실제 사용자 API로 전환

- **예정 커밋 메시지**: `feat: 작업자 목록을 실제 사용자 API로 전환`
- **작업일**: 2026-07-22
- **작업 브랜치**: `요청-알림-실데이터` (워크트리 `.claude/worktrees/request-notifications`, base: main `cc41090`)

---

## 1. 작업 내용 요약

요청 대상을 고르는 **작업자 목록을 하드코딩 자리표시에서 실제 DB 사용자로 전환**했다.

이 사이클의 목표는 "내 할일 요청 알림을 실제로 동작하게" 만드는 것인데, 요청을 **누구에게** 보낼지가 가짜면 요청도 가짜가 된다. 그래서 사용자 목록 교체를 첫 태스크로 뒀다.

기존 `TEAM_MEMBERS`는 **두 곳에 중복 정의**돼 있었고 필드명도 서로 달랐다.

| 위치 | 형태 | 사용처 |
|---|---|---|
| `src/lib/constants.ts` | `{id, name, title, color}` | 공동 작업자 지정 요청 다이얼로그 |
| `src/components/features/projects/project-detail-data.ts` | `{id, name, role, color}` | 할일 상세 요청 모달, 단계 추가 오버레이 |

둘 다 김서연·박지훈·이민아·최현우 4명 고정이었다. 이번에 **양쪽 모두 제거**하고 단일 경로(`GET /api/admin/users` → `useUsers()`)로 통일했다.

## 2. 변경 파일 내역

| 구분 | 파일 | 내용 |
|---|---|---|
| 추가 | `src/types/users.ts` | `DirectoryUser` — 목록 노출용 최소 필드 |
| 추가 | `src/server/users/service.ts` | `listUsers()` — 이름 오름차순(동률 시 id) 고정 |
| 추가 | `src/app/api/admin/users/route.ts` | `GET /api/admin/users` — 인증 필수 |
| 추가 | `src/lib/api/users.ts` | `fetchUsers()` |
| 추가 | `src/hooks/use-users.ts` | `useUsers()` — 모듈 수준 캐시 |
| 추가 | `src/lib/avatar-color.ts` | `avatarColor(id)` — id에서 결정적 색 파생 |
| 수정 | `src/lib/constants.ts` | `TEAM_MEMBERS` 제거 |
| 수정 | `src/components/features/projects/project-detail-data.ts` | `TEAM_MEMBERS` 제거 |
| 수정 | `src/components/features/projects/collaborator-request-dialog.tsx` | 실제 사용자 목록, 자기 자신 제외, 로딩·빈 상태 |
| 수정 | `src/components/features/projects/task-detail-overlay.tsx` | 요청 모달 목록 동일 전환 |
| 수정 | `src/components/features/projects/stage-add-overlay.tsx` | 선택된 공동작업자 이름 표기를 실제 사용자로 |
| 추가 | `docs/83-feat-작업자-목록을-실제-사용자-API로-전환.md` | 본 문서 |

## 3. 설계 결정과 이유

| 결정 | 선택 | 이유 |
|---|---|---|
| 권한 | 로그인한 사용자면 누구나 조회 | 요청 대상을 고르려면 스탭도 목록이 필요하다. 민감 필드(`passwordHash`·`email`)는 애초에 담지 않는다 |
| 노출 필드 | `id`·`name`·`title`·`role`·`groupId`만 | `SessionUser`와 달리 남의 정보이므로 최소화. `email`은 목록에 불필요 |
| 정렬 | 이름 오름차순, 동률 시 id | 고정하지 않으면 렌더마다 순서가 흔들린다 |
| 캐시 | 모듈 수준 1회 로드 공유 | 요청 다이얼로그가 단계 추가·단계 상세·할일 상세 3곳에서 열린다. 열 때마다 재요청은 낭비 |
| 자기 자신 | 목록에서 제외 (UI에서 필터) | 자신에게 요청하는 건 의미가 없다. 서버가 아닌 UI에서 거르는 이유는 목록 자체는 범용이기 때문 |
| 아바타 색 | `avatarColor(id)`로 파생 | `User`에 색 컬럼이 없다. 기존 자리표시가 쓰던 팔레트를 그대로 써서 화면 톤 유지 |
| 직책 표기 | `title ?? 권한명(마스터/스탭)` | `title`이 nullable이라 빈칸이 생길 수 있다. 헤더 유저 메뉴가 쓰는 규칙과 동일 |

## 4. 검증

1. `npm run lint` ✓ · `npm run build` ✓
2. **브라우저 실검증** — dev 서버(워크트리 전용 포트 3009, 점유 프로세스 CommandLine으로 자기 워크트리 확인), puppeteer-core + 시스템 Chrome

   | 항목 | 결과 |
   |---|---|
   | 비로그인 `GET /api/admin/users` | **401** `{"error":"인증이 필요합니다."}` |
   | 로그인(`master01`) 후 동일 호출 | **200**, 사용자 2명 반환 |
   | 반환 내용 | `마스터`(대표/MASTER/g-soft), `스탭`(사원/STAFF/g-soft) — 민감 필드 없음 |
   | 공동 작업자 지정 요청 다이얼로그 | 목록에 **`스탭 · 사원` 1건만** — 로그인한 마스터 본인이 제외됨 |
   | 페이지 에러 | 없음 (기록된 401은 위 비로그인 테스트가 의도적으로 낸 것) |

3. 검증용 임시 프로젝트·단계는 스크립트가 만들고 **끝나면 삭제**했다 (삭제 status 200 확인).

## 5. 알려진 사항 / 후속 과제

- **실제 사용자가 2명뿐이다** (`master01`, `step01`, 둘 다 `Soft` 그룹). 요청 왕복(마스터 → 스탭)은 검증 가능하지만, 여러 명을 골라 보내는 상황은 재현되지 않는다. 사용자 생성 화면은 이 사이클 범위 밖이다.
- **그룹 필터는 넣지 않았다.** 지금은 전원(2명)을 보여준다. 사용자가 늘어나면 소속 그룹 우선 노출이나 검색이 필요해진다 — `groupId`를 응답에 포함해 둔 것은 그때를 위한 것이다.
- `stage-add-overlay`는 선택된 공동작업자 **이름 표기**에만 목록을 쓴다. 실제 요청 발송은 태스크 3에서 붙인다.
- 이 태스크는 **요청 도메인 자체를 만들지 않았다.** 현재 공동 작업자 지정은 여전히 `requestedCollaborators` 배열에 id를 저장할 뿐이고, 요청·수락·거절 개념은 태스크 2~4에서 도입한다.
