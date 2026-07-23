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
  createProjectWithStagesApi,
} from "@/lib/api/workspace";
import {
  inclusiveDays,
  planStageSpans,
  stageSpansError,
  type StageSpan,
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
  // 스탭 비활성 그룹칸 표시용 — 스토어 로드 전에는 null이라 자리표시를 쓴다
  const myGroupName = user?.groupId
    ? (groups.find((group) => group.id === user.groupId)?.name ?? null)
    : null;

  const [mode, setMode] = useState<Mode>("preset");
  // 두 모드가 함께 쓰는 값
  const [name, setName] = useState("");
  // 마스터는 여러 그룹을 다루므로 드롭다운으로 고르되, 기본값은 자기 소속 그룹이다
  // (내 정보에서 지정). 다른 그룹도 선택할 수 있다. 스탭은 이 값을 쓰지 않는다.
  const [groupId, setGroupId] = useState<string>(user?.groupId ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 프리셋 적용 모드
  const [presets, setPresets] = useState<PresetSummary[] | null>(null);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [baseDate, setBaseDate] = useState(todayLocalISO);

  // 직접 만들기 모드 — 기간·단계 수는 spans의 초기값을 만드는 재료이고,
  // 실제로 서버에 보내는 것은 편집된 spans다. 기간·단계 수를 바꾸면 재생성하되,
  // 재생성 뒤에는 사용자가 각 단계 날짜를 직접 고칠 수 있다.
  const [range, setRange] = useState<Partial<DateRange>>({});
  const [stageCount, setStageCount] = useState(4);
  const [spans, setSpans] = useState<StageSpan[]>([]);

  // 기간·단계 수가 갖춰지면 겹침 허용 규칙으로 spans를 다시 만든다.
  function regenerateSpans(next: {
    range?: Partial<DateRange>;
    stageCount?: number;
  }) {
    const r = next.range ?? range;
    const count = next.stageCount ?? stageCount;
    if (r.startDate && r.endDate && count >= 1) {
      setSpans(planStageSpans(r.startDate, r.endDate, count));
    } else {
      setSpans([]);
    }
  }

  function handleRangeChange(picked: Partial<DateRange>) {
    setRange(picked);
    regenerateSpans({ range: picked });
  }

  function handleStageCountChange(count: number) {
    setStageCount(count);
    regenerateSpans({ stageCount: count });
  }

  // 특정 단계의 날짜 한쪽을 고친다. 겹침은 허용하므로 옆 단계는 건드리지 않는다.
  function editSpan(index: number, patch: Partial<StageSpan>) {
    setSpans((prev) =>
      prev.map((span, i) => (i === index ? { ...span, ...patch } : span)),
    );
  }

  const spansInvalid = spans.length > 0 ? stageSpansError(spans) : null;

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

  function pickPreset(preset: PresetSummary) {
    setPresetId(preset.id);
    // 이름을 아직 손대지 않았으면 프리셋 이름을 기본값으로 채운다
    setName((prev) => (prev.trim() ? prev : preset.name));
  }

  const sharedReady = name.trim().length > 0 && (!isMaster || !!groupId);
  const canSubmit =
    sharedReady &&
    (mode === "preset"
      ? !!presetId
      : spans.length > 0 && !spansInvalid);

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
        await createProjectWithStagesApi({ ...base, spans });
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

        {/* 그룹을 이름 위에 둔다 — 어느 그룹에 만들지부터 정한 뒤 이름을 적는 흐름. */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="project-group">그룹</Label>
          {isMaster ? (
            <>
              {/* 마스터는 전체 그룹을 다루므로 어디에 만들지 고른다. 기본값은 내 소속 그룹
                  (내 정보에서 지정) — 빈 "그룹 선택" 없이 항상 한 그룹이 잡혀 있다. */}
              <select
                id="project-group"
                value={groupId}
                onChange={(event) => setGroupId(event.target.value)}
                className="h-9 rounded-[8px] border bg-transparent px-2.5 text-[13px]"
              >
                {/* 내 소속 그룹이 아직 스토어에 없을 때만 자리 표시 */}
                {!groups.some((group) => group.id === groupId) && (
                  <option value={groupId}>그룹 선택</option>
                )}
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] leading-[15px] text-muted-foreground">
                마스터 권한이라 내 정보에서 지정한 대표 그룹으로 기본
                설정됩니다. 필요하면 아래 목록에서 바꿔주세요.
              </p>
            </>
          ) : (
            <>
              {/* 스탭은 담당 소속이 정해져 있어 바꿀 수 없다 — 비활성으로 보여준다.
                  서버도 세션 그룹으로 강제하므로 이 값은 표시 전용이다. */}
              <select
                id="project-group"
                value={user?.groupId ?? ""}
                disabled
                aria-readonly
                className="h-9 cursor-not-allowed rounded-[8px] border bg-muted px-2.5 text-[13px] text-muted-foreground"
              >
                <option value={user?.groupId ?? ""}>
                  {myGroupName ?? "내 소속 그룹"}
                </option>
              </select>
              <p className="text-[11px] leading-[15px] text-muted-foreground">
                담당 소속으로 지정됩니다. 소속은 관리자가 관리합니다.
              </p>
            </>
          )}
        </div>

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
              <RangeCalendar
                mode="range"
                value={range}
                onChange={handleRangeChange}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="stage-count">
                예상 단계 수{" "}
                <span className="font-normal text-muted-foreground">
                  — 아래에서 각 단계 날짜를 직접 조정할 수 있어요
                </span>
              </Label>
              <Input
                id="stage-count"
                type="number"
                min={1}
                // 0은 빈 칸으로 보여준다 — 안 그러면 앞의 0이 남아 "01"처럼 찍힌다.
                // (필드를 비우면 내부적으로 0이라 spans가 비고 제출도 막힌다)
                value={stageCount || ""}
                onChange={(event) =>
                  handleStageCountChange(Number(event.target.value) || 0)
                }
                className="w-24"
              />
            </div>

            {/* 단계별 날짜 편집 — 초기값은 기간·단계 수로 생성하되, 각 단계를 직접
                고칠 수 있다. 단계는 서로 겹쳐도 된다. */}
            {range.startDate && range.endDate && spans.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] text-muted-foreground">
                  {range.startDate} ~ {range.endDate} (총{" "}
                  {inclusiveDays(range.startDate, range.endDate)}일) · 단계는
                  겹쳐도 됩니다
                </p>
                <ul
                  data-testid="even-preview"
                  className="flex max-h-[180px] flex-col gap-1 overflow-y-auto rounded-[8px] border p-2"
                >
                  {spans.map((span, index) => (
                    <li
                      key={index}
                      className="flex items-center gap-2 text-[12px]"
                    >
                      <span className="w-10 shrink-0 font-medium">
                        {index + 1}단계
                      </span>
                      <input
                        type="date"
                        aria-label={`${index + 1}단계 시작일`}
                        value={span.startDate}
                        onChange={(event) =>
                          editSpan(index, { startDate: event.target.value })
                        }
                        className="h-8 min-w-0 flex-1 rounded-[6px] border bg-background px-2 tabular-nums outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                      <span className="shrink-0 text-muted-foreground">~</span>
                      <input
                        type="date"
                        aria-label={`${index + 1}단계 종료일`}
                        value={span.endDate}
                        min={span.startDate}
                        onChange={(event) =>
                          editSpan(index, { endDate: event.target.value })
                        }
                        className="h-8 min-w-0 flex-1 rounded-[6px] border bg-background px-2 tabular-nums outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </li>
                  ))}
                </ul>
                {spansInvalid && (
                  <p
                    role="alert"
                    className="rounded-[8px] border border-destructive/40 p-2.5 text-[12px] text-destructive"
                  >
                    {spansInvalid}
                  </p>
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
