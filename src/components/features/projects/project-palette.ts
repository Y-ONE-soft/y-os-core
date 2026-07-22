// 프로젝트 색 하나에서 단계·할일 색을 파생한다.
// 색상(hue)은 프로젝트 색 그대로 두고 **명도·채도만** 바꿔, 캘린더·타임라인·보드
// 어디서 봐도 "같은 프로젝트"로 읽히게 하는 것이 목적이다.
//
// 파생은 저장하지 않고 화면에서 계산한다(board-store). 저장해 두면 나중에
// 프로젝트 색을 바꿨을 때 옛 색이 남아 다시 어긋나기 때문이다.

type Hsl = { h: number; s: number; l: number };

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function hexToHsl(hex: string): Hsl {
  const normalized = hex.replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;

  if (delta === 0) return { h: 0, s: 0, l: l * 100 };

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / delta) % 6;
  else if (max === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;
  h *= 60;
  if (h < 0) h += 360;

  return { h, s: s * 100, l: l * 100 };
}

export function hslToHex({ h, s, l }: Hsl): string {
  const saturation = clamp(s, 0, 100) / 100;
  const lightness = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lightness - c / 2;

  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];

  const hex = (value: number) =>
    Math.round((value + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * 단계 톤 사다리 — 순번에 따라 명도·채도만 흔든다.
 * 인접한 단계끼리 확실히 구분되도록 밝기를 번갈아 배치하고,
 * 밝아질수록 채도를 조금 낮춰 원색이 튀지 않게 한다.
 */
const STAGE_TONE_STEPS = [
  { dl: 8, ds: 0 },
  { dl: -12, ds: 4 },
  { dl: 14, ds: -10 },
  { dl: -4, ds: -6 },
  { dl: 11, ds: -16 },
  { dl: -8, ds: 8 },
];

/** 막대·점이 배경 위에서 읽히는 범위 — 너무 밝거나 어두워지지 않게 가둔다 */
const L_MIN = 32;
const L_MAX = 72;
const S_MIN = 32;
const S_MAX = 95;

/**
 * 톤 사다리의 기준 명도. 프로젝트 색이 아주 밝거나 어두우면 사다리가 상·하한에
 * 눌려 서로 다른 순번이 같은 톤이 되어버린다. 기준을 중간대로 당겨 간격을 지킨다.
 */
const ANCHOR_MIN = 46;
const ANCHOR_MAX = 58;

/** 프로젝트 색 + 단계 순번 → 같은 색상의 단계 톤 */
export function stageTone(projectColor: string, index: number): string {
  const base = hexToHsl(projectColor);
  const step = STAGE_TONE_STEPS[index % STAGE_TONE_STEPS.length];
  const anchor = clamp(base.l, ANCHOR_MIN, ANCHOR_MAX);
  return hslToHex({
    h: base.h,
    s: clamp(base.s + step.ds, S_MIN, S_MAX),
    l: clamp(anchor + step.dl, L_MIN, L_MAX),
  });
}

/** 할일 톤 — 소속 단계보다 한 단계 옅게 (같은 색상 계열 유지) */
export function taskTone(stageColor: string): string {
  const base = hexToHsl(stageColor);
  return hslToHex({
    h: base.h,
    s: clamp(base.s - 12, S_MIN, S_MAX),
    l: clamp(base.l + 12, L_MIN, L_MAX + 6),
  });
}
