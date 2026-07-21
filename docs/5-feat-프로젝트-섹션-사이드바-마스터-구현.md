# 5. 프로젝트 섹션 사이드바 (마스터) 구현

- **예정 커밋 메시지**: `feat: 프로젝트 섹션 사이드바 (마스터) 구현`
- **작업일**: 2026-07-22

---

## 1. 작업 내용 요약

상단 네비의 **프로젝트** 섹션 진입 시 표시되는 컨텍스트 사이드바를 마스터 권한 기준으로 구현했다. 그룹/프로젝트 트리, 인라인 추가(기본·추가 버전), 노션식 우클릭 삭제, 데이터 초기화까지 포함한다. 이를 위해 상단 네비를 pathname 기반 동적 활성으로 전환하고 사이드바를 섹션별로 스위칭하는 구조를 도입했다.

## 2. 디자인 소스

- Figma `jimmy-design-system` → `🚀 Y.OS Core` 페이지
  | 노드 | 이름 | 내용 |
  |---|---|---|
  | `78:11` | Y.OS Shell — Projects · Master | 기본 버전 — 그룹 트리 + 인라인 추가 고스트 행. "Jira식 이름만 입력 방식" |
  | `82:11` | Y.OS Shell — Projects · Master · Adding | 추가 버전 — 인라인 입력 활성 상태. "한 번에 하나만 활성, 이름만 입력해 즉시 생성" |
- Staff 버전(`79:48`, `82:100`)은 이번 범위에서 제외 (권한 시스템 도입 시 구현)

## 3. 사용자 요구사항 → 구현

| 요구 | 구현 |
|---|---|
| 마스터는 그룹·프로젝트 생성 가능 | `+ 그룹 추가` / `+ 프로젝트 추가` 고스트 행 (마스터 전용 노출). 클릭 시 인라인 입력 — Enter 생성, Esc/blur 취소, ↵ 힌트 표시, 한 번에 하나만 활성 |
| 호버 액티브 상태에서 우클릭 → 메뉴 → 삭제 (노션처럼) | shadcn `ContextMenu`(우클릭)로 그룹 행 → "그룹 삭제", 프로젝트 행 → "프로젝트 삭제" (destructive, 확인 없이 즉시 — 노션식). 행 호버 시 `bg-accent/60` 하이라이트 |
| 기본 버전 + 추가 버전 | 동일 컴포넌트의 상태 전환으로 구현 (`adding` 상태: `null` ↔ `{type:"group"}` ↔ `{type:"project", groupId}`) |

## 4. 구현 구조

```
src/lib/constants.ts                                # CURRENT_USER + UserRole("master"|"staff") — 권한 게이트 기준
src/components/features/projects/project-store.tsx  # 그룹/프로젝트 상태 스토어 (localStorage 영속)
src/components/layout/projects-nav.tsx              # 프로젝트 섹션 사이드바 (트리+인라인추가+우클릭메뉴+푸터)
src/components/layout/top-nav.tsx                   # 상단 섹션 네비 — pathname 기반 활성 (client로 분리)
src/components/layout/context-nav.tsx               # 섹션 스위칭: /projects* → ProjectsNav, 그 외 → 운영 메뉴
src/app/(main)/projects/page.tsx                    # /projects "작업 현황" 자리 페이지
```

### 사이드바 구성 (디자인 그대로)

- **워크스페이스** 그룹: 작업 현황(`/projects`, 활성) · 내 작업(`/projects/my-tasks`) · 작업 분석(`/projects/analytics`) — 운영 메뉴와 같은 스타일(h-38, rounded-10)
- **프로젝트** 트리:
  - 그룹 행(h-34, rounded-8): 캐럿(펼침/접힘) + 폴더 아이콘 + 이름(13px semibold) + 프로젝트 수
  - 프로젝트 행(rounded-8, 들여쓰기 34px): 컬러 도트(8px) + 이름(13px medium), 선택 시 `bg-muted`
  - 시드 데이터: Lab(0) / Soft(3: 화학강사 김한울 CMS 프로젝트·YOS·Y.OS CONTENTS) / Printing(1: 와이즈) — 디자인 그대로
- **푸터**: 데이터 초기화 (스토어를 시드로 리셋 + localStorage 삭제)

## 5. 주요 설계 결정

| 항목 | 결정 | 이유 |
|---|---|---|
| 데이터 계층 | **localStorage 기반 클라이언트 스토어** (`useSyncExternalStore`) | DB/API 미도입 단계의 임시 영속 계층. 디자인의 "데이터 초기화" 푸터가 이 전제를 암시. 추후 태스크에서 `lib/api → Route Handler → server` 흐름으로 교체 |
| SSR 정합성 | 서버 스냅샷=시드, 클라이언트 스냅샷=localStorage — `useSyncExternalStore`의 공식 패턴 | 하이드레이션 불일치 방지. 최초 `useEffect`+`setState` 방식은 `react-hooks/set-state-in-effect` 린트 에러라 재작성함 |
| 권한 | `CURRENT_USER.role === "master"` 상수 게이트 | 인증 미구현 단계의 자리표시. 추가/삭제 UI와 우클릭 메뉴는 마스터에게만 렌더 |
| 프로젝트 클릭 | 페이지 이동 없이 **선택 상태**만 표시 (bg-muted) | 프로젝트 상세 페이지 미구현 — 404 유도 대신 노션식 선택. 상세 페이지 태스크에서 라우팅 연결 |
| 캐럿/아이콘 | lucide ChevronDown/Right, Folder | 디자인의 캐럿·아이콘이 플레이스홀더 도형 → 프로젝트 아이콘 라이브러리 사용 |
| `+ 프로젝트 추가` 위치 | 펼쳐진 모든 그룹의 마지막 행 | 디자인은 Soft 아래만 표시했으나 컴포넌트 설명("인라인 추가 고스트 행")상 그룹별 공통 패턴으로 판단 |
| 삭제 확인 | 확인 대화상자 없이 즉시 삭제 | 사용자가 "노션처럼" 명시 — 노션도 즉시 삭제. 실데이터 연결 시 Undo/휴지통 검토 |
| 새 프로젝트 색 | 8색 팔레트 순환 배정 | 디자인의 도트 색상 체계(blue/purple/emerald/amber) 확장 |
| 사이드바 접힘 모드 | 워크스페이스 아이콘만 표시, 트리·푸터 숨김 | 프로젝트 섹션 접힘 디자인 부재 — 트리는 아이콘 축약이 불가능해 숨김 처리 |

## 6. 변경 파일 내역

| 구분 | 파일 | 내용 |
|---|---|---|
| 신규 | `src/lib/constants.ts` | `CURRENT_USER`(이름/직함/이니셜/역할) + `UserRole` 타입 |
| 신규 | `src/components/features/projects/project-store.tsx` | 그룹/프로젝트 스토어 — 추가·삭제·선택·리셋, localStorage 영속, 시드 데이터 |
| 신규 | `src/components/layout/projects-nav.tsx` | 프로젝트 섹션 사이드바 전체 (트리, 인라인 입력, ContextMenu, 푸터) |
| 신규 | `src/components/layout/top-nav.tsx` | 상단 섹션 네비 (pathname 기반 활성, client) |
| 신규 | `src/components/ui/context-menu.tsx` | shadcn context-menu (CLI 설치) |
| 신규 | `src/app/(main)/projects/page.tsx` | `/projects` 작업 현황 자리 페이지 |
| 신규 | `docs/5-feat-프로젝트-섹션-사이드바-마스터-구현.md` | 이 문서 |
| 수정 | `src/components/layout/context-nav.tsx` | 섹션 스위칭 구조로 재작성 (운영 메뉴는 `OperationsNav`로 추출) |
| 수정 | `src/components/layout/global-header.tsx` | 정적 네비 → `<TopNav />` 교체 |
| 수정 | `src/components/layout/user-menu.tsx` | 유저 정보를 `CURRENT_USER` 상수로 통일 |
| 수정 | `src/app/(main)/layout.tsx` | `ProjectStoreProvider` 래핑 |

## 7. 검증

1. `npm run build` ✓ (/, /_not-found, /projects Static) · `npm run lint` ✓
   - 린트 1회 실패 → 스토어를 `useSyncExternalStore` 패턴으로 재작성 후 통과 (5절 참고)
2. **브라우저 인터랙션 검증** (puppeteer + Chrome headless, 시나리오 8종 전부 통과, 콘솔 에러 0):
   1. 초기 렌더 — 워크스페이스 3항목 + 트리(Lab 0/Soft 3/Printing 1) + 추가 행 + 푸터
   2. 그룹 접기/펼치기 — Soft 접으면 하위 프로젝트 숨김
   3. `+ 그룹 추가` → 인라인 입력 표시 → "테스트그룹" Enter → 트리에 추가됨
   4. `+ 프로젝트 추가`(Soft) → "테스트 프로젝트" Enter → 추가 + 카운트 3→4 갱신
   5. 새로고침 후에도 추가 데이터 유지 (localStorage 영속)
   6. 프로젝트 행 우클릭 → 컨텍스트 메뉴 → "프로젝트 삭제" → 즉시 제거
   7. 그룹 행 우클릭 → "그룹 삭제" → 즉시 제거
   8. 데이터 초기화 → 시드 데이터 복원
3. 스크린샷 비교 — 기본/추가 버전 모두 Figma와 일치 확인

## 8. 알려진 사항 / 후속 과제

- Staff 권한 버전(`79:48`, `82:100`)은 인증·권한 시스템 도입 시 구현
- 프로젝트 데이터는 임시로 localStorage — DB(Prisma+PostgreSQL) 태스크에서 API 경계 흐름으로 교체 예정
- dev 모드에서 Next.js dev tools 오버레이("N" 버튼)가 푸터 "데이터 초기화"의 아이콘 부분과 겹침 — 텍스트 영역 클릭은 정상, 프로덕션에는 오버레이 없음
- 디자인의 Adding 프레임 헤더에 새 **Y.ONE 로고** 컴포넌트(네이비 스퀘어 + "Y.ONE" 텍스트, `92:158`)가 등장 — 현재는 기존 brand-mark.svg 유지 중이며, 로고 교체가 확정이면 별도 반영 필요
- 그룹/프로젝트 이름 변경(rename)은 미구현 — 필요 시 컨텍스트 메뉴에 추가

## 9. 사후 수정 (추록)

- 이 태스크의 커밋(`9baef1e`)에 Claude Code 로컬 워크트리 디렉토리 `.claude/worktrees/parallel-work-setup`이 임베디드 git 저장소(gitlink)로 잘못 포함됨 — `git add -A`가 로컬 도구 산출물을 집어삼킨 실수.
- 후속 커밋에서 `git rm --cached`로 인덱스에서 제거하고 `.gitignore`에 `.claude/worktrees/`를 등록해 재발 차단.
