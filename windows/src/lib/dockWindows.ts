import type { DockPercentMode, DockWindowMode } from './dockPrefs'
import { headlineWindow, pct, type QuotaWindow } from './quota'

const BILLING_LABEL = /week|month/i
const BURST_LABEL = /hour|session|daily|today|minute/i
const FIVE_HOUR_LABEL = /\b(?:5|five)[\s-]+hours?\b/i

/// A stored horizon can outlive the quota a provider reports. Keep its existing headline
/// as the fallback so a provider with only one window never loses its dock percentage.
export function dockWindows(windows: readonly QuotaWindow[], mode: DockWindowMode): QuotaWindow[] {
  const billing = headlineWindow([...windows])
  if (!billing) return []
  if (mode === 'billing') return [billing]

  const shortWindows = windows.filter(row => !BILLING_LABEL.test(row.label) && BURST_LABEL.test(row.label))
  const burst = shortWindows.find(row => FIVE_HOUR_LABEL.test(row.label)) ?? shortWindows[0] ?? billing
  if (mode === 'burst') return [burst]

  return burst.label.trim().toLowerCase() === billing.label.trim().toLowerCase()
    ? [burst]
    : [burst, billing]
}

/// Invert the raw percentage before rounding; 24.5% used means 75.5%, rounded to 76%,
/// remaining. Invalid data must never turn into a claim of 100% remaining capacity.
export function dockPercent(usedPct: number, mode: DockPercentMode): number {
  if (!Number.isFinite(usedPct)) return 0
  const used = Math.min(100, Math.max(0, usedPct))
  return pct(mode === 'remaining' ? 100 - used : used)
}
