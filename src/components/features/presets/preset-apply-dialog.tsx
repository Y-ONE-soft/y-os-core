"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import { fetchPresets } from "@/lib/api/presets";
import { applyPresetToProjectApi } from "@/lib/api/workspace";
import type { PresetSummary } from "@/types/preset";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as cache from "@/components/features/projects/workspace-cache";
import { useProjectBoard } from "@/components/features/projects/board-store";
import { todayISO } from "@/components/features/projects/roadmap-utils";

/**
 * 기존 프로젝트에 프리셋을 적용한다.
 * 프리셋 선택 + 기준일만 받는다 — 프로젝트는 이미 있으므로 이름·색·그룹은 필요 없다.
 * (프로젝트 생성 다이얼로그의 프리셋 모드에서 생성 관련 입력만 덜어낸 형태)
 */
export function PresetApplyDialog({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const [presets, setPresets] = useState<PresetSummary[] | null>(null);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [baseDate, setBaseDate] = useState(todayISO);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 기존 단계가 있으면 적용이 삭제·교체가 되므로 경고를 띄운다.
  const { stages } = useProjectBoard(projectId);
  const existingStageCount = stages.length;
  const willReplace = existingStageCount > 0;

  useEffect(() => {
    let alive = true;
    fetchPresets()
      .then((res) => alive && setPresets(res.presets))
      .catch(() => alive && setPresets([]));
    return () => {
      alive = false;
    };
  }, []);

  const canSubmit = presetId !== null && baseDate !== "" && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await applyPresetToProjectApi(projectId, { presetId, baseDate });
      // 적용이 끝났으면 먼저 닫는다 — 갱신 실패로 창이 남으면 중복 적용을 부른다
      onClose();
      cache.refresh().catch(() => {
        // 갱신 실패는 적용 결과에 영향이 없다 (다음 부트스트랩에서 따라온다)
      });
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "프리셋 적용에 실패했습니다.",
      );
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-semibold">
            프리셋 사용하기
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {willReplace && (
            <p className="rounded-[8px] border border-destructive/30 bg-destructive/10 p-3 text-[12px] leading-[17px] text-destructive">
              이 프로젝트에는 이미 단계 {existingStageCount}개가 있습니다. 적용하면
              기존 단계와 할일이 모두 삭제되고 프리셋으로 교체됩니다. 되돌릴 수
              없습니다.
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>프리셋</Label>
            {presets === null ? (
              <p className="text-[13px] text-muted-foreground">불러오는 중…</p>
            ) : presets.length === 0 ? (
              <p className="rounded-[8px] border border-dashed p-3 text-[13px] text-muted-foreground">
                저장된 프리셋이 없습니다. 단계를 구성한 뒤 &lsquo;프리셋
                저장하기&rsquo;로 만들 수 있습니다.
              </p>
            ) : (
              <ul className="flex max-h-[180px] flex-col gap-1 overflow-y-auto">
                {presets.map((preset) => (
                  <li key={preset.id}>
                    <button
                      type="button"
                      onClick={() => setPresetId(preset.id)}
                      aria-pressed={preset.id === presetId}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-[8px] border px-3 py-2 text-left transition-colors",
                        preset.id === presetId
                          ? "border-primary bg-primary/10"
                          : "hover:bg-accent/60",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                        {preset.name}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        단계 {preset.stageCount}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="preset-apply-base">시작일</Label>
            <Input
              id="preset-apply-base"
              type="date"
              value={baseDate}
              onChange={(event) => setBaseDate(event.target.value)}
              className="h-9 rounded-[8px]"
            />
            <p className="text-[11px] text-muted-foreground">
              프리셋의 일정은 이 날짜를 기준으로 재현됩니다.
            </p>
          </div>

          {error && <p className="text-[12px] text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button
            variant={willReplace ? "destructive" : "default"}
            disabled={!canSubmit}
            onClick={() => void submit()}
          >
            {submitting ? "적용 중…" : willReplace ? "교체 적용" : "적용"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
