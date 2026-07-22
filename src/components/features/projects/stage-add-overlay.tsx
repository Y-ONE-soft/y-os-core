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
import { boardActions } from "@/components/features/projects/board-store";
import { CollaboratorRequestDialog } from "@/components/features/projects/collaborator-request-dialog";
import { OverlayBreadcrumb } from "@/components/features/projects/overlay-breadcrumb";
import { useUsers } from "@/hooks/use-users";
import { requestActions } from "@/hooks/use-requests";
import { todayISO } from "@/components/features/projects/roadmap-utils";

// 단계 상세 오버레이(stage-detail-overlay)의 생성 모드 — 셸·타이포·세부 사항 스펙을 그대로 따른다.
// 단계가 아직 없어야 성립하는 영역(산출물·연결·댓글)만 안내 문구로 두고,
// 우측 하단은 "즉시 저장" 안내·삭제 대신 취소/추가 액션을 놓는다.

export function StageAddOverlay({
  projectId,
  projectName,
  projectColor,
  open,
  onOpenChange,
  onCreated,
}: {
  projectId: string;
  projectName: string;
  projectColor: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 생성 직후 상세 오버레이로 이어가고 싶을 때 사용 */
  onCreated?: (stageId: string) => void;
}) {
  const { users } = useUsers();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  // 단계는 항상 기간을 갖는다 — 세부 사항의 시작·종료일을 오늘로 채워 두고 시작한다
  const [startDate, setStartDate] = useState(todayISO);
  const [endDate, setEndDate] = useState(todayISO);
  const [showDeadline, setShowDeadline] = useState(true);
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [collabOpen, setCollabOpen] = useState(false);

  const invalidRange = Boolean(startDate && endDate && endDate < startDate);
  const canSubmit = name.trim().length > 0 && !invalidRange;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setName("");
      setDescription("");
      // 다시 열었을 때도 오늘 기준으로 시작한다 (날짜가 바뀌었을 수 있으므로 재계산)
      setStartDate(todayISO());
      setEndDate(todayISO());
      setShowDeadline(true);
      setCollaborators([]);
      setCollabOpen(false);
    }
    onOpenChange(next);
  };

  const submit = () => {
    if (!canSubmit) return;
    // 단계는 항상 기간을 갖는다 — 비워두면 시작·종료 모두 오늘로 잡는다.
    // (할일을 단계에 편입할 때 예정일을 계산할 기준이 늘 있어야 한다)
    const today = todayISO();
    // 생성 API가 받지 않는 내용은 extra로 넘기면
    // 스토어가 생성 완료 후 patch로 이어 저장한다 (순서 보장)
    const stageId = boardActions.addStage(
      projectId,
      {
        name: name.trim(),
        startDate: startDate || today,
        endDate: endDate || today,
        showDeadline,
      },
      { description },
    );
    // 공동 작업자는 더 이상 즉시 지정하지 않는다 — 단계가 생긴 뒤 요청을 보내고
    // 상대가 수락해야 반영된다 (docs/84 요청 도메인)
    if (collaborators.length > 0) {
      void requestActions.send({
        kind: "ASSIGN",
        toUserIds: collaborators,
        message: null,
        taskId: null,
        stageId,
      });
    }
    handleOpenChange(false);
    onCreated?.(stageId);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(780px,calc(100vh-48px))] w-[min(1280px,calc(100vw-48px))] flex-col gap-0 overflow-hidden rounded-[16px] p-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">단계 추가</DialogTitle>
        <header className="flex shrink-0 items-center justify-between border-b py-3.5 pl-7 pr-5">
          <div className="flex items-center gap-3">
            <span className="rounded-[6px] border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              단계
            </span>
            {/* 상세와 같은 "프로젝트 › 단계" 규칙. 아직 이름이 없으면 자리표시로 둔다 */}
            <OverlayBreadcrumb items={[projectName, name.trim() || "새 단계"]} />
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
                disabled
                aria-label="단계 완료 (생성 후 사용)"
                className="size-[22px] rounded-[6px] border-primary [&_svg]:size-4"
              />
              <Input
                autoFocus
                value={name}
                placeholder="단계명을 입력하세요"
                aria-label="단계명"
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submit();
                }}
                // Input 기본 세로 패딩(py-1)이 남으면 제목 행이 상세보다 높아져
                // 왼쪽 컬럼 전체가 아래로 밀린다 — py-0 + leading-tight로 h2와 같은 높이를 만든다
                className="h-auto border-0 px-0 py-0 text-[30px] leading-tight font-semibold shadow-none focus-visible:ring-0 md:text-[30px]"
              />
            </div>
            <section className="flex shrink-0 flex-col gap-2.5">
              <h3 className="text-sm font-semibold">내용</h3>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
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
                  단계를 만든 뒤 할일에 첨부할 수 있습니다
                </span>
              </div>
            </section>
            <section className="flex shrink-0 flex-col gap-1.5">
              <h3 className="text-sm font-semibold">
                연결 티켓·위키&nbsp;&nbsp;·&nbsp;&nbsp;0
              </h3>
              <p className="px-2.5 py-2 text-[13px] font-medium text-muted-foreground">
                단계를 만든 뒤 연결할 수 있습니다
              </p>
            </section>
            <section className="flex shrink-0 flex-col gap-3 pb-2">
              <h3 className="text-sm font-semibold">
                댓글&nbsp;&nbsp;·&nbsp;&nbsp;0
              </h3>
              <p className="text-sm text-muted-foreground">
                단계를 만든 뒤 댓글을 남길 수 있습니다.
              </p>
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
                htmlFor="stage-add-start"
                className="text-xs font-medium text-muted-foreground"
              >
                시작일
              </label>
              <Input
                id="stage-add-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="h-9 rounded-[8px] bg-background"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="stage-add-end"
                className="text-xs font-medium text-muted-foreground"
              >
                종료일
              </label>
              <Input
                id="stage-add-end"
                type="date"
                aria-invalid={invalidRange || undefined}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="h-9 rounded-[8px] bg-background"
              />
              {invalidRange && (
                <p className="text-[11px] text-destructive">
                  종료일은 시작일보다 빠를 수 없습니다.
                </p>
              )}
            </div>
            <button
              type="button"
              aria-pressed={showDeadline}
              onClick={() => setShowDeadline((prev) => !prev)}
              className={cn(
                "flex w-full items-start gap-2.5 rounded-[8px] border p-3 text-left transition-colors",
                showDeadline
                  ? "border-primary bg-primary/5"
                  : "bg-background hover:bg-accent/40",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-px flex size-4 shrink-0 items-center justify-center rounded-[4px] border text-[10px] leading-none",
                  showDeadline
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background",
                )}
              >
                {showDeadline ? "✓" : ""}
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
              {collaborators.length > 0 && ` · ${collaborators.length}`}
            </Button>
            {collaborators.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {users
                  .filter((member) => collaborators.includes(member.id))
                  .map((member) => member.name)
                  .join(", ")}
              </p>
            )}
            <div className="flex-1" />
            <Button
              onClick={submit}
              disabled={!canSubmit}
              className="w-full rounded-[8px]"
            >
              추가
            </Button>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="w-full rounded-[8px] bg-background"
            >
              취소
            </Button>
          </aside>
        </div>
        {collabOpen && (
          <CollaboratorRequestDialog
            open={collabOpen}
            onOpenChange={setCollabOpen}
            // 생성 전이라 아직 보낸 요청이 없다 — 고른 사람은 생성 직후 일괄 발송한다
            alreadyRequested={[]}
            onSubmit={(memberIds) => {
              setCollaborators(memberIds);
              setCollabOpen(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
