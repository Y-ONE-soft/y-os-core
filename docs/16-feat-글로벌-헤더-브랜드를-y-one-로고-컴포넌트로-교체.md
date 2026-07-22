# 16. 글로벌 헤더 브랜드를 Y.ONE 로고 컴포넌트로 교체

- **예정 커밋 메시지**: `feat: 글로벌 헤더 브랜드를 Y.ONE 로고 컴포넌트로 교체`
- **작업일**: 2026-07-22
- **작업 브랜치**: `헤더-Y.ONE-로고-교체`
- **번호 조정**: 작성 시점 14번 → 병렬 머지로 14(작업 현황, PR #10에서 조정)·15(프리즈마 훅)가 선점되어 **규칙에 따라 16번으로 조정**. (인수 세션이 한때 15번으로 선점했던 문서는 14번으로 일원화됐다가, 최종적으로 이 번호가 됨 — 병렬 번호는 머지 시점에만 확정된다는 사례)

---

## 1. 작업 내용 요약

글로벌 헤더의 브랜드 아이콘을 기존 이미지 에셋(`brand-mark.svg`, 네이비 스퀘어+골드 도트)에서 **Y.OS Shell 디자인의 Y.ONE 로고 컴포넌트**(네이비 스퀘어 + 화이트 "Y.ONE" 와이드 트래킹)로 교체했다. docs/5에 기록해 둔 보류 항목("새 Y.ONE 로고 등장 — 교체 확정 시 반영")의 이행이며, 사용자 요청으로 확정됐다. 로그인 화면에 이미 있던 40px 버전과 합쳐 **공용 `YOneLogo` 컴포넌트**(28/40 두 변형)로 통일했다. 브랜드 네임은 기존 그대로 "Y.OS Core"(디자인과 일치— 변경 불필요 확인).

## 2. 디자인 소스

- Figma `jimmy-design-system` → `Y.ONE Logo` 컴포넌트(`92:158`): "네이비 스퀘어 + 화이트 Y.ONE 와이드 트래킹. 헤더 28 · 로그인 40"
- 크기별 노드 값: 28px — rounded 4px, 텍스트 6.5px/트래킹 0.91px · 40px — rounded 6px, 텍스트 9px/트래킹 1.26px (Y.OS Shell 헤더 인스턴스·Login Layout 인스턴스 raw 값 그대로)

## 3. 변경 파일 내역

| 구분 | 파일 | 내용 |
|---|---|---|
| 신규 | `src/components/layout/y-one-logo.tsx` | 공용 `YOneLogo` 컴포넌트 — `size` 28(헤더)/40(로그인) 변형, CSS+텍스트 구현(벡터 에셋 아님), 색은 `primary` 토큰 |
| 수정 | `src/components/layout/global-header.tsx` | `next/image` + brand-mark.svg → `<YOneLogo size={28} />` |
| 수정 | `src/components/features/auth/login-page.tsx` | 로컬 `BrandMark` 제거 → `<YOneLogo size={40} />` 재사용 |
| 삭제 | `public/brand-mark.svg` | 참조처 없음 확인 후 제거 (docs/4에서 커밋했던 Figma 에셋) |
| 수정 | `docs/13-…` | 5절 "사후 검증 결과 (추록)" 보완 — 프로덕션 복구·인증 가드 라이브 수치 (다음 커밋 포함 규칙) |
| 신규 | `docs/14-feat-글로벌-헤더-브랜드를-y-one-로고-컴포넌트로-교체.md` | 이 문서 |

## 4. 결정 사항

- **CSS+텍스트 구현 유지** — 로고가 벡터 에셋이 아니라 사각형+텍스트 조합이라 이미지 다운로드 없이 코드로 충실 재현 가능(로그인 화면에서 확립한 방식). 색이 `primary` 토큰이라 브랜드 컬러 변경 시 자동 반영
- **로고는 `aria-hidden`** — 바로 옆에 "Y.OS Core" 텍스트가 있어 중복 낭독 방지 (헤더 링크의 접근 가능한 이름은 텍스트가 담당)
- 사용처가 늘면(`favicon`, OG 이미지 등) 그때 SVG 에셋화 검토

## 5. 검증

1. `npm run lint` ✓ · `npm run build` ✓
2. **브라우저 검증** (puppeteer, 프로덕션 서버): 헤더에 `<img>` 없음(에셋 제거 확인) + "Y.ONE" 로고 텍스트·"Y.OS Core" 브랜드 네임 렌더 확인, 페이지 에러 0
3. 스크린샷 비교 — 헤더(28px)·로그인(40px) 모두 Y.OS Shell/Login Layout 디자인과 일치
4. 검증 중 워크트리에 `.env.local`이 없어 로그인 API 500 재현 — 메인 폴더에서 복사 후 정상. **UI-only 태스크라도 로그인 관문 때문에 셸 화면 검증에는 env가 필요하다**는 점 확인 (CLAUDE.md env 규약의 적용 범위 사례)
5. **세션 인수 재검증** — 원 세션 중단 후 다른 세션이 워크트리를 인수해 `npm run lint` ✓ · `npm run build` ✓(Next 16.2.11) 재확인, 프리렌더 산출물 `login.html`에 40px 변형 클래스 포함 확인. 인수 과정에서 중복 작성된 결과 문서(15번)는 이 문서로 일원화하고 제거

## 6. 알려진 사항

- `favicon.ico`는 create-next-app 기본 그대로 — 브랜드 파비콘 교체는 별도 태스크
- 로고 트래킹/폰트가 디자인은 Inter, 구현은 Geist — 기존 결정(docs/4·9)과 동일하게 시각 동등 판단

## 7. 사후 검증 결과 (추록)

- main(PR #9 작업 현황 + PR #10 프리즈마 훅) 병합 후 lint·build 재검증 ✓ (시맨틱 충돌 없음)
- push → Vercel 프리뷰 배포 **success(● Ready)**: https://y-os-core-pwce2lsl1-project-hosting-center.vercel.app
- PR: https://github.com/Y-ONE-soft/y-os-core/pull/11 — merge commit 방식으로 머지
- 이 요청 사이클은 **첫 세션 인수 + 동시 마무리 레이스** 사례: 원 세션(구현·검증) → 인수 세션(재검증·커밋·push·PR 생성) → 원 세션(main 병합·번호 조정·추록·머지)으로 수렴. 같은 브랜치에 두 세션이 동시에 작업하면 커밋·PR이 중복될 수 있어, **워크트리 인수 시 어느 세션이 마무리 단계를 소유하는지 사용자가 지정**하는 것을 권장
