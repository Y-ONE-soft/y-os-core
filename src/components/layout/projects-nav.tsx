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
  SlidersHorizontal,
  SquareCheck,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useSession } from "@/components/features/auth/session-context";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useShell } from "@/components/layout/shell-context";
import {
  PROJECT_COLORS,
  useProjectStore,
} from "@/components/features/projects/project-store";

type WorkspaceItem = { label: string; href: string; icon: LucideIcon };

const WORKSPACE_ITEMS: WorkspaceItem[] = [
  { label: "작업 현황", href: "/projects", icon: ListTodo },
  { label: "내 작업", href: "/projects/my-tasks", icon: SquareCheck },
  { label: "작업 분석", href: "/projects/analytics", icon: ChartColumn },
];

// 스탭 셸(Y.OS Shell — Projects · Staff, 79:48)에만 노출되는 항목.
// 마스터 디자인(84:11)에도 프리셋이 있지만 "마스터는 현행 유지" 지시로 스탭만 반영.
const STAFF_WORKSPACE_ITEMS: WorkspaceItem[] = [
  ...WORKSPACE_ITEMS,
  { label: "프리셋", href: "/projects/presets", icon: SlidersHorizontal },
];

type AddingState =
  | { type: "project"; groupId: string }
  | { type: "group" }
  | null;

function InlineAddInput({
  placeholder,
  indented,
  color,
  onColorChange,
  onCommit,
  onCancel,
}: {
  placeholder: string;
  indented: boolean;
  /** 지정하면 이름 입력 아래에 색 팔레트를 노출한다 (프로젝트 추가용) */
  color?: string;
  onColorChange?: (color: string) => void;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-1.5 py-0.5 pr-3",
        indented ? "pl-[34px]" : "pl-2",
      )}
    >
      <div className="flex h-8 min-w-0 items-center gap-1.5 rounded-[8px] border-[1.5px] border-primary bg-background px-2.5">
        {color && (
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
        )}
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
      {color && onColorChange && (
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="프로젝트 색">
          {PROJECT_COLORS.map((option) => (
            <button
              key={option}
              type="button"
              aria-label={`색 ${option}`}
              aria-pressed={option === color}
              // 스와치를 눌러도 이름 입력의 blur(취소)가 걸리지 않게 한다
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onColorChange(option)}
              className={cn(
                "size-4 rounded-full transition-transform",
                option === color
                  ? "ring-2 ring-foreground ring-offset-1 ring-offset-background"
                  : "hover:scale-110",
              )}
              style={{ backgroundColor: option }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ProjectsNav() {
  const pathname = usePathname();
  const { sidebarCollapsed: collapsed } = useShell();
  const {
    groups,
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
  // 프로젝트 추가 중 고른 색 — 추가 행을 열 때 팔레트 순번으로 초기화한다
  const [newColor, setNewColor] = useState<string>(PROJECT_COLORS[0]);

  const { user } = useSession();
  const isMaster = user?.role === "MASTER";

  const totalProjects = groups.reduce(
    (sum, group) => sum + group.projects.length,
    0,
  );
  /** 추가 행을 열 때: 색은 팔레트 순번을 기본값으로 제시하고 사용자가 바꿀 수 있게 한다 */
  const openProjectAdd = (groupId: string) => {
    setNewColor(PROJECT_COLORS[totalProjects % PROJECT_COLORS.length]);
    setAdding({ type: "project", groupId });
  };

  // 스탭: 자기가 작업자인 프로젝트만 플랫 리스트로.
  const staffProjects = groups.flatMap((group) =>
    group.projects
      .filter((project) => !!user && project.ownerId === user.id)
      .map((project) => ({ project, groupId: group.id })),
  );
  // 생성 시 소속 그룹은 서버가 세션 기준으로 강제한다. 여기서 넘기는 값은
  // 낙관적 업데이트로 새 프로젝트를 어느 그룹에 끼울지 정하는 용도.
  const staffGroupId = user?.groupId ?? undefined;

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
            {(isMaster ? WORKSPACE_ITEMS : STAFF_WORKSPACE_ITEMS).map((item) => {
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
              {!isMaster &&
                staffProjects.map(({ project, groupId }) => {
                  const href = `/projects/${project.id}`;
                  const selected = pathname === href;
                  return (
                    <li key={project.id}>
                      {/* 스탭 목록은 자기가 작업자인 프로젝트만 담기므로(staffProjects)
                          여기 걸리는 행은 모두 삭제 권한이 있다. 서버도 ownerId로 재검증. */}
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <Link
                            href={href}
                            aria-current={selected ? "page" : undefined}
                            className={cn(
                              "flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2 transition-colors",
                              selected ? "bg-muted" : "hover:bg-accent/60",
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
                          </Link>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-44">
                          <ContextMenuItem
                            variant="destructive"
                            onSelect={() => deleteProject(groupId, project.id)}
                          >
                            프로젝트 삭제
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    </li>
                  );
                })}
              {!isMaster && staffGroupId && (
                <li>
                  {adding?.type === "project" ? (
                    <InlineAddInput
                      placeholder="새 프로젝트"
                      indented={false}
                      color={newColor}
                      onColorChange={setNewColor}
                      onCommit={(name) => {
                        addProject(staffGroupId, name, newColor);
                        setAdding(null);
                      }}
                      onCancel={() => setAdding(null)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => openProjectAdd(staffGroupId)}
                      className="flex h-[30px] w-full items-center rounded-[8px] px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                    >
                      +&nbsp;&nbsp;프로젝트 추가
                    </button>
                  )}
                </li>
              )}
              {isMaster &&
                groups.map((group) => {
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
                          const href = `/projects/${project.id}`;
                          const selected = pathname === href;
                          const projectRow = (
                            <Link
                              href={href}
                              aria-current={selected ? "page" : undefined}
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
                            </Link>
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
                                color={newColor}
                                onColorChange={setNewColor}
                                onCommit={(name) => {
                                  addProject(group.id, name, newColor);
                                  setAdding(null);
                                }}
                                onCancel={() => setAdding(null)}
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => openProjectAdd(group.id)}
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
          {/* 초기화는 되돌릴 수 없다 — 시드 정리 이후 프로젝트·단계·작업이
              복원되지 않으므로 확인 단계를 둔다 (docs/46) */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="flex h-8 w-full items-center gap-2 rounded-[8px] px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
              >
                <RotateCcw className="size-3.5 shrink-0" />
                데이터 초기화
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>데이터를 초기화할까요?</AlertDialogTitle>
                <AlertDialogDescription>
                  모든 프로젝트·단계·작업이 삭제되고 그룹만 남습니다. 삭제된
                  데이터는 복구할 수 없습니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction
                  className={cn(buttonVariants({ variant: "destructive" }))}
                  onClick={resetData}
                >
                  초기화
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </footer>
      )}
    </>
  );
}
