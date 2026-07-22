"use client";

import { useState } from "react";
import { Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { boardActions } from "@/components/features/projects/board-store";
import { CollaboratorRequestDialog } from "@/components/features/projects/collaborator-request-dialog";
import { TEAM_MEMBERS } from "@/components/features/projects/project-detail-data";

// Figma Stage Detail Overlay(130:414)의 생성 모드.
// 상세 오버레이와 같은 레이아웃(좌: 제목·내용 / 우: 세부 사항)이되,
// 단계가 아직 없어야 성립하는 영역(산출물·연결·댓글)은 비활성으로 두고
// 우측 하단은 "즉시 저장" 안내 대신 취소/추가 액션을 놓는다.

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
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showDeadline, setShowDeadline] = useState(true);
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [collabOpen, setCollabOpen] = useState(false);

  const invalidRange = Boolean(startDate && endDate && endDate < startDate);
  const canSubmit = name.trim().length > 0 && !invalidRange;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setName("");
      setDescription("");
      setStartDate("");
      setEndDate("");
      setShowDeadline(true);
      setCollaborators([]);
      setCollabOpen(false);
    }
    onOpenChange(next);
  };

  const submit = () => {
    if (!canSubmit) return;
    // 생성 API가 받지 않는 내용·공동작업자는 extra로 넘기면
    // 스토어가 생성 완료 후 patch로 이어 저장한다 (순서 보장)
    const stageId = boardActions.addStage(
      projectId,
      {
        name: name.trim(),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        showDeadline,
      },
      { description, requestedCollaborators: collaborators },
    );
    handleOpenChange(false);
    onCreated?.(stageId);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[87dvh] w-[92vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1280px]">
        <DialogTitle className="sr-only">단계 추가</DialogTitle>
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
                disabled
                aria-label="단계 완료 (생성 후 사용)"
                className="size-[22px] rounded-[6px] border-primary"
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
                className="h-auto border-0 px-0 text-2xl font-bold tracking-tight shadow-none focus-visible:ring-0 md:text-2xl"
              />
            </div>
            <section className="flex flex-col gap-2">
              <h3 className="text-[13px] font-semibold">내용</h3>
              <textarea
                value={description}
                placeholder="작업 내용, 요구사항, 진행 메모 등을 자세히 작성하세요..."
                onChange={(event) => setDescription(event.target.value)}
                className="h-[256px] w-full resize-none rounded-[10px] border bg-background px-3.5 py-3 text-sm leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
              />
            </section>
            <section className="flex flex-col gap-2">
              <h3 className="text-[13px] font-semibold">산출물 · 0</h3>
              <div className="flex h-[57px] items-center justify-center rounded-[10px] border border-dashed bg-muted/50 text-[13px] text-muted-foreground">
                단계를 만든 뒤 파일을 첨부할 수 있습니다
              </div>
            </section>
            <section className="flex flex-col gap-1.5">
              <h3 className="text-[13px] font-semibold">연결 티켓·위키 · 0</h3>
              <p className="px-2.5 text-xs text-muted-foreground">
                단계를 만든 뒤 연결할 수 있습니다
              </p>
            </section>
            <section className="flex flex-col gap-2">
              <h3 className="text-[13px] font-semibold">댓글 · 0</h3>
              <p className="text-[13px] text-muted-foreground">
                단계를 만든 뒤 댓글을 남길 수 있습니다.
              </p>
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
              <Label htmlFor="stage-add-start" className="text-xs">
                시작일
              </Label>
              <Input
                id="stage-add-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="stage-add-end" className="text-xs">
                종료일
              </Label>
              <Input
                id="stage-add-end"
                type="date"
                aria-invalid={invalidRange || undefined}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
              {invalidRange && (
                <p className="text-[11px] text-destructive">
                  종료일은 시작일보다 빠를 수 없습니다.
                </p>
              )}
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setCollabOpen(true)}
            >
              <Users className="size-4" />
              공동 작업자 지정 요청
              {collaborators.length > 0 && ` · ${collaborators.length}`}
            </Button>
            {collaborators.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {TEAM_MEMBERS.filter((member) =>
                  collaborators.includes(member.id),
                )
                  .map((member) => member.name)
                  .join(", ")}
              </p>
            )}
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-[3px]">
                <Label
                  htmlFor="stage-add-deadline"
                  className="text-[13px] font-medium"
                >
                  데드라인 표시
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  로드맵·보드에 마감 표시
                </p>
              </div>
              <Switch
                id="stage-add-deadline"
                checked={showDeadline}
                onCheckedChange={setShowDeadline}
              />
            </div>
            <div className="border-t" />
            <div className="mt-auto flex flex-col gap-2">
              <Button onClick={submit} disabled={!canSubmit}>
                추가
              </Button>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                취소
              </Button>
            </div>
          </aside>
        </div>
        {collabOpen && (
          <CollaboratorRequestDialog
            open={collabOpen}
            onOpenChange={setCollabOpen}
            initialSelected={collaborators}
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
