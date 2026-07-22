import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { REQUESTS } from "@/components/features/my-work/my-work-data";

export function MyWorkRequests() {
  return (
    <section className="flex w-full shrink-0 flex-col gap-2.5">
      <h2 className="text-sm font-semibold">요청 알림 · {REQUESTS.length}</h2>
      <div className="flex w-full items-start gap-3">
        {REQUESTS.map((request) => (
          <article
            key={request.id}
            className="flex min-w-0 flex-1 flex-col gap-2.5 rounded-[10px] border bg-card px-3.5 py-3"
          >
            <div className="flex w-full items-center gap-1.5">
              <span
                className={cn(
                  "rounded-[6px] px-2 py-[3px] text-[11px] font-medium",
                  request.typeTone === "primary"
                    ? "bg-primary text-primary-foreground"
                    : "bg-[rgba(245,158,10,0.12)] text-[#b5780a]",
                )}
              >
                {request.typeLabel}
              </span>
              <span className="rounded-[6px] border px-2 py-[3px] text-[11px] font-medium text-muted-foreground">
                {request.direction}
              </span>
              <span className="ml-auto text-[11px] text-muted-foreground">
                {request.date}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-[6px] border px-2 py-[3px] text-[11px] font-medium text-muted-foreground">
                {request.code}
              </span>
              <span className="text-sm font-medium">{request.title}</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium"
              >
                {request.from.charAt(0)}
              </span>
              <span className="min-w-0 truncate text-xs text-muted-foreground">
                {request.message}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {request.actions.map((action) => (
                <Button
                  key={action}
                  size="sm"
                  variant={
                    action === "수락"
                      ? "default"
                      : action === "거절"
                        ? "outline"
                        : "ghost"
                  }
                >
                  {action}
                </Button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
