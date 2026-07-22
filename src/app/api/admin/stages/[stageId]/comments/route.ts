import { NextResponse } from "next/server";

import {
  badRequest,
  currentUser,
  isName,
  unauthorized,
} from "@/app/api/admin/guard";
import { createStageComment } from "@/server/workspace/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ stageId: string }> },
) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    text?: unknown;
  } | null;
  if (!body || !isName(body.id) || !isName(body.text)) return badRequest();

  const { stageId } = await params;
  // 작성자는 클라이언트 주장이 아닌 세션 사용자로 고정한다
  await createStageComment({
    id: body.id,
    stageId,
    author: user.name,
    text: body.text.trim(),
  });
  return NextResponse.json({ ok: true });
}
