# feat: 할일 상세에 마감일과 미뤄진 일수 표시

## 작업 요약

태스크 1에서 만든 마감일(`deadline`) 데이터를 **할일 상세 오버레이**에 노출했다. 예정일 아래에 "마감 {날짜}"를 두고, 미완료인 채 마감을 넘긴 할일에는 **"N일 미뤄짐"** 배지를 붙인다.

## 변경 파일 내역

### `src/components/features/projects/task-detail-overlay.tsx`

**미뤄진 일수 계산** — 컴포넌트 본문에서 한 번.

```ts
const daysLate =
  task.deadline && task.scheduledDate
    ? Math.max(0, dayOffset(task.scheduledDate, task.deadline))
    : 0;
```

자동 이월로 `scheduledDate`가 오늘까지 밀렸어도 `deadline`은 고정이라, 둘의 차이(`dayOffset`)가 미뤄진 날수다. 마감 전(음수)은 `0`으로 눌러 감춘다. `dayOffset`은 로드맵과 같은 유틸을 재사용한다.

**표시** — 예정일 입력 아래.

```tsx
{task.deadline && (
  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
    <span>마감 {task.deadline}</span>
    {!task.done && daysLate > 0 && (
      <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive">
        {daysLate}일 미뤄짐
      </span>
    )}
  </p>
)}
```

- **마감일**은 값이 있으면 항상 보인다. 일정을 잡은 적 없는 할일(백로그)은 `deadline`이 없어 이 줄이 아예 안 뜬다.
- **"N일 미뤄짐" 배지**는 미완료(`!task.done`)이면서 지연(`daysLate > 0`)일 때만. 완료하면 더는 안 밀리므로 배지를 감추고 마감일만 남긴다 — 사용자 요청("완료하면 마감일로 고정되서 뜨는거")대로다.
- 배지 색은 주의를 뜻하는 `destructive` 토큰의 옅은 배경(`bg-destructive/10 text-destructive`). 디자인 규약의 칩 형태(`rounded-full px-2 py-0.5 text-[11px] font-medium`)를 따랐다.

완료날짜는 그 아래 기존 "완료날짜" 필드가 그대로 보여준다(완료 체크 시 서버가 기록).

## 검증

dev 서버(`localhost:3025`)에서 미완료·지난 할일(예정일 7일 전)을 만들어 프로젝트 상세에서 상세 오버레이를 열었다. **5건 전부 통과.**

| 항목 | 결과 |
| --- | --- |
| 상세에 "마감 2026-07-16" 표시 | ✅ |
| 예정일은 오늘(2026-07-23)로 이월되어 표시 | ✅ (스크린샷 확인) |
| "7일 미뤄짐" 배지 표시 | ✅ |
| **완료 체크 시 "미뤄짐" 배지 사라짐** | ✅ |
| 완료해도 마감일은 계속 표시 | ✅ |
| 완료날짜가 오늘로 기록되어 표시 | ✅ |

화면 캡처로 예정일 `2026-07-23` 아래 "마감 2026-07-16 · **7일 미뤄짐**"(붉은 배지)이 함께 뜨는 것을 눈으로 확인했다. 검증 데이터는 삭제 후 잔여 0건.

- `npm run lint` 통과 (경고 0)
- `npx tsc --noEmit` 통과
- `npm run build` 통과

## 알려진 이슈 / 후속

- 마감일은 **읽기 전용 표시**다. 마감일을 직접 편집하는 UI는 없다 — 예정일을 다시 잡으면 서버가 마감일을 재설정하는(재계획) 모델이라, 별도 마감일 편집기는 이 요청 범위 밖이다.
- 캘린더·로드맵에서 미뤄진 할일을 시각적으로 구분하는 것은 태스크 3이다.
- docs 번호는 작성 시점 기준 126. 병렬 머지로 조정될 수 있다.
