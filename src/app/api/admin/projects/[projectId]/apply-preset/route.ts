import { NextResponse } from "next/server";

import {
  badRequest,
  currentUser,
  isISODate,
  isName,
  unauthorized,
} from "@/app/api/admin/guard";
import {
  ProjectNotEmptyError,
  applyPresetToProject,
} from "@/server/workspace/compose";
import { PresetNotFoundError } from "@/server/presets/service";

/** 이미 만들어진 프로젝트에 프리셋 단계·할일을 채운다 (단계가 없는 프로젝트만) */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const body = (await request.json().catch(() => null)) as {
    presetId?: unknown;
    baseDate?: unknown;
  } | null;
  if (!body || !isName(body.presetId) || !isISODate(body.baseDate)) {
    return badRequest();
  }

  const { projectId } = await params;

  try {
    await applyPresetToProject({
      projectId,
      ownerId: user.id,
      presetId: body.presetId,
      baseDate: body.baseDate,
    });
  } catch (error) {
    // 남의 프리셋 id도 여기로 온다 (getPreset이 ownerId를 함께 걸어 조회하므로)
    if (error instanceof PresetNotFoundError) {
      return badRequest("프리셋을 찾을 수 없습니다.");
    }
    if (error instanceof ProjectNotEmptyError) {
      return badRequest(error.message);
    }
    throw error;
  }

  return NextResponse.json({ ok: true });
}
