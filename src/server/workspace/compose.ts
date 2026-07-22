// 프로젝트를 단계·할일과 함께 한 번에 만드는 합성 생성.
// service.ts의 단일 행 헬퍼(createStage/createTask)는 각자 db를 직접 호출해 트랜잭션에
// 참여시킬 수 없으므로, 여기서는 tx 클라이언트로 직접 만든다.

import { db } from "@/server/db";
import { getPreset } from "@/server/presets/service";
import { presetStageSpan, splitRangeEvenly } from "@/lib/stage-plan";

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
 * 기간을 균등 분할한 단계로 프로젝트를 만든다 (직접 만들기).
 * 할일은 만들지 않는다 — 뼈대만 잡고 내용은 사용자가 채운다.
 */
export async function createProjectWithEvenStages(
  input: BaseInput & { startDate: string; endDate: string; stageCount: number },
): Promise<void> {
  // 입력 검증은 라우트가 evenSplitError로 먼저 하지만, 서비스 단독 호출도 안전하도록
  // splitRangeEvenly가 같은 기준으로 다시 던진다.
  const spans = splitRangeEvenly(
    input.startDate,
    input.endDate,
    input.stageCount,
  );

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
