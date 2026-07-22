# 8. 프로젝트 상세 화면 구현

- **예정 커밋 메시지**: `feat: 프로젝트 상세 화면 구현`
- **작업일**: 2026-07-22
- **작업 브랜치**: `프로젝트-상세-화면`
- **번호 참고**: main의 docs 최대 번호는 6이나, 검토 대기 중인 `로그인-페이지` 브랜치가 7번을 사용 중이라 8번을 선점했다 (병렬 번호 충돌 예방).

---

## 1. 작업 내용 요약

Figma `Project Detail Layout` 기준으로 **프로젝트 상세 화면**을 구현하고, 프로젝트 섹션 사이드바의 프로젝트 행 클릭을 **상세 페이지 라우팅으로 연결**했다 (기존에는 선택 하이라이트만 동작). 상세 화면은 브레드크럼·타이틀·탭바 + **단계 로드맵**(주간 타임라인·막대·오늘선) + **칸반 보드 3열** + **백로그** 사이드 카드로 구성된다. 화면 단위 구현으로, 단계/작업 데이터는 디자인의 예시 값을 자리표시 상수로 재현했다.

## 2. 디자인 소스

- Figma `jimmy-design-system` → `🚀 Y.OS Core` 페이지
  | 노드 | 이름 | 내용 |
  |---|---|---|
  | `96:166` | Project Detail Layout | Y.OS Shell(Projects·Master) + Content 조합 전체 프레임 |
  | `96:245` | Project Detail Page | 콘텐츠 영역 — Page Header(브레드크럼/타이틀/진행률) + Tab Bar + Main |
  | `97:245` | Data View — 단계 로드맵 | 카드 헤더(＋단계, 기간 스위처) + 주간 타임라인(막대·컬럼선·오늘선) |
  | `98:243` | Kanban | 단계별 3컬럼(카드=체크박스+제목), 1열에 "작업 추가(입력 중)" 상태 카드 |
  | `98:1137` | Aside — 백로그 | 인라인 추가 행 + 항목 2개 + 드래그 안내 문구 |

## 3. 구현 구조

```
src/app/(main)/projects/[projectId]/page.tsx              # 동적 라우트 진입 + 예약 슬러그 404 가드 (서버)
src/components/features/projects/
  project-detail-page.tsx     # 화면 조립: 브레드크럼·타이틀·탭 + 본문 배치 (클라이언트 — 스토어 조회)
  project-roadmap.tsx         # 단계 로드맵 카드 (타임라인·막대·오늘선)
  project-board.tsx           # 칸반 보드 3열
  project-backlog.tsx         # 백로그 사이드 카드
  project-detail-data.ts      # 자리표시 데이터 (단계·작업·백로그·로드맵 범위)
src/components/ui/checkbox.tsx                            # shadcn checkbox (CLI 설치)
src/components/layout/projects-nav.tsx                    # [수정] 프로젝트 행 button → Link 라우팅
```

## 4. 디자인 → 구현 결정 사항

| 항목 | 디자인 | 구현 결정 | 이유 |
|---|---|---|---|
| 상세 진입 | (프로토타입 없음) | 사이드바 프로젝트 행 클릭 → `/projects/<id>` 라우팅, 활성 상태는 **URL(pathname) 기준** | docs/5의 "상세 페이지 태스크에서 라우팅 연결" 예정 사항 이행. 스토어의 selection API는 다른 브랜치와의 충돌을 피해 그대로 두고 사용만 중단 |
| 라우트 | — | `/projects/[projectId]` + `my-tasks`·`analytics`는 예약 슬러그로 `notFound()` | 워크스페이스 고정 메뉴 경로가 동적 라우트에 잡혀 404가 풀리는 것 방지 |
| 프로젝트 데이터 | YOS 예시 | 스토어(localStorage)에서 id로 조회 — 이름·컬러 동적, 못 찾으면 "프로젝트를 찾을 수 없습니다" 폴백 | 스토어가 클라이언트 전용이라 서버 `notFound()` 불가 → 클라이언트 폴백 UI |
| 브레드크럼 | `YOS` 칩 › 고객 Y.ONE 내부 | 칩 = 프로젝트명(동적), "고객 Y.ONE 내부"는 정적 자리표시 | 고객/메타 필드가 스토어에 없음 — 데이터 태스크에서 실데이터로 교체 |
| 단계·작업·백로그 | YOS 예시 값 | `project-detail-data.ts` 상수로 디자인 값 그대로 재현 (어느 프로젝트든 동일 표시) | 화면 단위 범위. 단계/작업 도메인은 DB 태스크에서 API 경계 흐름으로 |
| 로드맵 좌표 | 절대 px (컬럼 160.5, 막대 114.6~220) | 일수 기반 % 계산 (범위 28일, 막대 5~10일차, 오늘선 7일차=25%) | 반응형 폭에서도 비율 유지. 날짜는 디자인 고정값(오늘=7/22) — 실제 `Date` 사용 시 정적 프리렌더·하이드레이션 불일치 발생 |
| 탭바 | 보드 활성, 6개 탭 | 정적 표시(보드 고정 활성), 클릭 동작 없음 | 다른 탭 화면 미설계. 활성 필은 top-nav 관례 따라 뮤티드 배경 위 `bg-background` (스크린샷 렌더 기준 — raw 변수 모드 불일치는 docs/4와 동일 사례) |
| 칸반 "작업 추가(입력 중)" | 상태 카드 | 정적 재현 (실입력 없음) | 디자인이 보여주는 상태의 시각 재현 — 실동작은 작업 CRUD 태스크에서 |
| 체크박스 | 16px, primary 보더, radius 4 | shadcn `checkbox` CLI 추가 + `rounded-[4px] border-primary` 오버라이드 | 프로젝트 컴포넌트 규약(`npx shadcn add`). 클릭 시 로컬 체크만 동작(무해) |
| 칸반 컬럼 배경 | `--border` 색 | `bg-border` | 뮤티드 페이지 배경과 구분되는 디자인 의도 그대로 |
| 라운딩/그림자 | 카드 12px, 행 8px, 미세 그림자 | `rounded-[12px]`/`rounded-[8px]` + `shadow-[0_1px_3px_rgba(0,0,0,0.05)]`·`shadow-xs` | 기존 셸·사이드바의 임의값 관례(docs/5)와 통일 |

## 5. 변경 파일 내역

| 구분 | 파일 | 내용 |
|---|---|---|
| 신규 | `src/app/(main)/projects/[projectId]/page.tsx` | 동적 라우트 (Next 16 `params` Promise 규약) + 예약 슬러그 가드 + 메타데이터 |
| 신규 | `src/components/features/projects/project-detail-page.tsx` | 상세 화면 조립 (헤더·탭·본문 배치, 폴백) |
| 신규 | `src/components/features/projects/project-roadmap.tsx` | 단계 로드맵 카드 |
| 신규 | `src/components/features/projects/project-board.tsx` | 칸반 보드 |
| 신규 | `src/components/features/projects/project-backlog.tsx` | 백로그 카드 |
| 신규 | `src/components/features/projects/project-detail-data.ts` | 자리표시 데이터 |
| 신규 | `src/components/ui/checkbox.tsx` | shadcn checkbox (CLI가 생성) |
| 수정 | `src/components/layout/projects-nav.tsx` | 프로젝트 행 `button`(선택) → `Link`(라우팅), 활성 판정을 pathname 기준으로 변경, 스토어 selection 사용 제거 |
| 신규 | `docs/8-feat-프로젝트-상세-화면-구현.md` | 이 문서 |

## 6. 검증

1. `npm run lint` ✓ · `npm run build` ✓ — `/projects/[projectId]` Dynamic(ƒ), 나머지 Static 유지
2. **브라우저 플로우 검증** (puppeteer-core + Chrome headless, 1440×900, 프로덕션 서버):
   - `/projects` → 사이드바 **YOS 클릭 → `/projects/p-yos` 진입** 확인
   - 상세 콘텐츠: h1=YOS, 단계 로드맵·막대(`0% · 07/20~07/24`)·칸반 3열·백로그·안내 문구 전부 렌더, 체크박스 8개(보드 6 + 백로그 2)
   - 사이드바 활성 동기화: `aria-current="page"` = YOS 행
   - 스크린샷 Figma 비교 — 레이아웃·타임라인 막대/오늘선 위치·컬럼 구성 일치
   - 미지 id(`/projects/no-such-id`) → "프로젝트를 찾을 수 없습니다" 폴백 확인
   - 콘솔: 하이드레이션·스크립트 에러 없음 (404 리소스는 미구현 경로 프리페치 — 기존 패턴)
3. `/projects/my-tasks`·`analytics` → 전역 404 **UI** 표시 확인 (아래 알려진 사항 참고)

## 7. 알려진 사항 / 후속 과제

- **예약 슬러그의 HTTP 상태코드가 200** — UI는 404 페이지가 정상 표시되지만, 전역 `loading.tsx`로 인해 동적 라우트가 스트리밍되면서 상태코드가 먼저 커밋된다(Next.js 정상 동작). `내 작업`·`작업 분석` 실제 화면 태스크에서 정적 라우트가 생기면 자연 해소
- 로드맵 드래그(이동·기간 조절), ＋단계/＋작업 추가, 기간 스위처, 탭 전환, 칸반/백로그 드래그 앤 드롭 — 전부 미구현 (화면 단위 범위 밖, 각 기능 태스크에서)
- 단계·작업·백로그·진행률·고객 메타는 자리표시 데이터 — 어느 프로젝트를 열어도 동일하게 표시됨. DB(Prisma) + API 경계 태스크에서 교체
- 브레드크럼 칩이 프로젝트명이라 긴 이름(예: 화학강사 김한울 CMS 프로젝트)은 칩·타이틀이 중복으로 길어짐 — 프로젝트 약칭(key) 필드 도입 시 개선
- 커스텀 추가 프로젝트(localStorage)는 서버 시드에 없어 첫 페인트에 폴백이 잠깐 보였다가 하이드레이션 후 상세로 전환될 수 있음 — API 데이터 계층 도입 시 해소
