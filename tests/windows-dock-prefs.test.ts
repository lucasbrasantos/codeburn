import { describe, expect, it } from 'vitest'

import { DEFAULT_DOCK_PREFS, parseDockPrefs } from '../windows/src/lib/dockPrefs'

describe('Windows dock quota display preferences', () => {
  it('retains billing and consumed percentages for a dock saved before the new options', () => {
    const legacy = {
      enabled: true,
      preferred: 'codex',
      providers: ['codex'],
      scale: 0.85,
      theme: 'glass',
      gaugeShape: 'squircle',
      manualSelection: true,
    }
    expect(parseDockPrefs(legacy)).toEqual({
      ...DEFAULT_DOCK_PREFS,
      ...legacy,
      glanceWindows: {},
      percentMode: 'used',
    })
  })

  it('preserves independent provider horizons and remaining percentages after a JSON round trip', () => {
    const stored = JSON.parse(JSON.stringify({
      ...DEFAULT_DOCK_PREFS,
      enabled: true,
      providers: ['codex', 'claude'],
      glanceWindows: { codex: 'both', claude: 'burst', cursor: 'billing' },
      percentMode: 'remaining',
    }))
    const prefs = parseDockPrefs(stored)
    expect(prefs.glanceWindows).toEqual({ codex: 'both', claude: 'burst', cursor: 'billing' })
    expect(prefs.percentMode).toBe('remaining')
    expect(prefs.providers).toEqual(['codex', 'claude'])
  })

  it('keeps a disconnected provider preference until that provider reconnects', () => {
    expect(parseDockPrefs({ providers: ['claude'], glanceWindows: { codex: 'burst' } }).glanceWindows)
      .toEqual({ codex: 'burst' })
  })

  it('accepts only known horizons and ignores empty provider keys', () => {
    expect(parseDockPrefs({
      glanceWindows: {
        codex: 'both',
        claude: 'burst',
        cursor: 'billing',
        copilot: 'weekly',
        other: null,
        another: true,
        '': 'both',
      },
    }).glanceWindows).toEqual({ codex: 'both', claude: 'burst', cursor: 'billing' })
  })

  it.each([undefined, null, [], ['both'], 'both', 1, true, new Date()])(
    'ignores a malformed horizon map %s', glanceWindows => {
      expect(parseDockPrefs({ glanceWindows }).glanceWindows).toEqual({})
    },
  )

  it('accepts a map without an object prototype', () => {
    const glanceWindows = Object.create(null)
    glanceWindows.codex = 'both'
    expect(parseDockPrefs({ glanceWindows }).glanceWindows).toEqual({ codex: 'both' })
  })

  it('does not interpret inherited properties as saved provider settings', () => {
    const glanceWindows = Object.create({ codex: 'burst' })
    glanceWindows.claude = 'both'
    expect(parseDockPrefs({ glanceWindows }).glanceWindows).toEqual({})
  })

  it.each([undefined, null, true, 'inverse', 'Remaining', 1, {}])(
    'retains consumed percentage mode for an invalid value %s', percentMode => {
      expect(parseDockPrefs({ percentMode }).percentMode).toBe('used')
    },
  )

  it('accepts an explicit consumed percentage preference', () => {
    expect(parseDockPrefs({ percentMode: 'used' }).percentMode).toBe('used')
  })
})
