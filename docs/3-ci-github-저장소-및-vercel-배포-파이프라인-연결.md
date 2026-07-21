# 3. GitHub 저장소 및 Vercel 배포 파이프라인 연결

- **예정 커밋 메시지**: `ci: GitHub 저장소 및 Vercel 배포 파이프라인 연결`
- **작업일**: 2026-07-22

---

## 1. 작업 내용 요약

1. 기본 브랜치 `master` → `main` 변경 (GitHub/Vercel 표준 기본값)
2. GitHub **비공개** 저장소 생성 (사용자 선택: private)
3. Vercel 프로젝트 생성 + GitHub 저장소 자동 연결 (Git 통합 방식)
4. `git push` → 프로덕션 배포 자동 트리거 → 빌드 성공(● Ready) → 프로덕션 URL 200 응답까지 **엔드투엔드 검증 완료**
5. **[재작업 1]** 저장소를 개인 계정(`jimmy1004kim`)이 아닌 **`Y-ONE-soft` 조직**에 둬야 한다는 피드백 반영 — 저장소를 조직으로 **이전(transfer)**하고 (히스토리·설정 유지, 삭제/재생성보다 안전), 로컬 remote와 Vercel Git 연결을 조직 저장소로 갱신
6. **[재작업 2]** Vercel 프로젝트를 `midacosmetics-4044s-projects` 팀에서 **`project-hosting-center` 팀으로 이동** (사용자 선택) — 신규 프로젝트라 설정이 없어 기존 프로젝트 삭제 후 새 스코프로 재생성
7. **[재작업 2 후속]** `project-hosting-center`는 **Hobby(무료) 플랜**이라 조직 소유 비공개 저장소 연결 불가(Pro 필요, 409 에러) → 선택지(Pro 업그레이드 / Pro인 midacosmetics 팀 유지 / 저장소 공개 전환) 중 사용자 선택으로 **저장소를 public으로 전환**하고 연결 완료

실행한 명령:

```bash
git branch -m master main
gh repo create y-os-core --private --source=. --remote=origin
vercel link --yes          # 프로젝트 생성 + GitHub 저장소 연결까지 자동 처리
git push -u origin main    # → 프로덕션 배포 자동 트리거 확인

# [재작업 1] 조직으로 이전
gh api repos/jimmy1004kim/y-os-core/transfer -f new_owner=Y-ONE-soft
git remote set-url origin https://github.com/Y-ONE-soft/y-os-core.git
vercel git disconnect --yes && vercel git connect --yes   # 조직 저장소로 재연결

# [재작업 2] Vercel 팀 이동 + 저장소 공개 전환
vercel project rm y-os-core                                # 기존 팀에서 삭제
vercel link --yes --scope project-hosting-center           # 새 팀으로 재생성
gh repo edit Y-ONE-soft/y-os-core --visibility public --accept-visibility-change-consequences
vercel git connect --yes                                   # 연결 성공
```

## 2. 완성된 파이프라인

```
git push origin main        → Vercel 프로덕션 배포 (자동)
PR / 다른 브랜치 push        → Vercel 프리뷰 배포 (자동, PR에 프리뷰 URL 코멘트)
```

| 항목 | 값 |
|---|---|
| GitHub 저장소 | https://github.com/Y-ONE-soft/y-os-core (**public**, `Y-ONE-soft` 조직) |
| Vercel 프로젝트 | `project-hosting-center/y-os-core` |
| 프로덕션 URL | 이 커밋의 푸시가 새 프로젝트의 첫 배포 — 배포 후 URL 확정 (기존 `y-os-core.vercel.app`은 이전 프로젝트 삭제로 반납됨) |
| 빌드 설정 | Vercel이 Next.js 자동 감지 — `next build`, 기본 출력 디렉토리 (제로 컨피그, `vercel.json` 불필요) |

## 3. 왜 이 방식인가

- **Vercel Git 통합**은 Next.js 배포의 표준 파이프라인이다. GitHub Actions 등 별도 CI 구성 없이 push만으로 프로덕션/프리뷰 배포가 자동화되고, Vercel이 Next.js 제작사라 프레임워크 기능(정적 프리렌더링, 이미지 최적화 등)이 설정 없이 최적으로 동작한다 — "가볍고 빠른 서비스, 검증된 기본값" 원칙에 부합.
- **저장소 공개 여부**: 처음에는 회사 프로젝트라 private으로 생성했으나, Vercel `project-hosting-center` 팀이 Hobby 플랜이라 조직 비공개 저장소를 연결할 수 없어(Pro 필요) **사용자 결정으로 public 전환**. 비공개가 다시 필요해지면 팀 Pro 업그레이드 후 `gh repo edit --visibility private`로 되돌리면 된다.
- **`main` 브랜치**: GitHub/Vercel의 현행 표준 기본 브랜치명. Vercel 프로덕션 브랜치도 `main`으로 자동 인식됨.

## 4. 변경 파일 내역

| 구분 | 파일 | 내용 |
|---|---|---|
| 수정 | `.gitignore` | Vercel CLI가 `.vercel`, `.env*` 항목 자동 추가 (기존 항목과 중복이지만 CLI 생성분 유지) |
| 신규 | `docs/3-ci-github-저장소-및-vercel-배포-파이프라인-연결.md` | 이 작업 결과 문서 |

### 커밋에 포함되지 않는 로컬 생성물 (gitignore 대상)

- `.vercel/` — Vercel 프로젝트 링크 정보 (CLI가 생성)
- `.env.local` — `VERCEL_OIDC_TOKEN` (CLI가 생성, 커밋 금지)

## 5. 알아둘 사항

- **배포 고유 URL·프리뷰 URL은 Vercel SSO 보호가 기본 적용**(302 → vercel.com/sso-api)되어 팀 멤버만 접근 가능하다. **프로덕션 별칭은 공개**다. Vercel 기본 보호 정책(Standard Protection)의 정상 동작이다.
- 저장소가 public이므로 **비밀값(.env 등)은 절대 커밋 금지** — `.gitignore`에 `.env*`가 등록되어 있다.
- 커스텀 도메인 연결은 Vercel 대시보드 → Project → Domains에서 추가하면 된다.

## 6. 사후 검증 결과 (추록)

이 문서는 커밋에 포함되어야 해서 푸시 전에 작성됐는데, 그 푸시 자체가 새 프로젝트의 첫 배포 트리거였다. 푸시 이후 확정된 검증 결과를 추록으로 기록한다.

- 커밋 `5efd51b` 푸시 → `project-hosting-center/y-os-core` 첫 프로덕션 배포 **자동 트리거 확인** (파이프라인 엔드투엔드 동작 검증 완료)
- 배포 상태: **● Ready** (2026-07-22 05:05 KST)
- **프로덕션 URL 확정: https://y-os-core.vercel.app** — HTTP 200 확인. 이전 프로젝트 삭제로 반납됐던 별칭을 새 프로젝트가 예상대로 재획득함
- 보조 별칭: `y-os-core-project-hosting-center.vercel.app`, `y-os-core-git-main-project-hosting-center.vercel.app`
- 운영 참고: 이 프로젝트 디렉토리 밖 컨텍스트나 URL 단독 조회 시 `vercel inspect`가 CLI 기본 팀(`midacosmetics-4044s-projects`) 컨텍스트로 조회해 "deployment not found" 에러가 난다. **`--scope project-hosting-center`를 명시**해야 한다.
