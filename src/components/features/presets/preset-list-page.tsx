"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";

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
import { Skeleton } from "@/components/ui/skeleton";
import { deletePresetApi, fetchPreset, fetchPresets } from "@/lib/api/presets";
import type {
  PresetDetail,
  PresetStage,
  PresetSummary,
  PresetTask,
} from "@/types/preset";

// 단계 프리셋 관리 — 저장한 프리셋을 모아 보고, 구성을 펼쳐 보고, 지운다.
// 프리셋 저장은 프로젝트 상세의 저장 다이얼로그가 담당하므로 여기서는 만들지 않는다.

/** 상세는 펼칠 때만 읽고 캐시한다 */
type DetailState = "loading" | "error" | PresetDetail;

/** ISO 일시 → 2026.07.22. 목록에서 시각까지는 필요 없다. */
function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

// 프리셋은 절대 날짜가 아니라 기준일로부터의 오프셋만 담는다.
// 적용할 때 정한 시작일이 기준일이 되므로 표기도 상대값으로 보여준다.

function offsetLabel(offsetDays?: number) {
  if (offsetDays === undefined) return null;
  return offsetDays === 0 ? "기준일" : `기준일 +${offsetDays}일`;
}

function stageSchedule(stage: PresetStage) {
  const start = offsetLabel(stage.offsetDays);
  if (!start) return "일정 미정";
  // durationDays 없음 = 저장 당시 종료일이 없던 진행형 막대
  return stage.durationDays === undefined
    ? `${start} · 종료일 없음`
    : `${start} · ${stage.durationDays}일간`;
}

function taskSchedule(task: PresetTask) {
  return offsetLabel(task.offsetDays) ?? "일정 미정";
}

function PresetComposition({ detail }: { detail: PresetDetail }) {
  if (detail.stages.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">단계가 없는 프리셋입니다.</p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2.5">
        {detail.stages.map((stage, stageIndex) => (
          <li key={`${stage.name}-${stageIndex}`}>
            <div className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: stage.color }}
              />
              <span className="min-w-0 truncate text-[13px] font-medium">
                {stage.name}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {stageSchedule(stage)}
              </span>
            </div>
            {stage.tasks.length > 0 && (
              <ul className="mt-1 flex flex-col gap-0.5 pl-3">
                {stage.tasks.map((task, taskIndex) => (
                  <li
                    key={`${task.name}-${taskIndex}`}
                    className="flex items-center gap-1.5 text-xs"
                  >
                    <span className="min-w-0 truncate text-muted-foreground">
                      {task.name}
                    </span>
                    <span className="shrink-0 text-muted-foreground/70">
                      {taskSchedule(task)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        적용할 때 정하는 시작일이 기준일이 됩니다.
      </p>
    </div>
  );
}

function PresetRow({
  preset,
  onDelete,
  open,
  detail,
  onToggle,
}: {
  preset: PresetSummary;
  onDelete: (presetId: string) => void;
  open: boolean;
  detail: DetailState | undefined;
  onToggle: (presetId: string) => void;
}) {
  return (
    <li className="rounded-[8px] border">
      <div className="flex items-center gap-3 px-3 py-2.5">
        {/* 펼치기는 별도 버튼 — 행 전체를 버튼으로 만들면 삭제 버튼이 중첩된다 */}
        <button
          type="button"
          onClick={() => onToggle(preset.id)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {open ? (
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium">{preset.name}</span>
            <span className="text-xs text-muted-foreground">
              단계 {preset.stageCount}개 · 할일 {preset.taskCount}개
            </span>
          </span>
        </button>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatDate(preset.updatedAt)}
        </span>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              aria-label={`${preset.name} 프리셋 삭제`}
              className="flex size-7 shrink-0 items-center justify-center rounded-[8px] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
            >
              <Trash2 className="size-3.5" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                &lsquo;{preset.name}&rsquo; 프리셋을 삭제할까요?
              </AlertDialogTitle>
              <AlertDialogDescription>
                저장된 단계·할일 구성이 사라집니다. 이 프리셋으로 이미 만든
                프로젝트는 영향을 받지 않습니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction
                className={cn(buttonVariants({ variant: "destructive" }))}
                onClick={() => onDelete(preset.id)}
              >
                삭제
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {open && (
        <div className="border-t px-3 py-2.5">
          {detail === undefined || detail === "loading" ? (
            <Skeleton className="h-10 w-full rounded-[8px]" />
          ) : detail === "error" ? (
            <p className="text-xs text-destructive">
              구성을 불러오지 못했습니다.
            </p>
          ) : (
            <PresetComposition detail={detail} />
          )}
        </div>
      )}
    </li>
  );
}

export function PresetListPage() {
  const [presets, setPresets] = useState<PresetSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<Record<string, DetailState>>({});

  // 펼칠 때만 상세를 읽고, 한 번 읽은 것은 다시 읽지 않는다.
  // fetch는 setState 업데이터 밖에서 부른다 — 업데이터는 StrictMode에서 두 번 실행된다.
  const toggle = useCallback(
    (presetId: string) => {
      const willOpen = !openIds.has(presetId);
      setOpenIds((prev) => {
        const next = new Set(prev);
        if (next.has(presetId)) next.delete(presetId);
        else next.add(presetId);
        return next;
      });
      if (!willOpen) return;

      const cached = details[presetId];
      if (cached !== undefined && cached !== "error") return;

      setDetails((prev) => ({ ...prev, [presetId]: "loading" }));
      void fetchPreset(presetId)
        .then(({ preset }) =>
          setDetails((current) => ({ ...current, [presetId]: preset })),
        )
        .catch(() =>
          setDetails((current) => ({ ...current, [presetId]: "error" })),
        );
    },
    [openIds, details],
  );

  // 목록 재조회 — 이벤트 핸들러에서만 부른다 (effect에서 부르면 동기 setState가 섞인다)
  const load = useCallback(() => {
    setError(null);
    void fetchPresets()
      .then(({ presets }) => setPresets(presets))
      .catch(() => setError("프리셋을 불러오지 못했습니다."));
  }, []);

  // 최초 1회. effect 본문에서는 setState하지 않고 비동기 콜백에서만 갱신한다.
  useEffect(() => {
    let alive = true;
    void fetchPresets()
      .then(({ presets }) => {
        if (alive) setPresets(presets);
      })
      .catch(() => {
        if (!alive) return;
        setPresets([]);
        setError("프리셋을 불러오지 못했습니다.");
      });
    return () => {
      alive = false;
    };
  }, []);

  // 낙관적으로 지우고, 실패하면 서버 상태로 되돌린다
  const remove = useCallback(
    (presetId: string) => {
      setPresets(
        (prev) => prev?.filter((item) => item.id !== presetId) ?? null,
      );
      void deletePresetApi(presetId).catch(() => {
        setError("삭제에 실패했습니다.");
        load();
      });
    },
    [load],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 px-6 pb-6 pt-5">
      <header className="flex shrink-0 flex-col gap-1.5">
        <h1 className="text-[22px] font-semibold">프리셋</h1>
        <p className="text-[13px] text-muted-foreground">
          프로젝트 상세에서 저장한 단계 구성입니다
        </p>
      </header>

      {error && <p className="text-[13px] text-destructive">{error}</p>}

      {presets === null ? (
        <ul className="flex flex-col gap-2" aria-busy>
          {[0, 1, 2].map((row) => (
            <li key={row}>
              <Skeleton className="h-[57px] w-full rounded-[8px]" />
            </li>
          ))}
        </ul>
      ) : presets.length === 0 ? (
        <p className="flex h-9 items-center rounded-[8px] border border-dashed px-3 text-[13px] text-muted-foreground">
          저장된 프리셋이 없습니다. 프로젝트 상세에서 &lsquo;프리셋
          저장&rsquo;으로 만들어 주세요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {presets.map((preset) => (
            <PresetRow
              key={preset.id}
              preset={preset}
              onDelete={remove}
              open={openIds.has(preset.id)}
              detail={details[preset.id]}
              onToggle={toggle}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
