import type { Metadata } from "next";

import { MyWorkPage } from "@/components/features/my-work/my-work-page";

export const metadata: Metadata = {
  title: "내 할일 — Y.OS Core",
};

export default async function MyTasksRoute({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // 뷰 전환은 URL로 둔다 — 서버 컴포넌트를 유지하면서 공유·뒤로가기가 자연스럽다
  const { view } = await searchParams;
  return <MyWorkPage view={view === "timeline" ? "timeline" : "calendar"} />;
}
