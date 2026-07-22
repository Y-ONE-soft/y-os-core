"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/components/features/auth/session-context";
import {
  boardActions,
  useProjectBoard,
} from "@/components/features/projects/board-store";
import { CollaboratorRequestDialog } from "@/components/features/projects/collaborator-request-dialog";
import { OverlayBreadcrumb } from "@/components/features/projects/overlay-breadcrumb";

// 레이아웃·타이포·컬러는 작업 상세 오버레이(task-detail-overlay)와 통일한다.
// 단계에만 있는 항목(기간·데드라인 표시)과 작업에만 있는 항목(유형·난이도)만 다르다.

function formatRelative(iso?: string) {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return iso.slice(0, 10);
}

export function StageDetailOverlay({
  projectId,
  projectName,
  projectColor,
  stageId,
  onOpenChange,
}: {
  projectId: string;
  projectName: string;
  projectColor: string;
  stageId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useSession();
  const { stages } = useProjectBoard(projectId);
  const stage = stages.find((candidate) => candidate.id === stageId) ?? null;
  const [collabOpen, setCollabOpen] = useState(false);
  const [comment, setComment] = useState("");

  if (!stage) return null;

  const patch = (partial: Parameters<typeof boardActions.updateStage>[2]) =>
    boardActions.updateStage(projectId, stage.id, partial);

  const comments = stage.comments ?? [];
  const collaboratorCount = stage.requestedCollaborators?.length ?? 0;

  const submitComment = () => {
    const text = comment.trim();
    if (!text) return;
    boardActions.addComment(projectId, stage.id, user?.name ?? "알 수 없음", text);
    setComment("");
  };

  return (
    <Dialog open={stageId !== null} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(780px,calc(100vh-48px))] w-[min(1280px,calc(100vw-48px))] flex-col gap-0 overflow-hidden rounded-[16px] p-0 sm:max-w-none"
      >
        <header className="flex shrink-0 items-center justify-between border-b py-3.5 pl-7 pr-5">
          <div className="flex items-center gap-3">
            <span className="rounded-[6px] border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              단계
            </span>
            <OverlayBreadcrumb items={[projectName, stage.name]} />
          </div>
          <div className="flex items-center gap-2">
            <DialogClose
              aria-label="닫기"
              className="flex size-9 items-center justify-center rounded-[8px] text-base text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              ✕
            </DialogClose>
          </div>
        </header>
        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto px-10 py-8">
            <div className="flex shrink-0 items-center gap-3.5">
              <Checkbox
                aria-label={`${stage.name} 완료`}
                checked={stage.done ?? false}
                onCheckedChange={(checked) => patch({ done: checked === true })}
                className="size-[22px] rounded-[6px] border-primary [&_svg]:size-4"
              />
              <DialogTitle
                className={cn(
                  "text-[30px] leading-tight font-semibold",
                  stage.done && "text-muted-foreground line-through",
                )}
              >
                {stage.name}
              </DialogTitle>
            </div>
            <section className="flex shrink-0 flex-col gap-2.5">
              <h3 className="text-sm font-semibold">내용</h3>
              <Textarea
                key={stage.id}
                defaultValue={stage.description ?? ""}
                onBlur={(event) => {
                  if (event.target.value !== (stage.description ?? "")) {
                    patch({ description: event.target.value });
                  }
                }}
                placeholder="작업 내용, 요구사항, 진행 메모 등을 자세히 작성하세요…"
                className="min-h-[160px] rounded-[8px] px-3 py-3"
              />
            </section>
            <section className="flex shrink-0 flex-col gap-2.5">
              <h3 className="text-sm font-semibold">
                산출물&nbsp;&nbsp;·&nbsp;&nbsp;0
              </h3>
              <div className="flex w-full items-center justify-center gap-1 rounded-[10px] border border-dashed bg-muted py-5 text-sm">
                <span className="text-muted-foreground">
                  단계 산출물은 작업에 첨부합니다
                </span>
              </div>
            </section>
            <section className="flex shrink-0 flex-col gap-1.5">
              <h3 className="text-sm font-semibold">
                연결 티켓·위키&nbsp;&nbsp;·&nbsp;&nbsp;0
              </h3>
              <button
                type="button"
                className="flex w-full items-center rounded-[8px] px-2.5 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
              >
                ＋&nbsp;&nbsp;티켓 번호·제목 또는 위키 문서 검색해 연결
              </button>
            </section>
            <section className="flex shrink-0 flex-col gap-3 pb-2">
              <h3 className="text-sm font-semibold">
                댓글&nbsp;&nbsp;·&nbsp;&nbsp;{comments.length}
              </h3>
              {comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  아직 댓글이 없습니다. 첫 댓글을 남겨보세요.
                </p>
              ) : (
                comments.map((item) => (
                  <div key={item.id} className="flex items-start gap-2.5">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                      {item.author.charAt(0)}
                    </span>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-xs font-medium">
                        {item.author}
                        <span className="ml-1.5 font-normal text-muted-foreground">
                          {formatRelative(item.at)}
                        </span>
                      </span>
                      <p className="text-sm break-words">{item.text}</p>
                    </div>
                  </div>
                ))
              )}
              <div className="flex items-center gap-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                  {user?.name.charAt(0)}
                </span>
                <Input
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") submitComment();
                  }}
                  placeholder="댓글 남기기…"
                  className="h-9 rounded-[8px] px-3"
                />
                <Button
                  size="lg"
                  onClick={submitComment}
                  className="rounded-[8px]"
                >
                  등록
                </Button>
              </div>
            </section>
          </div>
          <div aria-hidden className="w-px shrink-0 bg-border" />
          <aside className="flex w-[330px] shrink-0 flex-col gap-5 overflow-y-auto bg-muted px-7 py-8">
            <h3 className="text-sm font-semibold">세부 사항</h3>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                프로젝트
              </p>
              <div className="flex h-9 items-center gap-2 rounded-[8px] border bg-background px-3 text-[13px]">
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: projectColor }}
                />
                <span className="min-w-0 truncate">{projectName}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="stage-detail-start"
                className="text-xs font-medium text-muted-foreground"
              >
                시작일
              </label>
              <Input
                id="stage-detail-start"
                type="date"
                value={stage.startDate ?? ""}
                onChange={(event) =>
                  patch({ startDate: event.target.value || undefined })
                }
                className="h-9 rounded-[8px] bg-background"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="stage-detail-end"
                className="text-xs font-medium text-muted-foreground"
              >
                종료일
              </label>
              <Input
                id="stage-detail-end"
                type="date"
                value={stage.endDate ?? ""}
                onChange={(event) =>
                  patch({ endDate: event.target.value || undefined })
                }
                className="h-9 rounded-[8px] bg-background"
              />
            </div>
            <button
              type="button"
              aria-pressed={stage.showDeadline}
              onClick={() => patch({ showDeadline: !stage.showDeadline })}
              className={cn(
                "flex w-full items-start gap-2.5 rounded-[8px] border p-3 text-left transition-colors",
                stage.showDeadline
                  ? "border-primary bg-primary/5"
                  : "bg-background hover:bg-accent/40",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-px flex size-4 shrink-0 items-center justify-center rounded-[4px] border text-[10px] leading-none",
                  stage.showDeadline
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background",
                )}
              >
                {stage.showDeadline ? "✓" : ""}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[13px] font-medium">데드라인 표시</span>
                <span className="text-[11px] leading-snug text-muted-foreground">
                  캘린더에 이 단계의 마감일 라벨을 붙입니다
                </span>
              </span>
            </button>
            <div aria-hidden className="h-px w-full bg-border" />
            <Button
              variant="outline"
              className="w-full rounded-[8px] bg-background"
              onClick={() => setCollabOpen(true)}
            >
              👥 공동 작업자 지정 요청
              {collaboratorCount > 0 && ` · ${collaboratorCount}`}
            </Button>
            <div className="flex-1" />
            <Button
              variant="destructive"
              className="w-full rounded-[8px]"
              onClick={() => {
                boardActions.deleteStage(projectId, stage.id);
                onOpenChange(false);
              }}
            >
              단계 삭제
            </Button>
            <div className="text-[11px] leading-[1.6] text-muted-foreground">
              <p>변경사항은 즉시 저장됩니다</p>
              <p>
                생성 {stage.createdAt ? stage.createdAt.slice(0, 10) : "—"}
                &nbsp;&nbsp;·&nbsp;&nbsp;수정 {formatRelative(stage.updatedAt)}
              </p>
            </div>
          </aside>
        </div>
        {collabOpen && (
          <CollaboratorRequestDialog
            open={collabOpen}
            onOpenChange={setCollabOpen}
            initialSelected={stage.requestedCollaborators ?? []}
            onSubmit={(memberIds) => {
              patch({ requestedCollaborators: memberIds });
              setCollabOpen(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
