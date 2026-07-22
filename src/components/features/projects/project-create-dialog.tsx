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
import {
  createProjectFromPresetApi,
  createProjectWithEvenStagesApi,
} from "@/lib/api/workspace";
import {
  evenSplitError,
  inclusiveDays,
  splitRangeEvenly,
} from "@/lib/stage-plan";
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
  type DateRange,
} from "@/components/features/projects/range-calendar";

type Mode = "preset" | "even";

const MODES: { key: Mode; label: string }[] = [
  { key: "preset", label: "프리셋 적용" },
  { key: "even", label: "직접 만들기" },
];

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
        <ProjectCreateForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ProjectCreateForm({ onDone }: { onDone: () => void }) {
  const { user } = useSession();
  const { groups } = useProjectStore();
  const isMaster = user?.role === "MASTER";

  const [mode, setMode] = useState<Mode>("preset");
  // 두 모드가 함께 쓰는 값
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 프리셋 적용 모드
  const [presets, setPresets] = useState<PresetSummary[] | null>(null);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [baseDate, setBaseDate] = useState(todayLocalISO);

  // 직접 만들기 모드
  const [range, setRange] = useState<Partial<DateRange>>({});
  const [stageCount, setStageCount] = useState(4);

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

  const selectedPreset =
    presets?.find((preset) => preset.id === presetId) ?? null;

  // 균등 분할 미리보기 — 서버 생성과 같은 @/lib/stage-plan을 쓰므로 결과가 어긋나지 않는다
  const evenPlan = useMemo(() => {
    if (!range.startDate || !range.endDate) return null;
    const invalid = evenSplitError(range.startDate, range.endDate, stageCount);
    if (invalid) return { error: invalid, spans: null };
    return {
      error: null,
      spans: splitRangeEvenly(range.startDate, range.endDate, stageCount),
    };
  }, [range.startDate, range.endDate, stageCount]);

  function pickPreset(preset: PresetSummary) {
    setPresetId(preset.id);
    // 이름을 아직 손대지 않았으면 프리셋 이름을 기본값으로 채운다
    setName((prev) => (prev.trim() ? prev : preset.name));
  }

  const sharedReady = name.trim().length > 0 && (!isMaster || !!groupId);
  const canSubmit =
    sharedReady &&
    (mode === "preset" ? !!presetId : !!evenPlan && !evenPlan.error);

  async function submit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    const base = {
      id: `p-${crypto.randomUUID()}`,
      ...(isMaster ? { groupId } : {}),
      name: name.trim(),
      color: nextColor,
    };
    try {
      if (mode === "preset") {
        await createProjectFromPresetApi({
          ...base,
          presetId: presetId!,
          baseDate,
        });
      } else {
        await createProjectWithEvenStagesApi({
          ...base,
          startDate: range.startDate!,
          endDate: range.endDate!,
          stageCount,
        });
      }
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
          {mode === "preset"
            ? "프리셋을 고르고 시작일을 정하면 단계와 할일이 함께 만들어집니다."
            : "기간을 드래그하고 단계 수를 정하면 기간을 균등하게 나눈 단계가 만들어집니다."}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div
          role="tablist"
          aria-label="생성 방식"
          className="flex items-center rounded-[8px] border p-[3px]"
        >
          {MODES.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={mode === item.key}
              onClick={() => {
                setMode(item.key);
                setError(null);
              }}
              className={cn(
                "flex-1 rounded-[6px] px-2.5 py-1 text-[13px] font-medium transition-colors",
                mode === item.key
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {mode === "preset" && (
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
              <ul className="flex max-h-[150px] flex-col gap-1 overflow-y-auto">
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
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="project-name">프로젝트 이름</Label>
          <Input
            id="project-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={
              mode === "preset"
                ? "프리셋을 고르면 이름이 채워집니다"
                : "프로젝트 이름"
            }
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

        {mode === "preset" ? (
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
              onChange={(picked) => setBaseDate(picked.startDate)}
            />
            {selectedPreset && (
              <p className="text-[11px] text-muted-foreground">
                {baseDate}부터 단계 {selectedPreset.stageCount}개 · 할일{" "}
                {selectedPreset.taskCount}개가 만들어집니다.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <Label>
                기간{" "}
                <span className="font-normal text-muted-foreground">
                  — 캘린더를 드래그해 시작일과 종료일을 잡으세요
                </span>
              </Label>
              <RangeCalendar mode="range" value={range} onChange={setRange} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="stage-count">예상 단계 수</Label>
              <Input
                id="stage-count"
                type="number"
                min={1}
                value={stageCount}
                onChange={(event) =>
                  setStageCount(Number(event.target.value) || 0)
                }
                className="w-24"
              />
            </div>

            {/* 미리보기 — 만들기 전에 어떻게 쪼개지는지 그대로 보여준다 */}
            {range.startDate && range.endDate && (
              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] text-muted-foreground">
                  {range.startDate} ~ {range.endDate} (총{" "}
                  {inclusiveDays(range.startDate, range.endDate)}일)
                </p>
                {evenPlan?.error ? (
                  <p
                    role="alert"
                    className="rounded-[8px] border border-destructive/40 p-2.5 text-[12px] text-destructive"
                  >
                    {evenPlan.error}
                  </p>
                ) : (
                  <ul
                    data-testid="even-preview"
                    className="flex max-h-[130px] flex-col gap-0.5 overflow-y-auto rounded-[8px] border p-2"
                  >
                    {evenPlan?.spans?.map((span, index) => (
                      <li
                        key={span.startDate}
                        className="flex items-center justify-between text-[12px]"
                      >
                        <span className="font-medium">{index + 1}단계</span>
                        <span className="tabular-nums text-muted-foreground">
                          {span.startDate} ~ {span.endDate} (
                          {inclusiveDays(span.startDate, span.endDate)}일)
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}

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
