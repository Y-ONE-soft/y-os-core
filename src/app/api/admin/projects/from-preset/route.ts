import { NextResponse } from "next/server";

import {
  badRequest,
  currentUser,
  isISODate,
  isName,
  resolveProjectGroupId,
  unauthorized,
} from "@/app/api/admin/guard";
import { createProjectFromPreset } from "@/server/workspace/compose";
import { PresetNotFoundError } from "@/server/presets/service";

/** 프리셋을 적용해 프로젝트+단계+할일을 한 번에 만든다 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    groupId?: unknown;
    name?: unknown;
    color?: unknown;
    presetId?: unknown;
    baseDate?: unknown;
  } | null;

  if (
    !body ||
    !isName(body.id) ||
    !isName(body.name) ||
    !isName(body.color) ||
    !isName(body.presetId) ||
    !isISODate(body.baseDate)
  ) {
    return badRequest();
  }

  const groupId = resolveProjectGroupId(user, body.groupId);
  if (typeof groupId !== "string") return groupId;

  try {
    await createProjectFromPreset({
      projectId: body.id,
      groupId,
      name: body.name.trim(),
      color: body.color,
      ownerId: user.id,
      presetId: body.presetId,
      baseDate: body.baseDate,
    });
  } catch (error) {
    // 남의 프리셋 id를 넣어도 여기로 온다 (getPreset이 ownerId를 함께 걸어 조회하므로)
    if (error instanceof PresetNotFoundError) {
      return badRequest("프리셋을 찾을 수 없습니다.");
    }
    throw error;
  }

  return NextResponse.json({ ok: true });
}
