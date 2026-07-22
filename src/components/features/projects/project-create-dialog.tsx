"use client";

// 내 할일에서 프로젝트를 만드는 다이얼로그.
// 생성은 서버가 프로젝트+단계(+할일)를 한 트랜잭션으로 처리한다 — @/lib/api/workspace.

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import { fetchPresets } from "@/lib/api/presets";
import { createProjectFromPresetApi } from "@/lib/api/workspace";
import type { PresetSummary } from "@/types/preset";
import { useSession } from "@/components/features/auth/session-context";
import {
  PROJECT_COLORS,
  useProjectStore,
} from "@/components/features/projects/project-store";
import * as cache from "@/components/features/projects/workspace-cache";
import {
  RangeCalendar,
  todayLocalISO,
} from "@/components/features/projects/range-calendar";

export function ProjectCreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        폼 본문을 별도 컴포넌트로 둔다. Radix는 닫힐 때 DialogContent를 언마운트하므로
        다시 열 때 useState 초기값이 그대로 다시 잡힌다 — 이전 입력이 남아 실수로
        그대로 만들게 되는 것을 이펙트로 리셋하지 않고 마운트 주기로 해결한다.
      */}
      <DialogContent className="sm:max-w-[560px]">
        <CreateFromPresetForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function CreateFromPresetForm({ onDone }: { onDone: () => void }) {
  const { user } = useSession();
  const { groups } = useProjectStore();
  const isMaster = user?.role === "MASTER";

  const [presets, setPresets] = useState<PresetSummary[] | null>(null);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [baseDate, setBaseDate] = useState(todayLocalISO);
  // 마스터만 고른다 — 스탭은 서버가 세션 그룹으로 강제한다
  const [groupId, setGroupId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchPresets()
      .then((res) => alive && setPresets(res.presets))
      .catch(() => alive && setPresets([]));
    return () => {
      alive = false;
    };
  }, []);

  // 새 프로젝트 색 — 스토어의 addProject와 같은 순번 규칙을 따른다
  const nextColor = useMemo(() => {
    const total = groups.reduce((sum, group) => sum + group.projects.length, 0);
    return PROJECT_COLORS[total % PROJECT_COLORS.length];
  }, [groups]);

  const selected = presets?.find((preset) => preset.id === presetId) ?? null;

  function pickPreset(preset: PresetSummary) {
    setPresetId(preset.id);
    // 이름을 아직 손대지 않았으면 프리셋 이름을 기본값으로 채운다
    setName((prev) => (prev.trim() ? prev : preset.name));
  }

  const canSubmit =
    !!presetId && name.trim().length > 0 && (!isMaster || !!groupId);

  async function submit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await createProjectFromPresetApi({
        id: `p-${crypto.randomUUID()}`,
        ...(isMaster ? { groupId } : {}),
        name: name.trim(),
        color: nextColor,
        presetId: presetId!,
        baseDate,
      });
      // 생성이 끝났으면 먼저 닫는다. 목록 갱신을 기다렸다가 닫으면, 갱신이 실패했을 때
      // 이미 만들어진 프로젝트인데도 창이 열린 채 남아 사용자가 다시 눌러 중복 생성한다.
      onDone();
      cache.refresh().catch(() => {
        // 갱신 실패는 생성 결과에 영향이 없다 — 다음 부트스트랩에서 따라온다
      });
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "프로젝트를 만들지 못했습니다.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>프로젝트 생성</DialogTitle>
        <DialogDescription>
          프리셋을 고르고 시작일을 정하면 단계와 할일이 함께 만들어집니다.
        </DialogDescription>
      </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>프리셋</Label>
            {presets === null ? (
              <p className="text-[13px] text-muted-foreground">불러오는 중…</p>
            ) : presets.length === 0 ? (
              <p className="rounded-[8px] border border-dashed p-3 text-[13px] text-muted-foreground">
                저장된 프리셋이 없습니다. 프로젝트 상세에서 구성을 프리셋으로
                저장한 뒤 사용할 수 있습니다.
              </p>
            ) : (
              <ul className="flex max-h-[180px] flex-col gap-1 overflow-y-auto">
                {presets.map((preset) => (
                  <li key={preset.id}>
                    <button
                      type="button"
                      onClick={() => pickPreset(preset)}
                      aria-pressed={preset.id === presetId}
                      className={cn(
                        "flex w-full items-center justify-between rounded-[8px] border px-3 py-2 text-left transition-colors",
                        preset.id === presetId
                          ? "border-primary bg-primary/10"
                          : "hover:bg-accent/60",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                        {preset.name}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        단계 {preset.stageCount} · 할일 {preset.taskCount}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-name">프로젝트 이름</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="프리셋을 고르면 이름이 채워집니다"
            />
          </div>

          {isMaster && (
            <div className="flex flex-col gap-1.5">
              {/* 마스터는 전체 그룹을 다루므로 어디에 만들지 정해야 한다 */}
              <Label htmlFor="project-group">그룹</Label>
              <select
                id="project-group"
                value={groupId}
                onChange={(event) => setGroupId(event.target.value)}
                className="h-9 rounded-[8px] border bg-transparent px-2.5 text-[13px]"
              >
                <option value="">그룹 선택</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>
              시작일{" "}
              <span className="font-normal text-muted-foreground">
                — 프리셋 일정이 이 날짜부터 재현됩니다
              </span>
            </Label>
            <RangeCalendar
              mode="single"
              value={{ startDate: baseDate, endDate: baseDate }}
              onChange={(range) => setBaseDate(range.startDate)}
            />
            {selected && (
              <p className="text-[11px] text-muted-foreground">
                {baseDate}부터 단계 {selected.stageCount}개 · 할일{" "}
                {selected.taskCount}개가 만들어집니다.
              </p>
            )}
          </div>

          {error && (
            <p role="alert" className="text-[13px] text-destructive">
              {error}
            </p>
          )}
        </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={submitting}>
          취소
        </Button>
        <Button onClick={submit} disabled={!canSubmit || submitting}>
          {submitting ? "만드는 중…" : "만들기"}
        </Button>
      </DialogFooter>
    </>
  );
}
