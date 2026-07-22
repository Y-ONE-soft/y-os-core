import type { Metadata } from "next";

import { MyWorkPage } from "@/components/features/my-work/my-work-page";

export const metadata: Metadata = {
  title: "내 할일 — Y.OS Core",
};

export default function MyTasksRoute() {
  return <MyWorkPage />;
}
