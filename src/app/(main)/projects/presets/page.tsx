import type { Metadata } from "next";

import { PresetListPage } from "@/components/features/presets/preset-list-page";

export const metadata: Metadata = {
  title: "프리셋 — Y.OS Core",
};

export default function PresetsRoute() {
  return <PresetListPage />;
}
