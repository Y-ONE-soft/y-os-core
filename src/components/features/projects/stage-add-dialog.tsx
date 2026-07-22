"use client";

import { useState } from "react";

import { useSession } from "@/components/features/auth/session-context";
import { todayISO } from "@/components/features/projects/roadmap-utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  boardActions,
  type NewStageInput,
} from "@/components/features/projects/board-store";

export function StageAddDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useSession();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showDeadline, setShowDeadline] = useState(true);

  const invalidRange = Boolean(startDate && endDate && endDate < startDate);
  const canSubmit = name.trim().length > 0 && !invalidRange;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setName("");
      setStartDate("");
      setEndDate("");
      setShowDeadline(true);
    }
    onOpenChange(next);
  };

  const submit = () => {
    if (!canSubmit) return;
    // 단계는 항상 기간을 갖는다 — 비워두면 시작·종료 모두 오늘로 잡는다.
    // (작업을 단계에 편입할 때 예정일을 계산할 기준이 늘 있어야 한다)
    const today = todayISO();
    const input: NewStageInput = {
      name: name.trim(),
      startDate: startDate || today,
      endDate: endDate || today,
      showDeadline,
    };
    boardActions.addStage(projectId, input);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-[480px]"
        onKeyDown={(event) => {
          if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
            event.preventDefault();
            submit();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            단계 추가
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="stage-name" className="text-xs font-medium">
              단계명
            </Label>
            <Input
              id="stage-name"
              autoFocus
              placeholder="예: 프로젝트 정의"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="stage-start" className="text-xs font-medium">
                시작일
              </Label>
              <Input
                id="stage-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="stage-end" className="text-xs font-medium">
                종료일
              </Label>
              <Input
                id="stage-end"
                type="date"
                aria-invalid={invalidRange || undefined}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-foreground">
              공동 작업자 지정
            </p>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary text-[11px] font-medium text-primary-foreground">
                {user?.name.charAt(0)}
              </span>
              <button
                type="button"
                disabled
                aria-label="작업자 추가 (준비 중)"
                className="flex size-7 items-center justify-center rounded-full border border-dashed text-xs font-medium text-muted-foreground"
              >
                ＋
              </button>
              <span className="text-xs text-muted-foreground">작업자 추가</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-[3px]">
              <Label
                htmlFor="stage-deadline"
                className="text-[13px] font-medium"
              >
                데드라인 표시
              </Label>
              <p className="text-[11px] text-muted-foreground">
                로드맵·보드에 마감 표시
              </p>
            </div>
            <Switch
              id="stage-deadline"
              checked={showDeadline}
              onCheckedChange={setShowDeadline}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">취소</Button>
          </DialogClose>
          <Button onClick={submit} disabled={!canSubmit}>
            추가
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
