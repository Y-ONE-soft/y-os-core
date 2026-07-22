# 17. 프로젝트 상세 화면 Project Detail Layout 정합

- **예정 커밋 메시지**: `feat: 프로젝트 상세 화면 Project Detail Layout 정합`
- **작업일**: 2026-07-22
- **작업 브랜치**: `프로젝트-상세-레이아웃-재구성` (워크트리 `.claude/worktrees/project-detail-layout`, base: main `f368d11`)

---

## 1. 작업 요약

Figma `jimmy-design-system` → `Project Detail Layout`(node `96:166`, 페이지 콘텐츠 `96:245`) 최신 스펙 기준으로 프로젝트 상세 화면(docs/8·11에서 구현)을 재정합했다. 구조는 유지하고 스타일·컨트롤 차이를 맞춘 정합 패스.

## 2. 디자인 대비 변경 사항

| 영역 | 디자인 (96:245) | 기존 구현 | 조치 |
|---|---|---|---|
| 브레드크럼 프로젝트 칩 | `bg-accent` | `bg-background` | `bg-accent text-accent-foreground` |
| 탭바 활성 탭 | `bg-accent` + 라운딩 6px | `bg-background` + rounded-full | 수정 |
| 로드맵 카드·보드 컬럼·백로그 라운딩 | 8px | 12px | 8px 통일 |
| 로드맵 헤더 "프리셋 저장" 버튼 | 있음 (`160:511`) | 없음 | 추가 — **시각만**, 프리셋 저장 플로우(`161:511` Preset Save · New 등)는 후속 태스크 |
| ＋ 단계·프리셋 저장 버튼 모양 | 라운딩 6px 사각 보더 | rounded-full | 수정 |
| 레인지 스위처(오늘/일/주/개월/분기) 활성 | `bg-background` + 그림자 (세그먼트 컨트롤) | `bg-primary` 네이비 필 | 수정 (컨테이너 8px, 항목 6px) |
| 보드 점선 "＋ 단계 추가" 컬럼 | **없음** | 있음 (docs/11에서 추가) | **제거** — 단계 추가 진입점은 로드맵 헤더 ＋ 단계, 로드맵 하단 ＋ 단계 추가 행 2곳 유지 |

## 3. 변경 파일 내역

| 파일 | 내용 |
|---|---|
| `project-detail-page.tsx` | 칩·탭바 스타일, ProjectBoard `onAddStage` prop 전달 제거 |
| `project-roadmap.tsx` | 카드 라운딩 8px, 프리셋 저장 버튼 추가, ＋ 단계 버튼 6px, 레인지 스위처 활성 스타일 |
| `project-board.tsx` | 컬럼 라운딩 8px, 점선 단계 추가 컬럼 및 `onAddStage` prop 제거 |
| `project-backlog.tsx` | 카드 라운딩 8px |
| `docs/17-…` | 이 문서 |

## 4. 결정 사항

- 색·간격은 임의 값 대신 기존 디자인 토큰(`bg-accent`, `bg-muted` 등) 사용 — 디자인 raw 변수(`--accent #f4f4f5` 등)와 프로젝트 토큰이 일치함
- 프리셋 저장 버튼은 핸들러 없는 시각 요소로 추가 (레인지 스위처와 동일한 "시각만" 원칙) — 프리셋 도메인은 별도 디자인(Preset List `163:676`, Preset Detail `164:755`) 기준의 후속 요청 대상
- 점선 컬럼 제거는 기능 축소가 아니라 진입점 정리 (검토 시 이견 있으면 되돌림)

## 5. 검증

1. `npm run lint` ✓ · `npm run build` ✓ (전체 라우트, exit 0)
2. dev(3007) 기동 → master01 로그인 → `/projects/p-yos` SSR HTML 검사:
   - "프리셋 저장" 1건 ✓ · "단계 추가" 1건(로드맵 행만 — 점선 컬럼 제거 확인) ✓
   - `rounded-[12px]` 0건 · `rounded-[8px]` 26건 · `border-dashed` 0건 ✓
   - 탭·칩 `bg-accent` 반영 ✓
3. Figma 96:166 스크린샷과 구조 대조 — 헤더 컨트롤 순서(프리셋 저장 → ＋ 단계 → 스위처), 컬럼 구성 일치

## 6. 알려진 사항 / 후속 과제

- 프리셋 저장·프리셋 목록/상세, 레인지 스위처 동작, 막대 드래그, Task/Stage Detail Overlay(105:243, 130:414)는 디자인만 존재 — 별도 요청 단위
- 사이드바 워크스페이스 메뉴(내 작업·작업 분석·프리셋 진입점)는 이 요청 범위 밖
