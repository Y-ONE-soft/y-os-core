# feat: 내 할일 요청 알림에 대기 중 요청만 표시

## 작업 요약

내 할일 화면의 **"요청 알림" 띠를 대기 중(PENDING) 받은 요청만 보여주도록** 바꾼다. 수락·거절·취소로 의사결정이 끝난 요청은 알림 띠에서 사라진다. 어떤 방식으로든 처리하면 알림에서 즉시 빠진다.

- 적용 범위는 **내 할일 화면의 요청 알림 띠(`MyWorkRequests`)에만** 한정한다.
- **알림 페이지(`전체 보기`, `/notifications`)는 변경 없음** — 수락됨·거절됨·취소됨 이력을 포함해 전체를 그대로 보여준다. 처리 이력 확인은 전체 보기가 담당한다.

## 배경 / 동작 흐름

- 요청 카드의 수락/거절/취소 버튼은 `requestActions.respond(id, status)` → `refresh()`로 이어져, 모듈 스토어의 해당 요청 status가 `ACCEPTED`/`REJECTED`/`CANCELED`로 갱신된다.
- `MyWorkRequests`는 이 스토어를 구독하므로, 받은 요청 필터를 `status === "PENDING"`으로 좁히면 처리 직후 리렌더에서 카드가 빠진다. 별도 API·스키마 변경이 필요 없다.
- 대기 중만 남으므로 기존의 "PENDING을 앞으로 미는 정렬"이 무의미해져 제거했다. `pendingCount`는 이제 목록 길이와 같다.

## 변경 파일

### `src/components/features/my-work/my-work-requests.tsx`

받은 요청 목록을 대기 중만 남기도록 필터를 좁히고, 무의미해진 사후 정렬을 제거했다. 렌더에서 쓰던 `sorted`를 `pending`으로 정리하고, 빈 상태 문구를 "대기 중인 요청이 없습니다."로 맞췄다.

```diff
-  // 이 띠는 "나한테 온 것"만 보여준다 — 내가 보낸 요청은 여기서 할 일이 없다.
-  // 보낸 요청 확인·취소는 전체 보기(알림 페이지)가 담당한다.
-  const received = requests.filter((item) => item.direction === "received");
-  // 대기 중인 요청이 먼저 — 처리가 끝난 건 뒤로 밀어둔다
-  const sorted = [...received].sort(
-    (a, b) =>
-      (a.status === "PENDING" ? 0 : 1) - (b.status === "PENDING" ? 0 : 1),
-  );
-  const pendingCount = received.filter(
-    (item) => item.status === "PENDING",
-  ).length;
+  // 이 띠는 "나한테 온, 아직 처리 안 한 요청"만 보여준다.
+  //  - 내가 보낸 요청은 여기서 할 일이 없다 (전체 보기가 담당).
+  //  - 수락·거절·취소로 의사결정이 끝난 요청은 알림 띠에서 사라진다.
+  //    처리 이력(수락됨·거절됨·취소됨)은 전체 보기(알림 페이지)가 담당한다.
+  const pending = requests.filter(
+    (item) => item.direction === "received" && item.status === "PENDING",
+  );
+  const pendingCount = pending.length;
```

```diff
-      ) : sorted.length === 0 ? (
-        <p className="text-xs text-muted-foreground">받은 요청이 없습니다.</p>
+      ) : pending.length === 0 ? (
+        <p className="text-xs text-muted-foreground">대기 중인 요청이 없습니다.</p>
       ) : (
         <div className="flex w-full items-start gap-3">
           {KIND_COLUMNS.map(({ kind, label }) => {
-            const items = sorted.filter((item) => item.kind === kind);
+            const items = pending.filter((item) => item.kind === kind);
```

## 검증

- `npx tsc --noEmit` 통과
- `npx eslint`(대상 파일) 통과
- `npm run build` 성공

## 이력

- 최초엔 요청 문구("수락한 건")에 맞춰 ACCEPTED만 숨기려 했으나, 후속 지시("거절·취소도 의사결정을 한 거니까 없애줘")로 **처리 완료된 모든 요청(수락·거절·취소)을 숨기고 대기 중만 남기는** 것으로 확정했다.
