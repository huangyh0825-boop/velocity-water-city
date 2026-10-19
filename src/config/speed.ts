/** Speeds shown to players are km/h; physics and AI operate in m/s. */
export const SPEED_TUNING = {
  player: {
    maxKmh: 180,
    launchAcceleration: 14,
    topSpeedAcceleration: 10,
  },
  normalAI: {
    maxKmh: [175, 170, 165, 160] as const,
    acceleration: 12,
  },
  // Calibrated on the full 4.75km city course, including corners and shortcuts.
  cityAI: {
    maxKmh: [225, 200, 180, 160] as const,
    acceleration: 12,
  },
} as const;
export const kmhToMps = (kmh: number) => kmh / 3.6;
