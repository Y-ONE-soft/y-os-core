import { api } from "@/lib/api/client";
import type { PresetDetail, PresetSummary } from "@/types/preset";

export const fetchPresets = () =>
  api.get<{ presets: PresetSummary[] }>("/api/admin/presets");

export const fetchPreset = (presetId: string) =>
  api.get<{ preset: PresetDetail }>(`/api/admin/presets/${presetId}`);

/** 새 프리셋 — 구성은 서버가 projectId로 읽어 스냅샷한다 */
export const createPresetApi = (input: { name: string; projectId: string }) =>
  api.post<{ id: string }>("/api/admin/presets", input);

/** 덮어쓰기 — 이름은 두고 구성만 교체 */
export const overwritePresetApi = (presetId: string, projectId: string) =>
  api.put<{ ok: boolean }>(`/api/admin/presets/${presetId}`, { projectId });

export const deletePresetApi = (presetId: string) =>
  api.del<{ ok: boolean }>(`/api/admin/presets/${presetId}`);
