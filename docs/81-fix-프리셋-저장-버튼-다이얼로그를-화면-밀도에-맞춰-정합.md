# 81. fix: 프리셋 저장 버튼·다이얼로그를 화면 밀도에 맞춰 정합

## 작업 요약

docs/78에서 프리셋 저장 UI를 도메인 규약·디자인 시스템에 맞춰 정리했지만, 실제 화면에서 여전히 **버튼이 혼자 크고 팝업이 이 페이지의 다른 팝업과 다른 계열로 보인다**는 지적을 받았다. 스크린샷을 근거로 두 지점을 잡는다.

## 무엇이 문제였나

### 1. 버튼이 페이지에서 가장 큰 요소가 됐다

docs/78에서 Figma의 36px에 맞추려고 `size="lg"`(h-9, text-sm)를 줬는데, 이 화면의 다른 컨트롤은 전부 그보다 훨씬 촘촘하다.

| 컨트롤 | 크기 |
| --- | --- |
| `＋ 단계` | `px-2.5 py-1 text-[11.5px]` |
| 탭 (보드·할일·리포트…) | `px-3.5 py-[7px] text-[13px]` |
| 레인지 스위처 (오늘·일·주…) | `px-[9px] py-[3px] text-[11px]` |
| 프리셋 저장 (docs/78) | **h-9 · text-sm(14px)** |

**Figma 수치를 그대로 옮기는 것과 화면에 맞는 것은 다르다.** Figma 프레임(1184px 폭)에서는 36px가 적당하지만, 실제 페이지는 11~13px 스케일로 촘촘해서 혼자 튄다.

`size="sm"`(h-7, 12.8px)로 내렸다. `＋ 단계`와 탭 사이 무게가 된다.

### 2. 팝업이 이 페이지의 팝업과 다른 계열이었다

저장소에 다이얼로그 관용구가 두 가지인데 docs/78에서 다른 쪽을 골랐다.

| | 셸 | 푸터 |
| --- | --- | --- |
| 이 페이지 (`stage-add-overlay`) | 자체 셸 `rounded-[16px]`, 헤더 `border-b` | 평범한 버튼 배치, `variant="outline"` + `rounded-[8px]` |
| docs/78 (`collaborator-request-dialog` 계열) | `DialogHeader` | **`DialogFooter`** |

문제는 `DialogFooter`가 **muted 밴드**를 깔아버린다는 점이다.

```
-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 …
```

Figma 저장 다이얼로그(`161:744`)에도, 같은 화면의 단계 오버레이에도 없는 회색 띠다. 팝업 하단만 색이 달라지니 다른 계열로 읽힌다.

## 변경 내용

### `src/components/features/presets/preset-save-dialog.tsx`

- **푸터** — `DialogFooter` 제거, 평범한 `flex items-center justify-end gap-2` 행으로 교체. import에서도 뺐다
- **버튼 형식** — 취소는 `variant="outline" className="rounded-[8px] bg-background"`로 **단계 추가 오버레이의 취소 버튼과 동일**하게, 저장은 `rounded-[8px]`
- **포함 구성 행** — 테두리 박스 → `bg-muted` 채움(`rounded-[8px] px-3 py-2.5 text-[13px]`). Figma의 `_Summary`(`161:751`)가 채움 박스이고, 이 화면의 muted 칩들과도 같은 계열이다

### `src/components/features/projects/project-detail-page.tsx`

- 헤더 버튼 `size="lg"` → `size="sm"`. 왜 Figma 값을 그대로 쓰지 않았는지 주석으로 남겼다

## 검증

```bash
npx tsc --noEmit          # 통과 (출력 없음)
npm run lint              # 통과
npm run build             # 성공 — Compiled successfully
```

**미검증** — 이번에도 브라우저 시각 확인은 못 했다. 저장소에 브라우저 자동화 도구가 없다. 진단은 사용자가 준 스크린샷(버튼)과 코드 대조(팝업)에 근거했고, 팝업 쪽은 실물을 보지 못한 채 `DialogFooter`의 muted 밴드를 원인으로 지목한 것이다. 프리뷰에서 확인이 필요하다.

## 배운 것

docs/78에서 "임의 px를 없애고 시스템 스케일을 쓰자"까지는 맞았지만, **어떤 스케일 값을 고를지는 화면 밀도를 보고 정해야 한다.** Figma의 절대 px를 시스템 스케일로 기계적으로 환산(36px → `lg`)한 것이 이번 문제의 원인이었다.

마찬가지로 "집 컴포넌트를 쓰자"도 맞지만, 저장소에 관용구가 둘 이상이면 **그 화면이 쓰는 쪽**을 골라야 한다.

## 병렬 작업 메모

착수 시점 main = `4e5cbcb`.

**docs/78이 main에 두 건 있다** — 이번 `78-refactor-프리셋-저장-UI…`와 다른 세션의 `78-refactor-사용자-노출-문구의-작업-단위를-할일로-변경`. 규칙상 나중에 머지된 쪽이 조정해야 하는데, 프리셋 쪽(PR #71)이 먼저 머지되고 작업-단위 쪽(PR #70)이 뒤에 머지됐으므로 조정 주체는 그쪽이다. 남의 문서를 임의로 바꾸지 않고 그대로 뒀다. 문서 번호는 현재 최대인 80 다음인 81로 잡았다.
