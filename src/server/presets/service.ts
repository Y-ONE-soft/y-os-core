import { randomUUID } from "node:crypto";

import { db } from "@/server/db";
import type { PresetDetail, PresetStage, PresetSummary } from "@/types/preset";

const ORDER = [{ createdAt: "asc" as const }, { id: "asc" as const }];
/** 단계는 명시적인 order로 정렬한다 — 프리셋도 화면에 보이던 순서 그대로 담아야 한다 */
const STAGE_ORDER = [{ order: "asc" as const }, { id: "asc" as const }];

const DAY_MS = 86_400_000;

/**
 * YYYY-MM-DD 문자열 날짜 계산 — UTC 컴포넌트로만 다뤄 TZ 이슈를 피한다.
 * (DB가 Date가 아닌 문자열로 날짜를 들고 있는 것과 같은 이유)
 */
function toUtcMs(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function diffDays(from: string, to: string) {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

/** 이름이 이미 있을 때 — 라우트가 409로 바꾼다 */
export class DuplicatePresetNameError extends Error {
  constructor() {
    super("같은 이름의 프리셋이 이미 있습니다.");
    this.name = "DuplicatePresetNameError";
  }
}

/** 대상이 없거나 남의 것일 때 — 라우트가 404로 바꾼다 */
export class PresetNotFoundError extends Error {
  constructor() {
    super("프리셋을 찾을 수 없습니다.");
    this.name = "PresetNotFoundError";
  }
}

/**
 * 프로젝트의 현재 단계·할일을 상대 일정으로 스냅샷한다.
 * 기준일 = 시작일이 있는 단계 중 가장 이른 날. 하나도 없으면 모든 오프셋이 null.
 */
async function snapshotProject(projectId: string) {
  const stages = await db.stage.findMany({
    where: { projectId },
    orderBy: STAGE_ORDER,
    include: { tasks: { orderBy: ORDER } },
  });

  const starts = stages
    .map((stage) => stage.startDate)
    .filter((date): date is string => date !== null);
  const baseDate = starts.length > 0 ? starts.sort()[0] : null;

  return stages.map((stage, index) => ({
    id: `pss-${randomUUID()}`,
    name: stage.name,
    color: stage.color,
    order: index,
    offsetDays:
      baseDate && stage.startDate ? diffDays(baseDate, stage.startDate) : null,
    durationDays:
      stage.startDate && stage.endDate
        ? diffDays(stage.startDate, stage.endDate) + 1
        : null,
    tasks: stage.tasks.map((task, taskIndex) => ({
      id: `pst-${randomUUID()}`,
      name: task.name,
      order: taskIndex,
      offsetDays:
        baseDate && task.scheduledDate
          ? diffDays(baseDate, task.scheduledDate)
          : null,
    })),
  }));
}

/** 스냅샷을 중첩 create 입력으로 바꾼다 */
function toCreateInput(stages: Awaited<ReturnType<typeof snapshotProject>>) {
  return stages.map(({ tasks, ...stage }) => ({
    ...stage,
    tasks: { create: tasks },
  }));
}

export async function listPresets(ownerId: string): Promise<PresetSummary[]> {
  const presets = await db.stagePreset.findMany({
    where: { ownerId },
    orderBy: { updatedAt: "desc" },
    include: { stages: { include: { tasks: true } } },
  });

  return presets.map((preset) => ({
    id: preset.id,
    name: preset.name,
    stageCount: preset.stages.length,
    taskCount: preset.stages.reduce((sum, stage) => sum + stage.tasks.length, 0),
    updatedAt: preset.updatedAt.toISOString(),
  }));
}

export async function getPreset(
  ownerId: string,
  presetId: string,
): Promise<PresetDetail> {
  const preset = await db.stagePreset.findFirst({
    // ownerId를 함께 걸어 남의 프리셋 id로는 조회되지 않게 한다
    where: { id: presetId, ownerId },
    include: {
      stages: {
        orderBy: { order: "asc" },
        include: { tasks: { orderBy: { order: "asc" } } },
      },
    },
  });
  if (!preset) throw new PresetNotFoundError();

  const stages: PresetStage[] = preset.stages.map((stage) => ({
    name: stage.name,
    color: stage.color,
    offsetDays: stage.offsetDays ?? undefined,
    durationDays: stage.durationDays ?? undefined,
    tasks: stage.tasks.map((task) => ({
      name: task.name,
      offsetDays: task.offsetDays ?? undefined,
    })),
  }));

  return {
    id: preset.id,
    name: preset.name,
    stageCount: stages.length,
    taskCount: stages.reduce((sum, stage) => sum + stage.tasks.length, 0),
    updatedAt: preset.updatedAt.toISOString(),
    stages,
  };
}

export async function createPresetFromProject(
  ownerId: string,
  name: string,
  projectId: string,
) {
  const duplicate = await db.stagePreset.findFirst({
    where: { ownerId, name },
    select: { id: true },
  });
  if (duplicate) throw new DuplicatePresetNameError();

  const stages = await snapshotProject(projectId);
  const preset = await db.stagePreset.create({
    data: {
      id: `ps-${randomUUID()}`,
      ownerId,
      name,
      stages: { create: toCreateInput(stages) },
    },
    select: { id: true },
  });
  return preset;
}

/** 기존 프리셋의 구성을 현재 프로젝트 구성으로 통째 교체한다 (이름은 유지) */
export async function overwritePresetFromProject(
  ownerId: string,
  presetId: string,
  projectId: string,
) {
  const target = await db.stagePreset.findFirst({
    where: { id: presetId, ownerId },
    select: { id: true },
  });
  if (!target) throw new PresetNotFoundError();

  const stages = await snapshotProject(projectId);
  await db.$transaction([
    // 단계를 지우면 할일은 Cascade로 함께 지워진다
    db.stagePresetStage.deleteMany({ where: { presetId } }),
    db.stagePreset.update({
      where: { id: presetId },
      data: { stages: { create: toCreateInput(stages) } },
    }),
  ]);
}

export async function deletePreset(ownerId: string, presetId: string) {
  const { count } = await db.stagePreset.deleteMany({
    where: { id: presetId, ownerId },
  });
  if (count === 0) throw new PresetNotFoundError();
}
