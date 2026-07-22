"use client";

import { useRef, useState } from "react";
import { ChevronDown, Ellipsis } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/components/features/auth/session-context";
import { useProjectStore } from "@/components/features/projects/project-store";
import {
  boardActions,
  useBoardState,
  useUnassignedTasks,
} from "@/components/features/projects/board-store";
import { clampStageToTasks } from "@/components/features/projects/roadmap-utils";
import type { BoardStage, BoardTask } from "@/types/workspace";
import { avatarColor } from "@/lib/avatar-color";
import { useUsers } from "@/hooks/use-users";
import { requestActions } from "@/hooks/use-requests";
import { OverlayBreadcrumb } from "@/components/features/projects/overlay-breadcrumb";

// Select에서 null(백로그·미배정)을 가리키는 센티널 — Radix Select는 빈 문자열 값을 허용하지 않는다
const BACKLOG_VALUE = "__backlog__";
const UNASSIGNED_VALUE = "__unassigned__";
const NO_ASSIGNEE_VALUE = "__no_assignee__";

// 자리표시 상수 — 키 체계·유형·난이도는 DB 도메인 태스크에서 실데이터로 교체
const TASK_TYPES = ["문서", "개발", "디자인", "기획", "기타"];
const DIFFICULTIES = ["—", "쉬움", "보통", "어려움"];

type Artifact = { id: string; name: string; meta: string; icon: string };
type LinkedItem = {
  id: string;
  chip: string;
  title: string;
  badge?: string;
};
type Comment = { id: string; initial: string; author: string; text: string };
type RequestKind = "collab" | "help" | null;

/** 파일 확장자별 아이콘 (디자인의 이모지 표기 관례) */
function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["xlsx", "xls", "csv"].includes(ext)) return "📊";
  if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext)) return "🖼️";
  if (["doc", "docx", "pdf", "txt", "md", "hwp"].includes(ext)) return "📄";
  return "📁";
}

export function TaskDetailOverlay({
  taskId,
  onClose,
}: {
  taskId: string | null;
  onClose: () => void;
}) {
  const { user } = useSession();
  const { users, loading: usersLoading } = useUsers();
  const { groups } = useProjectStore();
  const boards = useBoardState();
  const unassigned = useUnassignedTasks();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [taskType, setTaskType] = useState(TASK_TYPES[0]);
  const [difficulty, setDifficulty] = useState(DIFFICULTIES[0]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [links, setLinks] = useState<LinkedItem[]>([]);
  const [addingLink, setAddingLink] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [request, setRequest] = useState<RequestKind>(null);
  const [requestMembers, setRequestMembers] = useState<Set<string>>(new Set());
  const [requestMessage, setRequestMessage] = useState("");

  const projects = groups.flatMap((group) => group.projects);
  // 할일이 놓인 위치(프로젝트·단계)를 스토어에서 직접 찾는다. 단계에 편성된 할일,
  // 백로그 할일(stageId = null), 미배정 할일(projectId = null)을 모두 지원하며,
  // 오버레이 안에서 소속을 바꿔도 새 위치를 따라가므로 열린 상태가 유지된다.
  const unassignedTask = taskId
    ? unassigned.find((entry) => entry.id === taskId)
    : undefined;
  const located = unassignedTask
    ? { projectId: null, stage: null, task: unassignedTask }
    : taskId
      ? projects.reduce<{
          projectId: string | null;
          stage: BoardStage | null;
          task: BoardTask;
        } | null>((found, candidate) => {
          if (found) return found;
          const board = boards[candidate.id];
          if (!board) return null;
          const stage = board.stages.find((item) =>
            item.tasks.some((entry) => entry.id === taskId),
          );
          const task = stage
            ? stage.tasks.find((entry) => entry.id === taskId)
            : board.backlog.find((entry) => entry.id === taskId);
          return task
            ? { projectId: candidate.id, stage: stage ?? null, task }
            : null;
        }, null)
      : null;

  if (!located) return null;

  const { projectId, stage, task } = located;
  const project = projects.find((candidate) => candidate.id === projectId);
  const stages = projectId === null ? [] : (boards[projectId]?.stages ?? []);
  const stageId = stage?.id ?? null;
  // 미배정 할일은 단계 개념이 없으므로 "미배정"으로 표기한다
  const stageLabel = project ? (stage?.name ?? "백로그") : "미배정";
  const projectLabel = project?.name ?? "프로젝트 없음";


  /**
   * 예정일 변경 — 캘린더 드래그와 같은 규칙을 따른다.
   * 단계 밖 날짜를 고르면 단계가 그 날짜까지 늘어나 할일을 덮는다.
   */
  const setSchedule = (value: string) => {
    const scheduledDate = value || undefined;
    boardActions.updateTask(projectId, stageId, task.id, { scheduledDate });
    if (!stage?.startDate || !scheduledDate) return;
    const stretched = clampStageToTasks(
      { startDate: stage.startDate, endDate: stage.endDate },
      { min: scheduledDate, max: scheduledDate },
    );
    if (
      stretched.startDate !== stage.startDate ||
      stretched.endDate !== stage.endDate
    ) {
      boardActions.updateStage(projectId!, stage.id, stretched);
    }
  };

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const added: Artifact[] = [...files].map((file) => {
      const ext = file.name.split(".").pop()?.toUpperCase() ?? "파일";
      const size =
        file.size >= 1024 * 1024
          ? `${(file.size / 1024 / 1024).toFixed(1)}MB`
          : `${Math.max(1, Math.round(file.size / 1024))}KB`;
      return {
        id: `af-${crypto.randomUUID()}`,
        name: file.name,
        meta: `${ext} · ${size} · 방금 전`,
        icon: fileIcon(file.name),
      };
    });
    setArtifacts((prev) => [...prev, ...added]);
  };

  const addLink = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    const ticket = value.match(/^([A-Za-z]+-\d+)\s*(.*)$/);
    setLinks((prev) => [
      ...prev,
      ticket
        ? {
            id: `ln-${crypto.randomUUID()}`,
            chip: ticket[1].toUpperCase(),
            title: ticket[2] || "연결된 티켓",
            badge: "진행 중",
          }
        : { id: `ln-${crypto.randomUUID()}`, chip: "위키", title: value },
    ]);
  };

  const submitComment = () => {
    const text = commentDraft.trim();
    if (!text) return;
    setComments((prev) => [
      ...prev,
      {
        id: `cm-${crypto.randomUUID()}`,
        initial: user?.name.charAt(0) ?? "?",
        author: user?.name ?? "사용자",
        text,
      },
    ]);
    setCommentDraft("");
  };

  const requestTitle =
    request === "collab" ? "공동 작업자 지정 요청" : "도움 요청하기";
  // 자기 자신에게 요청할 수는 없다
  const requestCandidates = users.filter(
    (candidate) => candidate.id !== user?.id,
  );
  const selectedNames = requestCandidates
    .filter((member) => requestMembers.has(member.id))
    .map((member) => member.name);
  const requestSummary =
    selectedNames.length === 0
      ? "작업자 선택"
      : selectedNames.length === 1
        ? `${selectedNames[0]} 선택됨`
        : `${selectedNames[0]} 외 ${selectedNames.length - 1}명 선택됨`;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(780px,calc(100vh-48px))] w-[min(1280px,calc(100vw-48px))] flex-col gap-0 overflow-hidden rounded-[16px] p-0 sm:max-w-none"
      >
        <header className="flex shrink-0 items-center justify-between border-b py-3.5 pl-7 pr-5">
          <div className="flex items-center gap-3">
            <span className="rounded-[6px] border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              할일
            </span>
            <OverlayBreadcrumb items={[projectLabel, stageLabel, task.name]} />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-[8px]">
              🐞 이슈 등록
            </Button>
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
                aria-label={`${task.name} 완료`}
                checked={task.done}
                onCheckedChange={() =>
                  boardActions.toggleTask(projectId, stageId, task.id)
                }
                className="size-[22px] rounded-[6px] border-primary [&_svg]:size-4"
              />
              <DialogTitle
                className={cn(
                  "text-[30px] leading-tight font-semibold",
                  task.done && "text-muted-foreground line-through",
                )}
              >
                {task.name}
              </DialogTitle>
            </div>
            <section className="flex shrink-0 flex-col gap-2.5">
              <h3 className="text-sm font-semibold">내용</h3>
              <Textarea
                key={task.id}
                defaultValue={task.description ?? ""}
                onBlur={(event) =>
                  boardActions.updateTask(projectId, stageId, task.id, {
                    description: event.target.value,
                  })
                }
                placeholder="작업 내용, 요구사항, 진행 메모 등을 자세히 작성하세요…"
                className="min-h-[160px] rounded-[8px] px-3 py-3"
              />
            </section>
            <section className="flex shrink-0 flex-col gap-2.5">
              <h3 className="text-sm font-semibold">
                산출물&nbsp;&nbsp;·&nbsp;&nbsp;{artifacts.length}
              </h3>
              {artifacts.map((artifact) => (
                <div
                  key={artifact.id}
                  className="flex w-full items-center gap-2.5 rounded-[8px] border bg-background px-3 py-2"
                >
                  <span aria-hidden className="text-sm">
                    {artifact.icon}
                  </span>
                  <span className="min-w-0 truncate text-[13px] font-medium">
                    {artifact.name}
                  </span>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {artifact.meta}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={`${artifact.name} 메뉴`}
                      className="ml-auto text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Ellipsis className="size-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-32">
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() =>
                          setArtifacts((prev) =>
                            prev.filter((item) => item.id !== artifact.id),
                          )
                        }
                      >
                        삭제
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  addFiles(event.dataTransfer.files);
                }}
                className="flex w-full items-center justify-center gap-1 rounded-[10px] border border-dashed bg-muted py-5 text-sm transition-colors hover:border-muted-foreground/40"
              >
                <span className="text-muted-foreground">
                  파일을 끌어다 놓거나
                </span>
                <span className="font-medium text-primary">찾아보기</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                aria-label="산출물 파일 선택"
                onChange={(event) => {
                  addFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </section>
            <section className="flex shrink-0 flex-col gap-1.5">
              <h3 className="text-sm font-semibold">
                연결 티켓·위키&nbsp;&nbsp;·&nbsp;&nbsp;{links.length}
              </h3>
              {links.map((link) => (
                <div
                  key={link.id}
                  className="flex w-full items-center gap-2.5 rounded-[8px] border bg-background px-3 py-2"
                >
                  <span className="rounded-[6px] border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {link.chip}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                    {link.title}
                  </span>
                  {link.badge && (
                    <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                      {link.badge}
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={`${link.title} 연결 해제`}
                    onClick={() =>
                      setLinks((prev) =>
                        prev.filter((item) => item.id !== link.id),
                      )
                    }
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Ellipsis className="size-3.5" />
                  </button>
                </div>
              ))}
              {addingLink ? (
                <div className="flex h-9 w-full items-center gap-1.5 rounded-[8px] border-[1.5px] border-primary bg-background px-2.5">
                  <input
                    autoFocus
                    placeholder="티켓 번호·제목 또는 위키 문서 검색해 연결"
                    aria-label="티켓·위키 연결"
                    className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        addLink(event.currentTarget.value);
                        setAddingLink(false);
                      }
                      if (event.key === "Escape") setAddingLink(false);
                    }}
                    onBlur={() => setAddingLink(false)}
                  />
                  <span aria-hidden className="text-[11px] text-muted-foreground">
                    ↵
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingLink(true)}
                  className="flex w-full items-center rounded-[8px] px-2.5 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                >
                  ＋&nbsp;&nbsp;티켓 번호·제목 또는 위키 문서 검색해 연결
                </button>
              )}
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
                comments.map((comment) => (
                  <div key={comment.id} className="flex items-start gap-2.5">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                      {comment.initial}
                    </span>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-xs font-medium">
                        {comment.author}
                        <span className="ml-1.5 font-normal text-muted-foreground">
                          방금 전
                        </span>
                      </span>
                      <p className="text-sm break-words">{comment.text}</p>
                    </div>
                  </div>
                ))
              )}
              <div className="flex items-center gap-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                  {user?.name.charAt(0)}
                </span>
                <Input
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
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
              <Select
                value={projectId ?? UNASSIGNED_VALUE}
                onValueChange={(next) =>
                  boardActions.assignTask(
                    projectId,
                    task.id,
                    next === UNASSIGNED_VALUE ? null : next,
                    null,
                  )
                }
              >
                <SelectTrigger className="h-9 w-full rounded-[8px] bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED_VALUE}>프로젝트 없음</SelectItem>
                  {projects.map((candidate) => (
                    <SelectItem key={candidate.id} value={candidate.id}>
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: candidate.color }}
                      />
                      {candidate.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">단계</p>
              <Select
                value={stageId ?? BACKLOG_VALUE}
                disabled={projectId === null}
                onValueChange={(next) =>
                  projectId !== null &&
                  boardActions.assignTask(
                    projectId,
                    task.id,
                    projectId,
                    next === BACKLOG_VALUE ? null : next,
                  )
                }
              >
                <SelectTrigger className="h-9 w-full rounded-[8px] bg-background">
                  {projectId === null ? (
                    <span className="text-muted-foreground">
                      프로젝트를 먼저 선택하세요
                    </span>
                  ) : (
                    <SelectValue />
                  )}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BACKLOG_VALUE}>백로그</SelectItem>
                  {stages.map((candidate) => (
                    <SelectItem key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                담당자
              </p>
              {/* 작업 현황의 담당자 보드가 이 값으로 컬럼을 묶는다 */}
              <Select
                value={task.assigneeId ?? NO_ASSIGNEE_VALUE}
                onValueChange={(next) =>
                  boardActions.updateTask(projectId, stageId, task.id, {
                    assigneeId: next === NO_ASSIGNEE_VALUE ? null : next,
                  })
                }
              >
                <SelectTrigger className="h-9 w-full rounded-[8px] bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ASSIGNEE_VALUE}>미배정</SelectItem>
                  {users.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      <span
                        aria-hidden
                        className="flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-medium text-background"
                        style={{ backgroundColor: avatarColor(member.id) }}
                      >
                        {member.name.slice(0, 1)}
                      </span>
                      <span className="truncate">{member.name}</span>
                      {member.title && (
                        <span className="text-xs text-muted-foreground">
                          {member.title}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {usersLoading && (
                <p className="text-[11px] text-muted-foreground">
                  직원 목록을 불러오는 중입니다.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="task-detail-scheduled"
                className="text-xs font-medium text-muted-foreground"
              >
                예정일
              </label>
              <Input
                id="task-detail-scheduled"
                type="date"
                value={task.scheduledDate ?? ""}
                disabled={stageId === null}
                title={
                  stageId === null
                    ? "단계에 편성하면 예정일이 잡힙니다"
                    : undefined
                }
                onChange={(event) => setSchedule(event.target.value)}
                className="h-9 rounded-[8px] bg-background"
              />
              {stageId === null && (
                <p className="text-[11px] text-muted-foreground">
                  단계에 편성하면 예정일이 잡힙니다
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                완료날짜
              </p>
              {/* 읽기 전용 — 위 체크박스를 켜면 서버가 오늘 날짜를 기록하고,
                  풀면 지운다. 직접 고칠 수 있으면 완료 기록의 의미가 없다 */}
              <div className="flex h-9 items-center rounded-[8px] bg-background px-3 text-sm">
                {task.completedDate ? (
                  task.completedDate
                ) : (
                  <span className="text-muted-foreground">
                    완료 체크 시 자동 기록
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                할일 유형
              </p>
              <Select value={taskType} onValueChange={setTaskType}>
                <SelectTrigger className="h-9 w-full rounded-[8px] bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                난이도
              </p>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger className="h-9 w-full rounded-[8px] bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div aria-hidden className="h-px w-full bg-border" />
            <Button
              variant="outline"
              className="w-full rounded-[8px] bg-background"
              onClick={() => {
                setRequestMembers(new Set());
                setRequestMessage("");
                setRequest("collab");
              }}
            >
              👥 공동 작업자 지정 요청
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-[8px] bg-background"
              onClick={() => {
                setRequestMembers(new Set());
                setRequestMessage("");
                setRequest("help");
              }}
            >
              🙋 도움 요청하기
            </Button>
            <div className="flex-1" />
            <Button
              variant="destructive"
              className="w-full rounded-[8px]"
              onClick={() => {
                boardActions.deleteTask(projectId, task.id);
                onClose();
              }}
            >
              할일 삭제
            </Button>
            <div className="text-[11px] leading-[1.6] text-muted-foreground">
              <p>변경사항은 즉시 저장됩니다</p>
              <p>생성 2026-07-22&nbsp;&nbsp;·&nbsp;&nbsp;수정 방금 전</p>
            </div>
          </aside>
        </div>
        <Dialog
          open={request !== null}
          onOpenChange={(open) => !open && setRequest(null)}
        >
          <DialogContent
            showCloseButton={false}
            className="w-[340px] gap-0 rounded-[12px] p-5"
          >
            <DialogTitle className="text-sm font-semibold">
              {requestTitle}
            </DialogTitle>
            <div className="flex flex-col gap-2.5 pt-4">
              <p className="text-xs font-medium text-muted-foreground">
                작업자 선택
              </p>
              <div className="flex h-9 items-center justify-between rounded-[8px] border bg-background px-3">
                <span className="text-sm text-muted-foreground">
                  {requestSummary}
                </span>
                <ChevronDown
                  aria-hidden
                  className="size-3.5 text-muted-foreground"
                />
              </div>
              <div className="flex flex-col gap-1 py-1.5">
                {requestCandidates.length === 0 ? (
                  <p className="px-1 py-1.5 text-[13px] text-muted-foreground">
                    {usersLoading
                      ? "작업자 목록을 불러오는 중…"
                      : "요청할 수 있는 다른 작업자가 없습니다."}
                  </p>
                ) : (
                  requestCandidates.map((member) => (
                    <label
                      key={member.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-[6px] px-1 py-1.5 transition-colors hover:bg-accent/60"
                    >
                      <Checkbox
                        checked={requestMembers.has(member.id)}
                        onCheckedChange={(checked) =>
                          setRequestMembers((prev) => {
                            const next = new Set(prev);
                            if (checked) next.add(member.id);
                            else next.delete(member.id);
                            return next;
                          })
                        }
                        className="rounded-[4px] border-primary"
                      />
                      <span
                        aria-hidden
                        className="flex size-5 items-center justify-center rounded-full text-[9px] font-medium text-white"
                        style={{ backgroundColor: avatarColor(member.id) }}
                      >
                        {member.name.charAt(0)}
                      </span>
                      <span className="flex-1 text-[13px] font-medium">
                        {member.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {member.title ??
                          (member.role === "MASTER" ? "마스터" : "스탭")}
                      </span>
                    </label>
                  ))
                )}
              </div>
              <p className="text-xs font-medium text-muted-foreground">
                메시지
              </p>
              <Textarea
                value={requestMessage}
                onChange={(event) => setRequestMessage(event.target.value)}
                placeholder={
                  request === "collab"
                    ? "요청 사유 입력 (선택)"
                    : "어떤 부분이 막히는지 알려주세요"
                }
                className="min-h-[72px] rounded-[8px] text-sm"
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  variant="ghost"
                  onClick={() => setRequest(null)}
                  className="rounded-[8px]"
                >
                  취소
                </Button>
                <Button
                  disabled={requestMembers.size === 0}
                  onClick={() => {
                    void requestActions.send({
                      // 공동 작업자 지정은 할일 요청(ASSIGN), 나머지는 도움 요청(HELP)
                      kind: request === "collab" ? "ASSIGN" : "HELP",
                      toUserIds: [...requestMembers],
                      message: requestMessage.trim() || null,
                      taskId: task.id,
                      stageId: null,
                    });
                    setRequest(null);
                  }}
                  className="rounded-[8px]"
                >
                  요청 보내기
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
