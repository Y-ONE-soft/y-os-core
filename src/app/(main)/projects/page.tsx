import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "작업 현황",
};

export default function TaskStatusPage() {
  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold text-foreground">작업 현황</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        작업 현황 콘텐츠는 이후 태스크에서 구현됩니다.
      </p>
    </div>
  );
}
