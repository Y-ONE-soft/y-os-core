# feat: 캘린더에서 미뤄진 할일 강조

## 작업 요약

마감일을 넘겨 오늘로 자동 이월된 미완료 할일을 **캘린더에서 붉은 링·틴트로 강조**한다. `MyWorkCalendar`는 `내 할일`과 `작업 현황 캘린더 뷰`가 공유하므로 한 곳 수정으로 두 화면에 반영된다.

이월된 할일은 예정일이 오늘로 밀려 오늘 칸에 다른 할일과 섞여 뜨는데, 강조가 없으면 "원래 오늘 하려던 것"과 "밀려온 것"이 구분되지 않는다. 이 강조가 그 구분을 준다.

## 왜 캘린더만인가

할일이 개별 항목으로 그려지는 곳은 캘린더 칩뿐이다.

- **로드맵**(`workload-roadmap`)은 할일을 개별로 그리지 않고 단계의 완료 개수만 집계한다(`allTasks.filter(done)`). 개별 지연을 표시할 자리가 없어 대상이 아니다.
- **담당자 뷰**는 이미 자체 `overdue` 판정(`!done && scheduledDate < today`)으로 "지연 N건"을 표시한다. 다만 이제 `scheduledDate`가 오늘로 이월되면서 이 판정이 항상 거짓이 되는 **회귀**가 생긴다 — 다음 커밋(마감일 기준으로 전환)에서 고친다.

## 변경 파일 내역

`late` 플래그를 소스 → 레이아웃 타입 → 렌더로 흘려보낸다.

### `src/components/features/my-work/my-work-calendar-layout.ts`

`CalOverlay`의 `task` 분기에 `late?: boolean` 추가. `PlacedOverlay = CalOverlay & { lane }`이 스프레드로 파생되므로 자동 전파된다.

### `src/components/features/my-work/my-work-calendar-source.ts`

`taskChip`에서 `late`를 계산한다.

```ts
late: Boolean(!task.done && task.deadline && task.scheduledDate > task.deadline)
```

예정일 문자열이 마감일보다 크면 지났다는 뜻(`YYYY-MM-DD`는 사전순 = 날짜순). 완료된 할일은 강조하지 않으므로 `!task.done`을 함께 건다 — `late`는 미완료일 때만 참이 되어, 렌더의 완료 배경과 겹치지 않는다.

### `src/components/features/my-work/my-work-calendar.tsx`

지연 칩 컨테이너에 강조를 준다.

```tsx
overlay.late && "bg-destructive/10 ring-1 ring-inset ring-destructive/60"
```

- `bg-destructive/10` — 옅은 붉은 배경. `late`는 미완료일 때만이라 완료 배경(`hexToRgba(text, 0.1)`)과 동시에 걸리지 않는다.
- `ring-inset ring-destructive/60` — 안쪽 붉은 링. 칩이 작아(20px) 텍스트를 밀지 않도록 `inset`.
- `title`에 "마감일이 지났습니다" 안내를 달아 호버로도 확인된다.

## 검증

dev 서버(`localhost:3025`)에서 지연 할일(예정일 7일 전 → 오늘로 이월)과 정상 할일(예정일 오늘)을 나란히 만들어 `내 할일` 캘린더에서 확인했다. **5건 전부 통과.**

| 항목 | 결과 |
| --- | --- |
| 지연 칩에 링(box-shadow inset) 있음 | ✅ |
| 정상 칩엔 링 없음 | ✅ (`none`) |
| 지연 칩 배경이 정상 칩과 다름(붉은 틴트) | ✅ |
| 지연 칩 `title`에 "마감일이 지났습니다" | ✅ |
| **완료 체크 시 지연 링 사라짐** | ✅ (`late`는 `!done`) |

화면 캡처로 오늘(2026-07-23) 칸의 `지연할일` 칩이 붉은 테두리+옅은 배경, 바로 아래 `정상할일`은 일반으로 뜨는 것을 눈으로 확인했다. 검증 데이터는 삭제 후 잔여 0건.

- `npm run lint` 통과 (경고 0)
- `npx tsc --noEmit` 통과
- `npm run build` 통과

## 알려진 이슈 / 후속

- **담당자 뷰의 `overdue` 판정 회귀는 다음 커밋에서 고친다.** 자동 이월로 `scheduledDate`가 오늘이 되면서 `scheduledDate < today` 판정이 항상 거짓이 된다. `deadline < today`로 전환하는 것이 다음 태스크다.
- docs 번호는 병렬 머지로 밀렸다. 이 브랜치의 문서들은 push 직전 한 번에 재조정한다.
