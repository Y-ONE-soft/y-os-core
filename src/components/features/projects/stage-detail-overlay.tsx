"use client";

import { useState } from "react";
import { Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSession } from "@/components/features/auth/session-context";
import {
  boardActions,
  useProjectBoard,
} from "@/components/features/projects/board-store";
import { CollaboratorRequestDialog } from "@/components/features/projects/collaborator-request-dialog";

function DescriptionEditor({
  initial,
  onSave,
}: {
  initial: string;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <textarea
      value={value}
      placeholder="작업 내용, 요구사항, 진행 메모 등을 자세히 작성하세요..."
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => {
        if (value !== initial) onSave(value);
      }}
      className="h-[256px] w-full resize-none rounded-[10px] border bg-background px-3.5 py-3 text-sm leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
    />
  );
}

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

  const patch = (
    partial: Parameters<typeof boardActions.updateStage>[2],
  ) => boardActions.updateStage(projectId, stage.id, partial);

  const comments = stage.comments ?? [];

  const submitComment = () => {
    const text = comment.trim();
    if (!text) return;
    boardActions.addComment(
      projectId,
      stage.id,
      user?.name ?? "알 수 없음",
      text,
    );
    setComment("");
  };

  return (
    <Dialog open={stageId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[87dvh] w-[92vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1280px]">
        <header className="flex h-[68px] shrink-0 items-center gap-3 border-b px-7">
          <span className="rounded-[6px] bg-muted px-2.5 py-1 text-xs font-medium">
            단계
          </span>
          <p className="text-[13px] text-muted-foreground">
            {projectName} · 로드맵
          </p>
        </header>
        <div className="flex min-h-0 flex-1 items-stretch">
          <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto px-10 py-8">
            <div className="flex items-center gap-3.5">
              <Checkbox
                checked={stage.done ?? false}
                onCheckedChange={(checked) => patch({ done: checked === true })}
                aria-label="단계 완료"
                className="size-[22px] rounded-[6px] border-primary"
              />
              <DialogTitle
                className={cn(
                  "text-2xl font-bold tracking-tight",
                  stage.done && "text-muted-foreground line-through",
                )}
              >
                {stage.name}
              </DialogTitle>
            </div>
            <section className="flex flex-col gap-2">
              <h3 className="text-[13px] font-semibold">내용</h3>
              <DescriptionEditor
                key={stage.id}
                initial={stage.description ?? ""}
                onSave={(value) => patch({ description: value })}
              />
            </section>
            <section className="flex flex-col gap-2">
              <h3 className="text-[13px] font-semibold">산출물 · 0</h3>
              <div className="flex h-[57px] items-center justify-center rounded-[10px] border border-dashed bg-muted/50 text-[13px] text-muted-foreground">
                파일을 끌어다 놓거나&nbsp;
                <span className="font-medium text-foreground">찾아보기</span>
              </div>
            </section>
            <section className="flex flex-col gap-1.5">
              <h3 className="text-[13px] font-semibold">연결 티켓·위키 · 0</h3>
              <button
                type="button"
                className="flex h-8 w-full items-center rounded-[8px] px-2.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
              >
                ＋ 티켓 번호·제목 또는 위키 문서 검색해 연결
              </button>
            </section>
            <section className="flex flex-col gap-2">
              <h3 className="text-[13px] font-semibold">
                댓글 · {comments.length}
              </h3>
              {comments.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  아직 댓글이 없습니다. 첫 댓글을 남겨보세요.
                </p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {comments.map((item) => (
                    <li key={item.id} className="flex items-start gap-2.5">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                        {item.author.charAt(0)}
                      </span>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <p className="text-xs">
                          <span className="font-semibold">{item.author}</span>
                          <span className="ml-1.5 text-muted-foreground">
                            {formatRelative(item.at)}
                          </span>
                        </p>
                        <p className="text-[13px] leading-relaxed">
                          {item.text}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-center gap-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                  {user?.name.charAt(0)}
                </span>
                <Input
                  value={comment}
                  placeholder="댓글 남기기..."
                  onChange={(event) => setComment(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") submitComment();
                  }}
                  className="flex-1"
                />
                <Button onClick={submitComment} disabled={!comment.trim()}>
                  등록
                </Button>
              </div>
            </section>
          </div>
          <aside className="flex w-[330px] shrink-0 flex-col gap-5 overflow-y-auto border-l px-7 py-8">
            <h3 className="text-[13px] font-semibold">세부 사항</h3>
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                프로젝트
              </p>
              <p className="flex items-center gap-2 text-[13px] font-medium">
                <span
                  aria-hidden
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: projectColor }}
                />
                {projectName}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="stage-detail-start" className="text-xs">
                시작일
              </Label>
              <Input
                id="stage-detail-start"
                type="date"
                value={stage.startDate ?? ""}
                onChange={(event) =>
                  patch({ startDate: event.target.value || undefined })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="stage-detail-end" className="text-xs">
                종료일
              </Label>
              <Input
                id="stage-detail-end"
                type="date"
                value={stage.endDate ?? ""}
                onChange={(event) =>
                  patch({ endDate: event.target.value || undefined })
                }
              />
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setCollabOpen(true)}
            >
              <Users className="size-4" />
              공동 작업자 지정 요청
              {(stage.requestedCollaborators?.length ?? 0) > 0 &&
                ` · ${stage.requestedCollaborators!.length}`}
            </Button>
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-[3px]">
                <Label
                  htmlFor="stage-detail-deadline"
                  className="text-[13px] font-medium"
                >
                  데드라인 표시
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  로드맵·보드에 마감 표시
                </p>
              </div>
              <Switch
                id="stage-detail-deadline"
                checked={stage.showDeadline}
                onCheckedChange={(checked) => patch({ showDeadline: checked })}
              />
            </div>
            <div className="border-t" />
            <div className="mt-auto flex flex-col gap-1 text-[11px] text-muted-foreground">
              <p>변경사항은 즉시 저장됩니다</p>
              <p>
                생성 {stage.createdAt ? stage.createdAt.slice(0, 10) : "—"} ·
                수정 {formatRelative(stage.updatedAt)}
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
