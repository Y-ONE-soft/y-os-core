// 프로젝트를 단계·할일과 함께 한 번에 만드는 합성 생성.
// service.ts의 단일 행 헬퍼(createStage/createTask)는 각자 db를 직접 호출해 트랜잭션에
// 참여시킬 수 없으므로, 여기서는 tx 클라이언트로 직접 만든다.

import { db } from "@/server/db";
import { getPreset } from "@/server/presets/service";
import {
  presetStageSpan,
  stageSpansError,
  type StageSpan,
} from "@/lib/stage-plan";

/**
 * 정렬 가능한 id를 만든다 — **할일 전용**이다.
 *
 * 할일 조회 정렬은 여전히 [createdAt asc, id asc]인데, 한 트랜잭션 안에서 만든 행은
 * createdAt(now())이 모두 같은 값으로 잡혀 실질 정렬 키가 id가 된다. 순수 uuid를 쓰면
 * 프리셋의 할일 순서가 무작위로 섞이므로, 접두사 뒤에 0으로 채운 순번을 넣어
 * id 사전순 = 의도한 순서가 되도록 한다.
 *
 * 단계는 이 트릭이 필요 없다 — 명시적 order 필드로 정렬한다(STAGE_ORDER).
 */
function orderedId(prefix: string, index: number): string {
  return `${prefix}-${String(index).padStart(3, "0")}-${crypto.randomUUID()}`;
}

type BaseInput = {
  projectId: string;
  groupId: string;
  name: string;
  color: string;
  /** 작업자 = 만든 사람 (기존 createProject 규약과 동일) */
  ownerId: string;
};

/**
 * 프리셋을 적용해 프로젝트를 만든다.
 * 프리셋의 날짜는 기준일 상대 오프셋이므로 baseDate만 있으면 전체 일정이 재현된다.
 *
 * 단계 color는 프리셋이 스냅샷한 값을 그대로 저장한다. 다만 보드 화면은 저장된 색을
 * 쓰지 않고 프로젝트 색에서 파생하므로(board-store의 withDerivedColors) 표시에는
 * 영향이 없다 — 어디까지나 프리셋 원본 보존용이다.
 */
export async function createProjectFromPreset(
  input: BaseInput & { presetId: string; baseDate: string },
): Promise<void> {
  // 소유자 검증은 getPreset이 ownerId를 함께 걸어 처리한다 (남의 프리셋 id는 not found)
  const preset = await getPreset(input.ownerId, input.presetId);

  await db.$transaction(async (tx) => {
    await tx.project.create({
      data: {
        id: input.projectId,
        groupId: input.groupId,
        name: input.name,
        color: input.color,
        ownerId: input.ownerId,
      },
    });

    for (const [stageIndex, stage] of preset.stages.entries()) {
      const span = presetStageSpan(input.baseDate, stage);
      const stageId = `st-${crypto.randomUUID()}`;
      await tx.stage.create({
        data: {
          id: stageId,
          projectId: input.projectId,
          name: stage.name,
          color: stage.color,
          startDate: span.startDate,
          endDate: span.endDate,
          // 새 프로젝트라 1..N을 그대로 매긴다 (@@unique([projectId, order]))
          order: stageIndex + 1,
        },
      });

      for (const [taskIndex, task] of stage.tasks.entries()) {
        await tx.task.create({
          data: {
            id: orderedId("tk", taskIndex),
            projectId: input.projectId,
            stageId,
            name: task.name,
            // 프리셋으로 만든 할일도 담당자 기본값 규칙을 따른다 —
            // 이 프로젝트의 소유자가 곧 만든 사람이다
            assigneeId: input.ownerId,
            scheduledDate:
              task.offsetDays === undefined
                ? null
                : presetStageSpan(input.baseDate, {
                    offsetDays: task.offsetDays,
                  }).startDate,
          },
        });
      }
    }
  });
}

/** 단계가 이미 있는 프로젝트에 프리셋을 적용하려 할 때 */
export class ProjectNotEmptyError extends Error {
  constructor() {
    super("이미 단계가 있는 프로젝트에는 프리셋을 적용할 수 없습니다.");
    this.name = "ProjectNotEmptyError";
  }
}

/**
 * 이미 만들어진 프로젝트에 프리셋을 적용한다 (프로젝트 상세의 '프리셋 사용하기').
 *
 * **단계가 하나도 없는 프로젝트에만 허용한다.** 기존 단계에 이어붙이거나 덮어쓰는 것은
 * 어느 쪽이든 사용자가 만든 내용을 건드리게 되고, 화면도 단계가 있으면 버튼을
 * 비활성화하므로 서버는 같은 규칙을 최종 판정으로 다시 확인한다.
 *
 * 단계 생성 규칙(날짜 오프셋·order·할일 정렬 id)은 createProjectFromPreset과 동일하다.
 */
export async function applyPresetToProject(input: {
  projectId: string;
  ownerId: string;
  presetId: string;
  baseDate: string;
}): Promise<void> {
  // 소유자 검증은 getPreset이 ownerId를 함께 걸어 처리한다 (남의 프리셋 id는 not found)
  const preset = await getPreset(input.ownerId, input.presetId);

  await db.$transaction(async (tx) => {
    // 빈 프로젝트 판정을 트랜잭션 안에서 해야 동시 요청 두 건이 함께 통과하지 않는다
    const existing = await tx.stage.count({
      where: { projectId: input.projectId },
    });
    if (existing > 0) throw new ProjectNotEmptyError();

    // 담당자 기본값은 **프로젝트 소유자** 기준이다 — 여기서는 기존 프로젝트에
    // 적용하므로 요청자와 소유자가 다를 수 있다(마스터가 남의 프로젝트에 적용).
    const project = await tx.project.findUnique({
      where: { id: input.projectId },
      select: { ownerId: true },
    });
    const assigneeId = project?.ownerId ?? input.ownerId;

    for (const [stageIndex, stage] of preset.stages.entries()) {
      const span = presetStageSpan(input.baseDate, stage);
      const stageId = `st-${crypto.randomUUID()}`;
      await tx.stage.create({
        data: {
          id: stageId,
          projectId: input.projectId,
          name: stage.name,
          color: stage.color,
          startDate: span.startDate,
          endDate: span.endDate,
          // 빈 프로젝트에만 적용하므로 1..N을 그대로 매긴다 (@@unique([projectId, order]))
          order: stageIndex + 1,
        },
      });

      for (const [taskIndex, task] of stage.tasks.entries()) {
        await tx.task.create({
          data: {
            id: orderedId("tk", taskIndex),
            projectId: input.projectId,
            stageId,
            name: task.name,
            assigneeId,
            scheduledDate:
              task.offsetDays === undefined
                ? null
                : presetStageSpan(input.baseDate, {
                    offsetDays: task.offsetDays,
                  }).startDate,
          },
        });
      }
    }
  });
}

/**
 * 단계 날짜 구간 배열로 프로젝트를 만든다 (직접 만들기).
 * 구간은 겹쳐도 되며, 균등 분할은 클라이언트가 초기값으로만 쓰고 여기서는 받은
 * 대로 만든다. 할일은 만들지 않는다 — 뼈대만 잡고 내용은 사용자가 채운다.
 */
export async function createProjectWithStages(
  input: BaseInput & { spans: StageSpan[] },
): Promise<void> {
  // 서비스 단독 호출도 안전하도록 라우트와 같은 기준으로 다시 검증한다.
  const invalid = stageSpansError(input.spans);
  if (invalid) throw new Error(invalid);
  const spans = input.spans;

  await db.$transaction(async (tx) => {
    await tx.project.create({
      data: {
        id: input.projectId,
        groupId: input.groupId,
        name: input.name,
        color: input.color,
        ownerId: input.ownerId,
      },
    });

    for (const [index, span] of spans.entries()) {
      await tx.stage.create({
        data: {
          id: `st-${crypto.randomUUID()}`,
          projectId: input.projectId,
          name: `${index + 1}단계`,
          // 표시 색은 보드가 프로젝트 색에서 파생하므로 여기서는 프로젝트 색을 그대로 둔다
          color: input.color,
          startDate: span.startDate,
          endDate: span.endDate,
          order: index + 1,
        },
      });
    }
  });
}
