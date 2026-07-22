"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjectBoard } from "@/components/features/projects/board-store";
import { createPresetApi, fetchPresets, overwritePresetApi } from "@/lib/api/presets";
import type { PresetSummary } from "@/types/preset";

// Figma Project Detail Layout — Preset Save · New(161:511) / Overwrite(161:1573).
// 구성 스냅샷은 서버가 projectId로 읽어 만든다 — 여기서는 대상만 정한다.

type Mode = "new" | "overwrite";

const MODES: { value: Mode; label: string }[] = [
  { value: "new", label: "새로 만들기" },
  { value: "overwrite", label: "기존에 덮어쓰기" },
];

/**
 * 열려 있는 동안만 마운트되는 것을 전제로 한다 — 부모가 조건부로 렌더한다.
 * 닫을 때 통째로 사라지므로 이전 입력이 남아 잘못된 대상에 덮어쓸 여지가 없다.
 */
export function PresetSaveDialog({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const { stages } = useProjectBoard(projectId);
  const [mode, setMode] = useState<Mode>("new");
  const [name, setName] = useState("");
  const [targetId, setTargetId] = useState("");
  const [presets, setPresets] = useState<PresetSummary[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stageCount = stages.length;
  const taskCount = stages.reduce((sum, stage) => sum + stage.tasks.length, 0);

  // 덮어쓰기 대상 목록 — 마운트 시 한 번만 읽는다
  useEffect(() => {
    void fetchPresets()
      .then(({ presets }) => setPresets(presets))
      .catch(() => setPresets([]));
  }, []);

  const canSave =
    !saving && (mode === "new" ? name.trim().length > 0 : targetId !== "");

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      if (mode === "new") {
        await createPresetApi({ name: name.trim(), projectId });
      } else {
        await overwritePresetApi(targetId, projectId);
      }
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "저장에 실패했습니다.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="w-[480px] max-w-[calc(100vw-32px)] gap-4 rounded-[10px] px-6 py-5">
        <div className="flex flex-col gap-1">
          <DialogTitle className="text-base font-semibold">
            단계 프리셋 저장
          </DialogTitle>
          <p className="text-[12.5px] text-muted-foreground">
            현재 단계와 할 일 구성이 그대로 저장됩니다.
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-[6px] bg-muted px-3 py-2.5">
          <span className="text-[11.5px] font-medium text-muted-foreground">
            포함 구성
          </span>
          <span className="text-[12.5px] font-medium">
            단계 {stageCount}개 · 할 일 {taskCount}개
          </span>
        </div>

        <div className="flex items-center gap-0.5 rounded-[8px] bg-muted p-[3px]">
          {MODES.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={mode === item.value}
              onClick={() => {
                setMode(item.value);
                setError(null);
              }}
              className={cn(
                "flex-1 rounded-[6px] py-1.5 text-[12.5px] font-medium transition-colors",
                mode === item.value
                  ? "bg-background text-foreground shadow-[0px_1px_2px_0px_rgba(0,0,0,0.08)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {mode === "new" ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="preset-name" className="text-xs font-medium">
              프리셋 이름
            </Label>
            <Input
              id="preset-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="예: 표준 개발 프로세스"
              autoFocus
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Label className="text-xs font-medium">대상 프리셋</Label>
            {presets.length === 0 ? (
              <p className="rounded-[8px] border border-dashed px-3 py-2.5 text-[12.5px] text-muted-foreground">
                저장된 프리셋이 없습니다. 먼저 새로 만들어 주세요.
              </p>
            ) : (
              <>
                <Select value={targetId} onValueChange={setTargetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="덮어쓸 프리셋 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {presets.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        {preset.name} · 단계 {preset.stageCount} · 할 일{" "}
                        {preset.taskCount}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11.5px] text-muted-foreground">
                  선택한 프리셋이 현재 구성으로 대체됩니다.
                </p>
              </>
            )}
          </div>
        )}

        {error && <p className="text-[12.5px] text-destructive">{error}</p>}

        <Separator />

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
          >
            취소
          </Button>
          <Button type="button" onClick={save} disabled={!canSave}>
            {saving ? "저장 중…" : "저장"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
