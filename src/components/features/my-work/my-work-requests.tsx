"use client";

import Link from "next/link";

import { useRequests } from "@/hooks/use-requests";
import { RequestCard } from "@/components/features/requests/request-card";
import type { WorkRequest } from "@/types/requests";

// 종류마다 세로 열 하나씩 — 할일 요청과 도움 요청은 성격이 달라 섞이면 훑기 어렵다.
// 알림 페이지는 전체 목록·필터를 담당하므로 이 2열 배치는 내 할일 화면에만 둔다.
const KIND_COLUMNS: { kind: WorkRequest["kind"]; label: string }[] = [
  { kind: "ASSIGN", label: "할일 요청" },
  { kind: "HELP", label: "도움 요청" },
];

export function MyWorkRequests() {
  const { requests, loading } = useRequests();
  // 이 띠는 "나한테 온, 아직 처리 안 한 요청"만 보여준다.
  //  - 내가 보낸 요청은 여기서 할 일이 없다 (전체 보기가 담당).
  //  - 수락·거절·취소로 의사결정이 끝난 요청은 알림 띠에서 사라진다.
  //    처리 이력(수락됨·거절됨·취소됨)은 전체 보기(알림 페이지)가 담당한다.
  const pending = requests.filter(
    (item) => item.direction === "received" && item.status === "PENDING",
  );
  const pendingCount = pending.length;

  return (
    <section className="flex w-full shrink-0 flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">요청 알림 · {pendingCount}</h2>
        {/* 이 띠는 받은 요청을 가로로 훑어보는 용도다.
            보낸 요청을 포함한 전체 목록·방향 필터는 알림 페이지가 담당한다. */}
        <Link
          href="/notifications"
          className="text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          전체 보기
        </Link>
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">불러오는 중…</p>
      ) : pending.length === 0 ? (
        <p className="text-xs text-muted-foreground">대기 중인 요청이 없습니다.</p>
      ) : (
        <div className="flex w-full items-start gap-3">
          {KIND_COLUMNS.map(({ kind, label }) => {
            const items = pending.filter((item) => item.kind === kind);
            return (
              // 비어 있어도 열은 남긴다 — 한쪽이 비었다고 폭이 출렁이면 훑기 나쁘다
              <div
                key={kind}
                className="flex min-w-0 flex-1 flex-col gap-1.5"
              >
                <p className="text-xs font-medium text-muted-foreground">
                  {label} · {items.length}
                </p>
                {items.length === 0 ? (
                  <p className="rounded-[10px] border border-dashed px-3.5 py-3 text-xs text-muted-foreground">
                    받은 {label}이 없습니다.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {items.map((request) => (
                      <RequestCard key={request.id} request={request} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
