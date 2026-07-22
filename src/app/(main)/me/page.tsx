import type { Metadata } from "next";

import { MyInfoPage } from "@/components/features/me/my-info-page";

export const metadata: Metadata = {
  title: "내 정보 — Y.OS Core",
};

export default function MeRoute() {
  return <MyInfoPage />;
}
