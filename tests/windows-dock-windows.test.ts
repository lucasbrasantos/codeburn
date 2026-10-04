import { describe, expect, it } from 'vitest'

import { dockPercent, dockWindows } from '../windows/src/lib/dockWindows'
import type { QuotaWindow } from '../windows/src/lib/quota'

const short: QuotaWindow = { label: '5-hour', usedPct: 24, resetsAt: '2026-10-04T19:00:00Z' }
const weekly: QuotaWindow = { label: 'Weekly', usedPct: 42, resetsAt: '2026-10-10T19:00:00Z' }
const monthly: QuotaWindow = { label: 'Monthly', usedPct: 80 }

describe('Windows dock quota window selection', () => {
  it('keeps the weekly default even when another window is closer to exhaustion', () => {
    expect(dockWindows([short, monthly, weekly], 'billing')).toEqual([weekly])
  })

  it('falls back to monthly, then the most consumed window for the billing default', () => {
    expect(dockWindows([short, monthly], 'billing')).toEqual([monthly])
    expect(dockWindows([{ label: 'Credits', usedPct: 90 }, short], 'billing')).toEqual([
      { label: 'Credits', usedPct: 90 },
    ])
  })

  it('selects the Codex 5-hour quota separately from weekly', () => {
    expect(dockWindows([weekly, short], 'burst')).toEqual([short])
  })

  it('reports both Codex windows in short-then-billing order without altering reset times', () => {
    expect(dockWindows([weekly, short], 'both')).toEqual([short, weekly])
  })

  it('prefers the 5-hour quota over other short horizons', () => {
    const hourly: QuotaWindow = { label: 'Hourly', usedPct: 99 }
    expect(dockWindows([hourly, weekly, short], 'burst')).toEqual([short])
  })

  it.each(['Current session', 'Hourly', 'Daily', 'Today', '15-minute', 'Five-hour'])(
    'supports the short window label %s reported by other providers', label => {
      const burst: QuotaWindow = { label, usedPct: 12 }
      expect(dockWindows([weekly, burst], 'burst')).toEqual([burst])
    },
  )

  it('does not mistake a billing label mentioning a session for a short quota', () => {
    const sessionBilling: QuotaWindow = { label: 'Weekly session allowance', usedPct: 80 }
    const session: QuotaWindow = { label: 'Current session', usedPct: 30 }
    expect(dockWindows([sessionBilling, session], 'burst')).toEqual([session])
  })

  it.each(['billing', 'burst', 'both'] as const)('keeps a single available weekly quota in %s mode', mode => {
    expect(dockWindows([weekly], mode)).toEqual([weekly])
  })

  it('keeps a lone short quota once when both windows are requested', () => {
    expect(dockWindows([short], 'both')).toEqual([short])
  })

  it('falls back to the headline when a provider has no recognized short window', () => {
    expect(dockWindows([monthly], 'burst')).toEqual([monthly])
    expect(dockWindows([{ label: 'Credits', usedPct: 40 }], 'both')).toEqual([
      { label: 'Credits', usedPct: 40 },
    ])
  })

  it('deduplicates repeated labels regardless of their casing or surrounding whitespace', () => {
    const duplicate: QuotaWindow = { label: ' 5-HOUR ', usedPct: 90 }
    expect(dockWindows([short, duplicate], 'both')).toEqual([short])
  })

  it.each(['billing', 'burst', 'both'] as const)('returns no windows for an empty %s quota', mode => {
    expect(dockWindows([], mode)).toEqual([])
  })

  it('accepts an immutable snapshot without changing window order or values', () => {
    const windows = Object.freeze([Object.freeze(weekly), Object.freeze(short)])
    expect(dockWindows(windows, 'both')).toEqual([short, weekly])
    expect(windows).toEqual([weekly, short])
  })
})

describe('Windows dock displayed quota percentage', () => {
  it.each([
    [0, 0, 100],
    [100, 100, 0],
    [24, 24, 76],
    [24.5, 25, 76],
    [99.8, 100, 0],
    [-10, 0, 100],
    [110, 100, 0],
  ])('displays %s%% used as %s%% used or %s%% remaining', (input, used, remaining) => {
    expect(dockPercent(input, 'used')).toBe(used)
    expect(dockPercent(input, 'remaining')).toBe(remaining)
  })

  it.each([NaN, Infinity, -Infinity])('never reports capacity remaining from invalid input %s', input => {
    expect(dockPercent(input, 'used')).toBe(0)
    expect(dockPercent(input, 'remaining')).toBe(0)
  })
})
