"use client";

import Link from "next/link";

import { useRequests } from "@/hooks/use-requests";
import { RequestCard } from "@/components/features/requests/request-card";

export function MyWorkRequests() {
  const { requests, loading } = useRequests();
  // 대기 중인 요청이 먼저 — 처리가 끝난 건 뒤로 밀어둔다
  const sorted = [...requests].sort(
    (a, b) =>
      (a.status === "PENDING" ? 0 : 1) - (b.status === "PENDING" ? 0 : 1),
  );
  const pendingCount = requests.filter(
    (item) => item.status === "PENDING",
  ).length;

  return (
    <section className="flex w-full shrink-0 flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">요청 알림 · {pendingCount}</h2>
        {/* 이 띠는 가로로 훑어보는 용도라 건수가 늘면 좁다.
            전체 목록·방향 필터는 알림 페이지가 담당한다. */}
        <Link
          href="/notifications"
          className="text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          전체 보기
        </Link>
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">불러오는 중…</p>
      ) : sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          주고받은 요청이 없습니다.
        </p>
      ) : (
        <div className="flex w-full items-start gap-3 overflow-x-auto">
          {sorted.map((request) => (
            <RequestCard key={request.id} request={request} className="flex-1" />
          ))}
        </div>
      )}
    </section>
  );
}
