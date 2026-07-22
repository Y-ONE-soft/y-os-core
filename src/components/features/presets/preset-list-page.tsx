"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

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
import { deletePresetApi, fetchPresets } from "@/lib/api/presets";
import type { PresetSummary } from "@/types/preset";

// 단계 프리셋 관리 — 저장한 프리셋을 모아 보고 지운다.
// 프리셋 저장은 프로젝트 상세의 저장 다이얼로그가 담당하므로 여기서는 만들지 않는다.

/** ISO 일시 → 2026.07.22. 목록에서 시각까지는 필요 없다. */
function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function PresetRow({
  preset,
  onDelete,
}: {
  preset: PresetSummary;
  onDelete: (presetId: string) => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded-[8px] border px-3 py-2.5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">{preset.name}</span>
        <span className="text-xs text-muted-foreground">
          단계 {preset.stageCount}개 · 할일 {preset.taskCount}개
        </span>
      </div>
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
    </li>
  );
}

export function PresetListPage() {
  const [presets, setPresets] = useState<PresetSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      setPresets((prev) => prev?.filter((item) => item.id !== presetId) ?? null);
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
            <PresetRow key={preset.id} preset={preset} onDelete={remove} />
          ))}
        </ul>
      )}
    </div>
  );
}
