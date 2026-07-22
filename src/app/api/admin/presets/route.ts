import { NextResponse } from "next/server";

import {
  badRequest,
  currentUser,
  isName,
  unauthorized,
} from "@/app/api/admin/guard";
import {
  DuplicatePresetNameError,
  createPresetFromProject,
  listPresets,
} from "@/server/presets/service";

export async function GET() {
  const user = await currentUser();
  if (!user) return unauthorized();

  // 프리셋은 개인용 — 세션 사용자 것만 돌려준다
  return NextResponse.json({ presets: await listPresets(user.id) });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    projectId?: unknown;
  } | null;
  if (!body || !isName(body.name) || !isName(body.projectId)) {
    return badRequest();
  }

  // 구성 스냅샷은 서버가 DB에서 읽어 만든다 — 클라이언트는 projectId만 보낸다
  try {
    const preset = await createPresetFromProject(
      user.id,
      body.name.trim(),
      body.projectId,
    );
    return NextResponse.json({ id: preset.id });
  } catch (error) {
    if (error instanceof DuplicatePresetNameError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
