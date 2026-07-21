# 4. Y.OS Shell 공통 레이아웃 구현

- **예정 커밋 메시지**: `feat: Y.OS Shell 공통 레이아웃 구현`
- **작업일**: 2026-07-22

---

## 1. 작업 내용 요약

Figma 디자인 시스템(`jimmy-design-system`)의 **Y.OS Shell**을 기준으로 앱 공통 레이아웃(글로벌 헤더 + 컨텍스트 사이드바 + 콘텐츠 영역)을 구현했다. 사이드바 접힘·유저 메뉴 드롭다운 확장 버전까지 반영했고, 전역 loading/error/404 페이지와 루트 메타데이터 정비를 포함한다.

## 2. 디자인 소스

- Figma 파일: `jimmy-design-system` (fileKey `Vmv6OlcsEHpHnf5vNDVDoX`) → `🚀 Y.OS Core` 페이지 (node `34:472`)
- 참조 노드 3개:
  | 노드 | 이름 | 내용 |
  |---|---|---|
  | `64:140` | Y.OS Shell | 기본형 — 헤더 64px + 사이드바 256px + 콘텐츠. "모든 Y.OS 화면은 이 인스턴스 + Content로 조합한다" |
  | `74:13` | Y.OS Shell — Collapsed Sidebar | 사이드바 축소(아이콘 전용, 72px). 라벨·배지·그룹 라벨 숨김 |
  | `74:65` | Y.OS Shell — User Menu Open | 아바타 클릭 시 드롭다운(설정·로그아웃) 펼침 상태 |

## 3. 구현 구조

```
src/app/(main)/layout.tsx        # 셸 조립: ShellProvider > GlobalHeader + ContextNav + <main>
src/app/(main)/page.tsx          # "/" 대시보드 자리 (기존 src/app/page.tsx를 (main)으로 이동)
src/components/layout/
  global-header.tsx              # <header>: 사이드바 토글 + 브랜드 + 상단 섹션 네비 + UserMenu
  sidebar-toggle.tsx             # 헤더 좌측 접힘 토글 버튼 (client, PanelLeft 아이콘)
  shell-context.tsx              # 셸 상태 컨텍스트 (사이드바 접힘 상태 공유)
  user-menu.tsx                  # 아바타/이름/직함 트리거 + shadcn DropdownMenu (설정 / 로그아웃)
  context-nav.tsx                # <aside><nav>: 그룹형 메뉴(운영/바로가기) (client)
src/app/loading.tsx              # 전역 로딩 (스피너)
src/app/error.tsx                # 전역 에러 (다시 시도 버튼)
src/app/not-found.tsx            # 404 (대시보드 복귀 버튼)
public/brand-mark.svg            # 브랜드 마크 (Figma 에셋 다운로드본)
```

### 시멘틱 마크업 (사용자 요구사항)

`<header>`(글로벌 헤더), `<nav aria-label="주요 섹션">`(상단 네비), `<aside>` + `<nav aria-label="컨텍스트 메뉴">` + `<ul>/<li>`(사이드바), `<main>`(콘텐츠), `<h1>`(페이지 제목). 활성 메뉴에는 `aria-current="page"`, 접힘 토글에는 `aria-label` 적용. 프로덕션 렌더 HTML에서 태그 존재를 검증했다(아래 6절).

## 4. 디자인 → 구현 결정 사항

| 항목 | 디자인 | 구현 결정 | 이유 |
|---|---|---|---|
| 색상 토큰 | `--brand/primary`, `--muted` 등 CSS 변수 | shadcn 토큰(`primary`, `muted`, `accent`, `border`, `destructive`)으로 1:1 매핑 | 프로젝트 토큰 시스템 재사용 (globals.css 단일 관리) |
| 브랜드 프라이머리 | 네이비(브랜드 마크 `#1B2A44`, 아바타 렌더 색) | `--primary`를 `#1b2a44`로 변경 | 디자인 시스템의 실제 브랜드 색. 아바타·버튼 등에 일괄 반영 |
| 브랜드 마크 | Figma 이미지 에셋 (28px, 네이비 라운드 사각 + 골드 도트) | SVG 다운로드 → `public/brand-mark.svg` 커밋 | Figma 에셋 URL은 7일 만료 — 파일로 커밋해야 안전 |
| 사이드바 아이콘 | 플레이스홀더 사각형 (실제 글리프 없음) | lucide 아이콘 매핑 (대시보드 LayoutDashboard, 작업 현황 ListTodo, 문의함 Inbox, 프로젝트 FolderKanban, 위키 BookOpen, 고객 Users) | 디자인이 아이콘 슬롯만 정의 → 프로젝트 아이콘 라이브러리(lucide, components.json 규약) 사용 |
| 활성 메뉴 색 | raw 코드는 `brand/primary` bg지만 렌더 화면은 연회색 bg + 진한 텍스트 | `bg-accent text-accent-foreground` | Figma 변수 모드로 인한 raw 코드 불일치 — 스크린샷 렌더 기준을 따름 |
| 접힘 토글 | 접힘 변형은 있으나 토글 컨트롤 없음 | **헤더 좌측**(브랜드 앞) PanelLeft 아이콘 버튼 + `ShellProvider` 컨텍스트로 상태 공유 | 접힘 변형이 존재 = 접힘 가능해야 함. 아래 "재작업" 참고 — 최초 사이드바 하단 배치는 실패 |
| 유저 메뉴 | 드롭다운 펼침 상태 정적 화면 | shadcn DropdownMenu (설정 / separator / 로그아웃 `variant="destructive"`) | 프로젝트 컴포넌트 재사용. 메뉴 동작(설정 이동·로그아웃)은 인증 태스크에서 연결 |
| 상단 네비 활성 | 운영 활성 상태 | 운영 정적 활성 | 현재 운영 섹션만 존재. 섹션 라우팅 도입 시 pathname 기반 전환 |
| 사이드바 활성 | 대시보드 활성 상태 | `usePathname` 기반 동적 판정 ("/"는 정확 일치, 나머지는 prefix) | 실제 라우팅 연동 |
| 폰트 | Inter | 프로젝트 기본 Geist 유지 | shadcn Nova 프리셋 규약, 시각적으로 동등 |
| 플레이스홀더 데이터 | 유저(노윤기/대표), 문의함 배지 4 | 상수로 하드코딩 | 인증·데이터 연동 전 임시. 각 태스크에서 실데이터로 교체 |

### 메뉴 구성 (디자인 그대로)

- 상단 섹션 네비: **운영**(활성) · 프로젝트 · 위키
- 사이드바 — 운영: 대시보드(`/`) · 작업 현황(`/tasks`) · 문의함(`/inbox`, 배지 4)
- 사이드바 — 바로가기: 프로젝트(`/projects`) · 위키(`/wiki`) · 고객(`/customers`)
- 미구현 경로는 전역 404 페이지로 자연스럽게 처리 (각 페이지는 후속 태스크에서 구현)

## 5. 변경 파일 내역

| 구분 | 파일 | 내용 |
|---|---|---|
| 신규 | `src/app/(main)/layout.tsx` | 셸 레이아웃 (헤더 + 사이드바 + main) |
| 신규 | `src/app/(main)/page.tsx` | 대시보드 자리 페이지 |
| 신규 | `src/components/layout/global-header.tsx` | 글로벌 헤더 (서버 컴포넌트) |
| 신규 | `src/components/layout/sidebar-toggle.tsx` | 사이드바 접힘 토글 버튼 (클라이언트) |
| 신규 | `src/components/layout/shell-context.tsx` | 셸 상태 컨텍스트 (`ShellProvider`/`useShell`) |
| 신규 | `src/components/layout/user-menu.tsx` | 유저 메뉴 드롭다운 |
| 신규 | `src/components/layout/context-nav.tsx` | 컨텍스트 사이드바 (클라이언트 — pathname·접힘 상태) |
| 신규 | `src/app/loading.tsx` / `error.tsx` / `not-found.tsx` | 전역 로딩·에러·404 |
| 신규 | `public/brand-mark.svg` | 브랜드 마크 에셋 |
| 신규 | `docs/4-feat-y-os-shell-공통-레이아웃-구현.md` | 이 문서 |
| 수정 | `src/app/layout.tsx` | `lang="ko"`, 메타데이터(`Y.OS Core`, 타이틀 템플릿) |
| 수정 | `src/app/globals.css` | `--primary`를 브랜드 네이비 `#1b2a44`로 변경 |
| 수정 | `.gitignore` | 로컬 dev 서버 로그(`/dev-server.log`) 제외 추가 |
| 삭제 | `src/app/page.tsx` | `(main)/page.tsx`로 이동 |

### [재작업] 접힘 토글 위치 — 사이드바 하단 → 헤더 좌측

- 최초 구현은 접힘 토글을 **사이드바 하단**에 배치했는데, 사용자로부터 "Collapsed Sidebar가 동작하지 않는 것 같다"는 피드백을 받음.
- 브라우저 자동화(puppeteer)로 원인 조사 → 기능 자체는 정상이었으나, **Next.js dev tools 플로팅 버튼(좌측 하단 "N" 오버레이)이 토글 버튼을 정확히 덮고 있어** dev 모드에서 클릭이 오버레이에 가로채이는 문제 확인.
- 해결: 토글을 **글로벌 헤더 좌측(브랜드 앞)**으로 이동 — 표준적인 사이드바 트리거 위치이고 오버레이와 충돌하지 않음. 헤더(서버)와 사이드바(클라이언트)가 상태를 공유해야 하므로 `ShellProvider`(React Context) 도입.

## 6. 검증

1. `npm run build` ✓ — 컴파일·TypeScript·정적 프리렌더 통과 (`/`, `/_not-found` Static)
2. `npm run lint` ✓
3. **프로덕션 서버 렌더 검증** — `next start`로 띄운 뒤 `/` HTML을 curl로 확인:
   - 시멘틱 태그: `<header>` 1, `<nav>` 2, `<aside>` 1, `<main>` 1, `<ul>` 3, `<li>` 9, `<h1>` 1
   - 콘텐츠: 브랜드/메뉴/유저 텍스트 전부 렌더 확인, `brand-mark.svg` 참조 확인
   - 접근성: `aria-current="page"` 2 (상단 운영 + 사이드바 대시보드), `aria-label` 3
   - 로컬 포트 3000이 다른 프로세스에 점유되어 있어 3100 포트로 검증 후 서버 종료 (이후 점유 프로세스 정리하고 dev 서버를 3000에 상시 실행)
4. **브라우저 인터랙션 검증** (puppeteer-core + Chrome headless) — 접힘 토글 클릭 시 사이드바 256px → 72px(아이콘 전용, 라벨·배지·그룹 라벨 숨김), 재클릭 시 256px 복원 확인. 하이드레이션·onClick 바인딩·콘솔 에러 없음 확인

## 7. 알려진 사항 / 후속 과제

- **다크 모드 토글 없음** — 디자인에 없어 미구현. 토큰은 `.dark` 대응 완료 상태라 `next-themes` 연결만 하면 됨
- **반응형 미대응** — 디자인이 1440px 데스크톱 셸 기준. 모바일 대응은 별도 태스크
- 사이드바 접힘 상태는 새로고침 시 초기화 (영속화 필요 시 localStorage/cookie 추가)
- 유저 메뉴의 설정·로그아웃, 문의함 배지 수치는 인증/데이터 태스크에서 실제 동작 연결
