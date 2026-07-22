"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { avatarColor } from "@/lib/avatar-color";
import { useUsers } from "@/hooks/use-users";
import { useSession } from "@/components/features/auth/session-context";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function CollaboratorRequestDialog({
  open,
  onOpenChange,
  alreadyRequested,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 이미 공동 작업자이거나 응답 대기 중인 사용자 id — 중복 요청을 막는다 */
  alreadyRequested: string[];
  onSubmit: (memberIds: string[], message: string) => void;
}) {
  const { user } = useSession();
  const { users, loading } = useUsers();
  // 새로 고르는 사람만 담는다 — 기존 대상은 체크된 상태가 아니라 '요청됨' 표기로 보여준다
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState("");
  const requested = new Set(alreadyRequested);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // 자기 자신에게 요청할 수는 없다
  const members = users.filter((candidate) => candidate.id !== user?.id);
  const selectedMembers = members.filter((member) => selected.has(member.id));
  const summary =
    selectedMembers.length === 0
      ? "요청할 작업자를 선택하세요"
      : selectedMembers.length === 1
        ? `${selectedMembers[0].name} 선택됨`
        : `${selectedMembers[0].name} 외 ${selectedMembers.length - 1}명 선택됨`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-semibold">
            공동 작업자 지정 요청
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-foreground">작업자 선택</p>
            <div className="flex h-9 items-center rounded-[8px] border px-3 text-sm text-muted-foreground">
              {summary}
            </div>
          </div>
          <ul className="flex flex-col">
            {loading ? (
              <li className="px-1.5 py-2 text-[13px] text-muted-foreground">
                작업자 목록을 불러오는 중…
              </li>
            ) : members.length === 0 ? (
              <li className="px-1.5 py-2 text-[13px] text-muted-foreground">
                요청할 수 있는 다른 작업자가 없습니다.
              </li>
            ) : (
              members.map((member) => {
                const done = requested.has(member.id);
                return (
                  <li key={member.id}>
                    <label
                      className={cn(
                        "flex h-10 items-center gap-2.5 rounded-[8px] px-1.5 transition-colors",
                        done
                          ? "cursor-default opacity-60"
                          : "cursor-pointer hover:bg-accent/60",
                      )}
                    >
                      <Checkbox
                        checked={done || selected.has(member.id)}
                        disabled={done}
                        onCheckedChange={() => toggle(member.id)}
                        aria-label={`${member.name} 선택`}
                        className="rounded-[4px] border-primary"
                      />
                      <span
                        aria-hidden
                        className="flex size-6 items-center justify-center rounded-full text-[10px] font-medium text-white"
                        style={{ backgroundColor: avatarColor(member.id) }}
                      >
                        {member.name.charAt(0)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                        {member.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {done
                          ? "요청됨"
                          : (member.title ??
                            (member.role === "MASTER" ? "마스터" : "스탭"))}
                      </span>
                    </label>
                  </li>
                );
              })
            )}
          </ul>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-foreground">메시지</p>
            <textarea
              placeholder="요청 사유 입력 (선택)"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="h-16 w-full resize-none rounded-[8px] border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">취소</Button>
          </DialogClose>
          <Button
            disabled={selected.size === 0}
            onClick={() => onSubmit([...selected], message.trim())}
          >
            요청 보내기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
