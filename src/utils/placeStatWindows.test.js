import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { summarizeDailyStats, summarizeRange } from './placeStatWindows.js'

describe('okna statistik', () => {
  it('sečte jen dny v okně a prázdný vstup není vymyšlené číslo', () => {
    const now = new Date('2026-11-28T12:00:00Z')
    const empty = summarizeDailyStats([], now)
    assert.equal(empty.hasData, false)
    assert.equal(empty.d7.profileViews, 0)

    const windows = summarizeDailyStats(
      [
        { day: '2026-11-28', profileViews: 2, routeClicks: 1, websiteClicks: 0, phoneClicks: 0 },
        { day: '2026-10-01', profileViews: 9, routeClicks: 0, websiteClicks: 0, phoneClicks: 0 },
      ],
      now,
    )
    assert.equal(windows.d7.profileViews, 2)
    assert.equal(windows.d30.profileViews, 2)
    assert.equal(windows.all.profileViews, 11)
    assert.equal(windows.hasData, true)
  })

  it('období propagace bere jen dny mezi začátkem a koncem', () => {
    const rows = [
      { day: '2026-11-10', profileViews: 4, routeClicks: 0, websiteClicks: 1, phoneClicks: 0 },
      { day: '2026-11-20', profileViews: 3, routeClicks: 2, websiteClicks: 0, phoneClicks: 1 },
    ]
    const during = summarizeRange(rows, '2026-11-18T00:00:00Z', '2026-11-21T00:00:00Z')
    assert.equal(during.profileViews, 3)
    assert.equal(during.routeClicks, 2)
    assert.equal(during.phoneClicks, 1)
    assert.equal(summarizeRange(rows, '', '2026-11-21'), null)
  })
})
