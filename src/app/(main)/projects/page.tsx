import type { Metadata } from "next";

import { TaskStatusPage } from "@/components/features/projects/task-status-page";

export const metadata: Metadata = {
  title: "작업 현황",
};

export default function Page() {
  return <TaskStatusPage />;
}
