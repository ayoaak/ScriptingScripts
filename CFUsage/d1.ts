import type { Profile, UsageSnapshot } from './types'
import { isSnapshotCurrent } from './limits'

export type D1Usage = { rowsRead: number; rowsWritten: number }
export type D1Meter = { used: number; limit: number; ratio: number }
export type D1Meters = { read: D1Meter; write: D1Meter }

/** Included rows, measured independently; never substitute Workers requests. */
export function d1MetersFor(
  profile: Profile,
  snapshot?: UsageSnapshot,
  now = Date.now()
): D1Meters | null {
  if (snapshot?.d1 == null || !isSnapshotCurrent(snapshot, now)) return null
  const { rowsRead, rowsWritten } = snapshot.d1
  if (![rowsRead, rowsWritten].every(n => Number.isFinite(n) && n >= 0)) return null
  const free = profile.plan === 'free'
  const readLimit = free ? 5_000_000 : 25_000_000_000
  const writeLimit = free ? 100_000 : 50_000_000
  return {
    read: { used: rowsRead, limit: readLimit, ratio: rowsRead / readLimit },
    write: { used: rowsWritten, limit: writeLimit, ratio: rowsWritten / writeLimit }
  }
}

/** Missing fields are unavailable, while a successful empty result means zero. */
export function sumD1(rows: { sum: Partial<D1Usage> }[]): D1Usage | undefined {
  let rowsRead = 0
  let rowsWritten = 0
  for (const row of rows) {
    const read = row.sum?.rowsRead
    const write = row.sum?.rowsWritten
    if (typeof read !== 'number' || typeof write !== 'number' ||
        !Number.isFinite(read) || !Number.isFinite(write) || read < 0 || write < 0) return undefined
    rowsRead += read
    rowsWritten += write
  }
  return { rowsRead, rowsWritten }
}
