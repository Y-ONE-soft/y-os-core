"use client";

import { cn } from "@/lib/utils";
import { avatarColor } from "@/lib/avatar-color";
import { Button } from "@/components/ui/button";
import { requestActions, useRequests } from "@/hooks/use-requests";
import type { WorkRequest } from "@/types/requests";

const KIND_LABEL: Record<WorkRequest["kind"], string> = {
  ASSIGN: "할일 요청",
  HELP: "도움 요청",
};

const STATUS_LABEL: Record<WorkRequest["status"], string> = {
  PENDING: "대기 중",
  ACCEPTED: "수락됨",
  REJECTED: "거절됨",
  CANCELED: "취소됨",
};

/** ISO → MM-DD (카드가 연도를 쓰지 않는다) */
function formatDate(iso: string) {
  return iso.slice(5, 10);
}

/** 카드 한 장 — 요청 종류·방향·대상·메시지·가능한 동작 */
function RequestCard({ request }: { request: WorkRequest }) {
  const received = request.direction === "received";
  const pending = request.status === "PENDING";
  // 상대방 = 받은 요청이면 보낸 사람, 보낸 요청이면 받는 사람
  const counterpart = received ? request.from : request.to;

  return (
    <article className="flex min-w-0 flex-1 flex-col gap-2.5 rounded-[10px] border bg-card px-3.5 py-3">
      <div className="flex w-full items-center gap-1.5">
        <span
          className={cn(
            "shrink-0 rounded-[6px] px-2 py-[3px] text-[11px] font-medium",
            request.kind === "ASSIGN"
              ? "bg-primary text-primary-foreground"
              : "bg-[rgba(245,158,10,0.12)] text-[#b5780a]",
          )}
        >
          {KIND_LABEL[request.kind]}
        </span>
        <span className="shrink-0 rounded-[6px] border px-2 py-[3px] text-[11px] font-medium text-muted-foreground">
          {received ? "받은 요청" : "보낸 요청"}
        </span>
        {!pending && (
          <span className="shrink-0 rounded-[6px] border px-2 py-[3px] text-[11px] font-medium text-muted-foreground">
            {STATUS_LABEL[request.status]}
          </span>
        )}
        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
          {formatDate(request.createdAt)}
        </span>
      </div>

      {request.target && (
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 rounded-[6px] border px-2 py-[3px] text-[11px] font-medium text-muted-foreground">
            {request.target.type === "stage" ? "단계" : "할일"}
          </span>
          <span className="min-w-0 truncate text-sm font-medium">
            {request.target.name}
          </span>
          {request.target.projectName && (
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {request.target.projectName}
            </span>
          )}
        </div>
      )}

      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-white"
          style={{ backgroundColor: avatarColor(counterpart.id) }}
        >
          {counterpart.name.charAt(0)}
        </span>
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {received ? `${counterpart.name} → 나` : `나 → ${counterpart.name}`}
          {request.message ? `  ·  "${request.message}"` : ""}
        </span>
      </div>

      {pending && (
        <div className="flex items-center gap-1.5">
          {received ? (
            <>
              <Button
                size="sm"
                onClick={() =>
                  void requestActions.respond(request.id, "ACCEPTED")
                }
              >
                수락
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void requestActions.respond(request.id, "REJECTED")
                }
              >
                거절
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                void requestActions.respond(request.id, "CANCELED")
              }
            >
              요청 취소
            </Button>
          )}
        </div>
      )}
    </article>
  );
}

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
      <h2 className="text-sm font-semibold">요청 알림 · {pendingCount}</h2>
      {loading ? (
        <p className="text-xs text-muted-foreground">불러오는 중…</p>
      ) : sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          주고받은 요청이 없습니다.
        </p>
      ) : (
        <div className="flex w-full items-start gap-3 overflow-x-auto">
          {sorted.map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
        </div>
      )}
    </section>
  );
}
