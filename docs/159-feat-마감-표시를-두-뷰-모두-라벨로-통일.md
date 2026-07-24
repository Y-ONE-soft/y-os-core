# feat: 마감 표시를 두 뷰 모두 라벨로 통일

요청 사이클 `캘린더-마감-깃발`의 단일 태스크. docs/152(타임라인 뷰 마감 깃발)의 후속이자 표기 통일.

## 배경

"프로젝트 마지막일에 마감 보이게, 단계는 데드라인 표시 설정하면 마감 보이게" 요청. 대상은 **캘린더 뷰 + 타임라인 뷰** 둘 다다.

타임라인은 docs/152에서 **깃발**로 먼저 냈고, 캘린더 뷰는 4개 세션이 동시 작업 중이라 미뤘다. 이번에 그 세션들이 정리되어 캘린더를 구현하다가, 사용자가 표기를 **깃발 → "마감" 텍스트 라벨**로 바꾸고 **두 뷰 모두 라벨로 통일**하도록 요청을 변경했다.

캘린더에는 원래 데드라인 단계에 "마감" 텍스트 배지가 있었으므로, 그 방식으로 두 뷰를 맞춘다.

## 표시 규칙 (사용자 확인)

- **프로젝트 마감** = 가장 늦은 단계 종료일. **토글 없이 항상 표시.**
- **단계 마감** = `showDeadline`(데드라인 표시)이 켜진 단계의 종료일에만.
- 표기 = **"마감" 텍스트 라벨** (작은 색 배지), 두 뷰 동일.

## 변경 내용

### 1. `deadline-flag.tsx` → `deadline-marker.tsx` (리네임 + 라벨화)

docs/152에서 만든 `DeadlineFlag`(타임 격자 위 특정 날짜에 깃발)를 **라벨 렌더로 바꾸고 `DeadlineMarker`로 리네임**했다. 배치 로직(날짜→px, 격자 밖 컷)은 그대로, 내용만 `Flag` 아이콘 → "마감" 배지.

```tsx
// 마감 = 그날이 끝나는 지점이라 칸의 오른쪽 끝에 맞춘다. 배지는 그 왼쪽(막대
// 안쪽)으로 붙여 격자 밖으로 삐져나가지 않게 한다.
const left = (index + 1) * timeline.dayWidth;
return (
  <span title={title}
    className="pointer-events-none absolute top-0 z-10 -translate-x-full rounded-[3px] px-1 py-px text-[8px] font-medium text-white"
    style={{ left, backgroundColor: color }}>
    마감
  </span>
);
```

`-translate-x-full`로 종료일 지점 **왼쪽**(막대 안쪽)에 배지를 붙여 격자 밖으로 나가지 않게 했다.

### 2. `my-work-timeline-panel.tsx` — 깃발 → 라벨

`DeadlineFlag` import·사용 2곳(프로젝트 행, 단계 행)을 `DeadlineMarker`로 교체. 조건은 그대로 — 프로젝트 행은 `marks[last]`(마지막일)에 항상, 단계 행은 `showDeadline`일 때.

### 3. `my-work-calendar.tsx` — 프로젝트 마감 라벨 추가

- **단계 마감**: 캘린더에 원래 있던 "마감" 텍스트 배지를 그대로 둔다(깃발로 바꿨다가 되돌림).
- **프로젝트 마감**: `ProjectBoxItem`의 범위 끝 조각(`!box.continuesRight`, 미배정 제외)에 단계와 같은 스타일의 "마감" 라벨을 **새로 추가**.

```tsx
{!box.continuesRight && isProject && (
  <span className="absolute bottom-0.5 right-1 rounded-[3px] px-1 py-px text-[8px] font-medium text-white"
    style={{ backgroundColor: hexToRgba(color, 0.75) }}>
    마감
  </span>
)}
```

박스 `style`(left/width)은 손대지 않아, 방치된 `calendar-gap-x` 세션(박스 좌우 간격)과 충돌면이 겹치지 않는다.

## 검증

`npm run build` 성공, `npm run lint` 경고 0, `DeadlineFlag`/`deadline-flag` 잔여 참조 0.

헤드리스 브라우저로 **두 뷰 모두** 확인. 픽스처: `showDeadline=true`인 마감 단계(07-20~07-26).

| 뷰 | 깃발(lucide-flag) | "마감" 라벨 |
|---|---|---|
| 타임라인 | **0** | 10 |
| 캘린더 | **0** | 9 |

스크린샷으로 확인.

- **타임라인** — 프로젝트 막대 끝("한영고1"·"내신 2주")과 `showDeadline` 켠 단계 막대 끝("2단계"·"3단계")에 "마감" 배지. 데드라인 안 켠 단계에는 없음.
- **캘린더** — 프로젝트 박스 끝과 데드라인 단계 종료일 조각에 "마감" 배지.

검증용 프로젝트만 삭제했다.

## 변경 파일 내역

| 파일 | 구분 | 내용 |
|---|---|---|
| `src/components/features/projects/deadline-marker.tsx` | 리네임+수정 | `DeadlineFlag`(깃발) → `DeadlineMarker`("마감" 라벨) |
| `src/components/features/my-work/my-work-timeline-panel.tsx` | 수정 | `DeadlineFlag` → `DeadlineMarker` |
| `src/components/features/my-work/my-work-calendar.tsx` | 수정 | 프로젝트 박스 끝에 "마감" 라벨 추가 (단계 배지는 기존 유지) |

## 알려진 이슈 / 주의점

### 좁은 막대에서 "마감"이 막대 이름과 붙는다

타임라인·캘린더 모두, 단계 막대가 짧으면 막대 안 라벨(단계 이름)과 "마감" 배지가 겹쳐 "2단계마감"처럼 붙어 보인다. 캘린더의 기존 단계 "마감" 배지도 원래 갖던 특성이라 새로 생긴 문제는 아니며, 두 뷰가 같은 방식이라 일관적이다. 배지를 막대 밖으로 빼면 격자를 침범해, 현재는 안쪽에 두었다.

### 프로젝트 마감 라벨은 항상, 여러 개가 붙는다

프로젝트 마감은 토글이 없어 각 프로젝트마다 붙는다. 프로젝트가 많은 달·기간에는 "마감" 배지가 여럿 보인다. 단계 마감은 `showDeadline`으로 걸러진다.

### 단계 마감이 다음 주 첫 칸으로 넘어갈 수 있다 (캘린더)

종료일이 주의 첫날이면 캘린더 소스가 그 하루를 다음 주 조각으로 나눠, "마감" 라벨이 막대 본체와 떨어져 보인다. 기존 단계 마감 배지도 동일했다. 소스의 조각 분할 규칙이라 범위 밖.

### 타임라인은 이미 깃발로 프로덕션에 나갔었다

docs/152가 깃발로 머지·배포됐고, 이 사이클이 라벨로 덮어쓴다. 최종 상태는 두 뷰 모두 라벨이다.
