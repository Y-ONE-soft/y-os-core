"use client";

// 다이얼로그 열림 상태만 들고 있는 얇은 클라이언트 경계.
// 이걸 두지 않으면 my-work-page 전체가 클라이언트 컴포넌트가 된다
// (클라이언트 경계는 트리 아래쪽에 — CLAUDE.md 코드 규약).

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProjectCreateDialog } from "@/components/features/projects/project-create-dialog";

export function ProjectCreateButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        프로젝트 생성
      </Button>
      <ProjectCreateDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
