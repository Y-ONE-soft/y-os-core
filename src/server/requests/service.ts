import { db } from "@/server/db";
import type {
  RequestKind,
  RequestStatus,
  WorkRequest,
} from "@/types/requests";
import type { Prisma } from "@/generated/prisma/client";

// 목록 조회에 필요한 관계를 한 번에 가져오는 include — 카드 표기에 쓰는 것만.
const REQUEST_INCLUDE = {
  fromUser: { select: { id: true, name: true } },
  toUser: { select: { id: true, name: true } },
  task: { select: { id: true, name: true, project: { select: { name: true } } } },
  stage: { select: { id: true, name: true, project: { select: { name: true } } } },
} satisfies Prisma.RequestInclude;

type RequestRow = Prisma.RequestGetPayload<{ include: typeof REQUEST_INCLUDE }>;

function toWorkRequest(row: RequestRow, viewerId: string): WorkRequest {
  // 대상은 할일 또는 단계 중 하나만 채워진다 (스키마 주석 참고)
  const target = row.task
    ? {
        type: "task" as const,
        id: row.task.id,
        name: row.task.name,
        projectName: row.task.project?.name ?? null,
      }
    : row.stage
      ? {
          type: "stage" as const,
          id: row.stage.id,
          name: row.stage.name,
          projectName: row.stage.project?.name ?? null,
        }
      : null;

  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
    from: row.fromUser,
    to: row.toUser,
    target,
    direction: row.toUserId === viewerId ? "received" : "sent",
  };
}

/** 로그인 사용자가 보냈거나 받은 요청 — 최신순 */
export async function listRequestsForUser(
  userId: string,
): Promise<WorkRequest[]> {
  const rows = await db.request.findMany({
    where: { OR: [{ toUserId: userId }, { fromUserId: userId }] },
    include: REQUEST_INCLUDE,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return rows.map((row) => toWorkRequest(row, userId));
}

export async function createRequests(input: {
  ids: string[];
  kind: RequestKind;
  fromUserId: string;
  toUserIds: string[];
  message: string | null;
  taskId: string | null;
  stageId: string | null;
}) {
  // 여러 명에게 보내면 각자 1건씩 — 수락·거절이 사람별로 따로 일어나야 하기 때문
  const data = input.toUserIds.map((toUserId, index) => ({
    id: input.ids[index],
    kind: input.kind,
    fromUserId: input.fromUserId,
    toUserId,
    message: input.message,
    taskId: input.taskId,
    stageId: input.stageId,
  }));
  await db.request.createMany({ data, skipDuplicates: true });
}

/**
 * 요청 상태 변경.
 * - 수락·거절은 **받은 사람**만, 취소는 **보낸 사람**만 할 수 있다.
 * - 이미 PENDING이 아니면 아무것도 바꾸지 않는다(중복 응답 방지).
 * 권한/상태를 where에 함께 넣어 조회-후-수정 사이의 경합을 없앴다.
 */
export async function respondToRequest(input: {
  id: string;
  userId: string;
  status: Exclude<RequestStatus, "PENDING">;
}) {
  const actorField =
    input.status === "CANCELED"
      ? { fromUserId: input.userId }
      : { toUserId: input.userId };

  const result = await db.request.updateMany({
    where: { id: input.id, status: "PENDING", ...actorField },
    data: { status: input.status, respondedAt: new Date() },
  });
  return result.count > 0;
}

/** 수락 시 실제 반영 — 공동 작업자 지정 요청은 대상 단계의 공동작업자에 추가한다. */
export async function applyAcceptedRequest(id: string) {
  const request = await db.request.findUnique({
    where: { id },
    select: { kind: true, toUserId: true, stageId: true },
  });
  if (!request || request.kind !== "ASSIGN" || !request.stageId) return;

  const stage = await db.stage.findUnique({
    where: { id: request.stageId },
    select: { requestedCollaborators: true },
  });
  if (!stage) return;
  if (stage.requestedCollaborators.includes(request.toUserId)) return;

  await db.stage.update({
    where: { id: request.stageId },
    data: {
      requestedCollaborators: [
        ...stage.requestedCollaborators,
        request.toUserId,
      ],
    },
  });
}
