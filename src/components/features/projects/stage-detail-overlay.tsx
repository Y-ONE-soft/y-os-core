"use client";

import { useEffect, useState } from "react";

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
import { AssigneeList } from "@/components/features/projects/assignee-list";
import { CollaboratorRequestDialog } from "@/components/features/projects/collaborator-request-dialog";
import { OverlayBreadcrumb } from "@/components/features/projects/overlay-breadcrumb";
import { TaskDetailOverlay } from "@/components/features/projects/task-detail-overlay";
import { useProjectStore } from "@/components/features/projects/project-store";
import { refresh as refreshWorkspace } from "@/components/features/projects/workspace-cache";
import {
  requestActions,
  usePendingRequestsFor,
} from "@/hooks/use-requests";

// 레이아웃·타이포·컬러는 할일 상세 오버레이(task-detail-overlay)와 통일한다.
// 단계에만 있는 항목(기간·데드라인 표시)과 할일에만 있는 항목(유형·난이도)만 다르다.

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
  // 작업자는 프로젝트에서 가져온다. props로 받으면 호출부 4곳을 모두 고쳐야 한다.
  const { groups } = useProjectStore();
  const projectOwner = groups
    .flatMap((group) => group.projects)
    .find((project) => project.id === projectId)?.owner;
  const { stages } = useProjectBoard(projectId);
  const stage = stages.find((candidate) => candidate.id === stageId) ?? null;
  const pendingRequests = usePendingRequestsFor({ stageId });
  const [collabOpen, setCollabOpen] = useState(false);
  const [comment, setComment] = useState("");
  // 단계에 딸린 할일 목록에서 특정 할일을 눌러 상세를 겹쳐 여는 상태
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  // 공동 작업자(collaborators)는 수락된 지정 요청에서 서버가 계산해 워크스페이스에
  // 실어 준다 — 요청 도메인과 별도 스냅샷이라, 다른 사람이 수락해도 이 화면은
  // 리로드 전엔 안 바뀐다. 단계 상세를 열 때 워크스페이스를 다시 받아 최신화한다.
  useEffect(() => {
    if (stageId !== null) void refreshWorkspace();
  }, [stageId]);

  if (!stage) return null;

  const patch = (partial: Parameters<typeof boardActions.updateStage>[2]) =>
    boardActions.updateStage(projectId, stage.id, partial);

  const comments = stage.comments ?? [];
  const collaboratorCount = stage.requestedCollaborators?.length ?? 0;
  const doneCount = stage.tasks.filter((task) => task.done).length;

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
              {/* Radix Dialog는 접근성상 DialogTitle이 필요하다 — 화면용 제목은 편집
                  가능한 입력으로 두고, 실제 타이틀은 sr-only로 유지한다. */}
              <DialogTitle className="sr-only">{stage.name}</DialogTitle>
              <Input
                // stage가 바뀌면 입력 초기값을 새로 잡는다 (비제어 — 내용 필드와 동일 방식)
                key={stage.id}
                defaultValue={stage.name}
                aria-label="단계명"
                onBlur={(event) => {
                  const value = event.target.value.trim();
                  // 빈 이름은 저장하지 않고 원래 이름으로 되돌린다
                  if (!value) {
                    event.target.value = stage.name;
                    return;
                  }
                  if (value !== stage.name) patch({ name: value });
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
                // py-0 + leading-tight로 기존 h2 높이를 그대로 맞춘다 (단계 추가 오버레이와 동일)
                className={cn(
                  "h-auto border-0 px-0 py-0 text-[30px] leading-tight font-semibold shadow-none focus-visible:ring-0 md:text-[30px]",
                  stage.done && "text-muted-foreground line-through",
                )}
              />
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
            <section className="flex shrink-0 flex-col gap-2">
              <h3 className="text-sm font-semibold">
                할일&nbsp;&nbsp;·&nbsp;&nbsp;{doneCount}/{stage.tasks.length}
              </h3>
              {stage.tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  이 단계에 할일이 없습니다.
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {stage.tasks.map((task) => (
                    <li key={task.id}>
                      <div className="flex items-center gap-2.5 rounded-[8px] border bg-background px-3 py-2 transition-colors hover:bg-accent/40">
                        <Checkbox
                          checked={task.done}
                          onCheckedChange={() =>
                            boardActions.toggleTask(projectId, stage.id, task.id)
                          }
                          aria-label={`${task.name} 완료`}
                          className="size-4 rounded-[4px] border-primary"
                        />
                        <button
                          type="button"
                          onClick={() => setDetailTaskId(task.id)}
                          className="min-w-0 flex-1 truncate text-left text-[13px] font-medium"
                        >
                          <span
                            className={cn(
                              task.done && "text-muted-foreground line-through",
                            )}
                          >
                            {task.name}
                          </span>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {/* 버튼을 눌러 입력을 여는 대신, 항상 보이는 입력에 바로 쳐서 Enter로 추가한다
                  (내 할일 백로그와 같은 방식). 추가 후 입력을 비워 연속 입력이 편하다. */}
              <div className="flex h-9 w-full items-center gap-1.5 rounded-[8px] border bg-background px-2.5 focus-within:border-primary">
                <input
                  placeholder="＋ 할일 이름 입력 후 Enter"
                  aria-label="할일 추가"
                  className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      const name = event.currentTarget.value.trim();
                      if (name) {
                        boardActions.addTask(projectId, stage.id, name);
                        event.currentTarget.value = "";
                      }
                    }
                  }}
                />
                <span aria-hidden className="text-[11px] text-muted-foreground">
                  ↵
                </span>
              </div>
            </section>
            <section className="flex shrink-0 flex-col gap-2.5">
              <h3 className="text-sm font-semibold">
                산출물&nbsp;&nbsp;·&nbsp;&nbsp;0
              </h3>
              <div className="flex w-full items-center justify-center gap-1 rounded-[10px] border border-dashed bg-muted py-5 text-sm">
                <span className="text-muted-foreground">
                  단계 산출물은 할일에 첨부합니다
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
            {/* 작업자는 세부 사항의 첫 항목 — 할일 상세와 같은 자리 */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                작업자
              </p>
              {/* 단계에는 담당 필드가 없어 상위 프로젝트의 작업자를 보여준다 */}
              <AssigneeList
                assignee={projectOwner}
                collaborators={stage.collaborators}
              />
            </div>
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
            {pendingRequests.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                응답 대기 중&nbsp;·&nbsp;
                {pendingRequests.map((item) => item.to.name).join(", ")}
              </p>
            )}
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
        {/* 할일 목록에서 연 할일 상세 — 단계 상세 위에 겹쳐 뜬다 (닫으면 단계 상세로 복귀) */}
        <TaskDetailOverlay
          taskId={detailTaskId}
          onClose={() => setDetailTaskId(null)}
        />
        {collabOpen && (
          <CollaboratorRequestDialog
            open={collabOpen}
            onOpenChange={setCollabOpen}
            // 이미 공동 작업자이거나 응답을 기다리는 사람은 다시 고를 수 없다
            alreadyRequested={[
              ...(stage.requestedCollaborators ?? []),
              ...pendingRequests.map((item) => item.to.id),
            ]}
            onSubmit={(memberIds, message) => {
              void requestActions.send({
                kind: "ASSIGN",
                toUserIds: memberIds,
                message: message || null,
                taskId: null,
                stageId: stage.id,
              });
              setCollabOpen(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
