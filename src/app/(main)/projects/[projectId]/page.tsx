import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProjectDetailPage } from "@/components/features/projects/project-detail-page";

export const metadata: Metadata = {
  title: "프로젝트 상세",
};

// 워크스페이스 고정 메뉴 경로는 프로젝트 id가 아니다 — 해당 화면 태스크 전까지 404 유지.
const RESERVED_SLUGS = new Set(["my-tasks", "analytics"]);

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  if (RESERVED_SLUGS.has(projectId)) notFound();
  return <ProjectDetailPage projectId={projectId} />;
}
