"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartColumn,
  ChevronDown,
  ChevronRight,
  Folder,
  ListTodo,
  RotateCcw,
  SquareCheck,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { CURRENT_USER } from "@/lib/constants";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useShell } from "@/components/layout/shell-context";
import { useProjectStore } from "@/components/features/projects/project-store";

type WorkspaceItem = { label: string; href: string; icon: LucideIcon };

const WORKSPACE_ITEMS: WorkspaceItem[] = [
  { label: "작업 현황", href: "/projects", icon: ListTodo },
  { label: "내 작업", href: "/projects/my-tasks", icon: SquareCheck },
  { label: "작업 분석", href: "/projects/analytics", icon: ChartColumn },
];

type AddingState =
  | { type: "project"; groupId: string }
  | { type: "group" }
  | null;

function InlineAddInput({
  placeholder,
  indented,
  onCommit,
  onCancel,
}: {
  placeholder: string;
  indented: boolean;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  return (
    <div
      className={cn("flex w-full py-0.5 pr-3", indented ? "pl-[34px]" : "pl-2")}
    >
      <div className="flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-[8px] border-[1.5px] border-primary bg-background px-2.5">
        <input
          autoFocus
          placeholder={placeholder}
          aria-label={placeholder}
          className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-foreground outline-none placeholder:text-muted-foreground"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              const name = event.currentTarget.value.trim();
              if (name) onCommit(name);
              else onCancel();
            }
            if (event.key === "Escape") onCancel();
          }}
          onBlur={onCancel}
        />
        <span aria-hidden className="text-[11px] text-muted-foreground">
          ↵
        </span>
      </div>
    </div>
  );
}

export function ProjectsNav() {
  const pathname = usePathname();
  const { sidebarCollapsed: collapsed } = useShell();
  const {
    groups,
    selectedProjectId,
    selectProject,
    addGroup,
    addProject,
    deleteGroup,
    deleteProject,
    resetData,
  } = useProjectStore();
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(
    new Set(),
  );
  const [adding, setAdding] = useState<AddingState>(null);

  const isMaster = CURRENT_USER.role === "master";

  const toggleGroup = (groupId: string) =>
    setCollapsedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });

  return (
    <>
      <nav
        aria-label="프로젝트 워크스페이스 메뉴"
        className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto"
      >
        <div className="flex flex-col">
          {!collapsed && (
            <p className="pb-1.5 pl-3 text-[11px] font-medium tracking-[0.04em] text-muted-foreground">
              워크스페이스
            </p>
          )}
          <ul className="flex flex-col gap-0.5">
            {WORKSPACE_ITEMS.map((item) => {
              const active =
                item.href === "/projects"
                  ? pathname === "/projects"
                  : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex h-[38px] items-center gap-2.5 rounded-[10px] px-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                      collapsed && "justify-center px-0",
                    )}
                  >
                    <item.icon className="size-4 shrink-0" />
                    {!collapsed && <span className="flex-1">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <p className="pb-1.5 pl-3 pr-2 text-[11px] font-medium tracking-[0.04em] text-muted-foreground">
              프로젝트
            </p>
            <ul className="flex flex-col gap-0.5">
              {groups.map((group) => {
                const expanded = !collapsedGroupIds.has(group.id);
                const groupRow = (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={expanded}
                    className="flex h-[34px] w-full items-center gap-2 rounded-[8px] pl-2 pr-3 transition-colors hover:bg-accent/60"
                  >
                    {expanded ? (
                      <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
                    )}
                    <Folder className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-foreground">
                      {group.name}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {group.projects.length}
                    </span>
                  </button>
                );
                return (
                  <li key={group.id}>
                    {isMaster ? (
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          {groupRow}
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-44">
                          <ContextMenuItem
                            variant="destructive"
                            onSelect={() => deleteGroup(group.id)}
                          >
                            그룹 삭제
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    ) : (
                      groupRow
                    )}
                    {expanded && (
                      <ul className="flex flex-col gap-0.5 pt-0.5">
                        {group.projects.map((project) => {
                          const selected = selectedProjectId === project.id;
                          const projectRow = (
                            <button
                              type="button"
                              onClick={() => selectProject(project.id)}
                              aria-current={selected ? "true" : undefined}
                              className={cn(
                                "flex w-full items-center gap-2.5 rounded-[8px] py-2 pl-[34px] pr-3 transition-colors",
                                selected
                                  ? "bg-muted"
                                  : "hover:bg-accent/60",
                              )}
                            >
                              <span
                                aria-hidden
                                className="size-2 shrink-0 rounded-full"
                                style={{ backgroundColor: project.color }}
                              />
                              <span className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-foreground">
                                {project.name}
                              </span>
                            </button>
                          );
                          return (
                            <li key={project.id}>
                              {isMaster ? (
                                <ContextMenu>
                                  <ContextMenuTrigger asChild>
                                    {projectRow}
                                  </ContextMenuTrigger>
                                  <ContextMenuContent className="w-44">
                                    <ContextMenuItem
                                      variant="destructive"
                                      onSelect={() =>
                                        deleteProject(group.id, project.id)
                                      }
                                    >
                                      프로젝트 삭제
                                    </ContextMenuItem>
                                  </ContextMenuContent>
                                </ContextMenu>
                              ) : (
                                projectRow
                              )}
                            </li>
                          );
                        })}
                        {isMaster && (
                          <li>
                            {adding?.type === "project" &&
                            adding.groupId === group.id ? (
                              <InlineAddInput
                                placeholder="새 프로젝트"
                                indented
                                onCommit={(name) => {
                                  addProject(group.id, name);
                                  setAdding(null);
                                }}
                                onCancel={() => setAdding(null)}
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setAdding({
                                    type: "project",
                                    groupId: group.id,
                                  })
                                }
                                className="flex h-[30px] w-full items-center rounded-[8px] pl-[34px] pr-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                              >
                                +&nbsp;&nbsp;프로젝트 추가
                              </button>
                            )}
                          </li>
                        )}
                      </ul>
                    )}
                  </li>
                );
              })}
              {isMaster && (
                <li>
                  {adding?.type === "group" ? (
                    <InlineAddInput
                      placeholder="새 그룹"
                      indented={false}
                      onCommit={(name) => {
                        addGroup(name);
                        setAdding(null);
                      }}
                      onCancel={() => setAdding(null)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAdding({ type: "group" })}
                      className="flex h-[30px] w-full items-center rounded-[8px] pl-2 pr-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                    >
                      +&nbsp;&nbsp;그룹 추가
                    </button>
                  )}
                </li>
              )}
            </ul>
          </div>
        )}
      </nav>
      {!collapsed && (
        <footer className="w-full">
          <button
            type="button"
            onClick={resetData}
            className="flex h-8 w-full items-center gap-2 rounded-[8px] px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            <RotateCcw className="size-3.5 shrink-0" />
            데이터 초기화
          </button>
        </footer>
      )}
    </>
  );
}
