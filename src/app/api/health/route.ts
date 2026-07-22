import { NextResponse } from "next/server";

import { checkHealth } from "@/server/health/service";

export async function GET() {
  try {
    return NextResponse.json(await checkHealth());
  } catch {
    return NextResponse.json(
      { status: "error", db: "disconnected" },
      { status: 503 },
    );
  }
}
