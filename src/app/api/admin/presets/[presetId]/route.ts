import { NextResponse } from "next/server";

import {
  badRequest,
  currentUser,
  isName,
  unauthorized,
} from "@/app/api/admin/guard";
import {
  PresetNotFoundError,
  deletePreset,
  getPreset,
  overwritePresetFromProject,
} from "@/server/presets/service";

const notFound = (error: PresetNotFoundError) =>
  NextResponse.json({ error: error.message }, { status: 404 });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ presetId: string }> },
) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const { presetId } = await params;
  try {
    return NextResponse.json({ preset: await getPreset(user.id, presetId) });
  } catch (error) {
    if (error instanceof PresetNotFoundError) return notFound(error);
    throw error;
  }
}

/** 덮어쓰기 — 이름은 두고 구성만 현재 프로젝트로 교체한다 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ presetId: string }> },
) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const body = (await request.json().catch(() => null)) as {
    projectId?: unknown;
  } | null;
  if (!body || !isName(body.projectId)) return badRequest();

  const { presetId } = await params;
  try {
    await overwritePresetFromProject(user.id, presetId, body.projectId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PresetNotFoundError) return notFound(error);
    throw error;
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ presetId: string }> },
) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const { presetId } = await params;
  try {
    await deletePreset(user.id, presetId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PresetNotFoundError) return notFound(error);
    throw error;
  }
}
