/** Portable split arithmetic. No Prisma, browser, or native dependencies. */
export type SplitMode = 'EQUAL' | 'PERCENTAGE' | 'EXACT' | 'RATIO'
export type SplitConfiguration = {
  version: 1
  mode: SplitMode
  participants: { userId: string; value: string }[]
  remainderUserId?: string
}
export const SPLIT_MODES: { value: SplitMode; label: string }[] = [
  { value: 'EQUAL', label: 'Equal' }, { value: 'PERCENTAGE', label: 'Percentage' },
  { value: 'EXACT', label: 'Exact amount' }, { value: 'RATIO', label: 'Ratio' },
]
const MAX_CENTS = 1_000_000_000_000
const MAX_PEOPLE = 50
const MAX_INSTALLMENTS = 120

export class SplitValidationError extends Error {
  constructor(message: string, public readonly code: 'INVALID_SPLIT' | 'CONFLICT' | 'UNAVAILABLE' = 'INVALID_SPLIT') { super(message); this.name = 'SplitValidationError' }
}
const fail = (message: string): never => { throw new SplitValidationError(message) }

/** Parses decimal text without floating-point multiplication or rounding inputs. */
export function decimalUnits(input: string | number, decimals = 2): number {
  const text = String(input).trim()
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${decimals}})?$`).test(text)) {
    return fail(`Enter a nonnegative number with at most ${decimals} decimal places.`)
  }
  const [whole, fraction = ''] = text.split('.')
  const units = Number(whole) * 10 ** decimals + Number(fraction.padEnd(decimals, '0'))
  if (!Number.isSafeInteger(units) || units > MAX_CENTS) return fail('Amount exceeds the supported limit.')
  return units
}

export function unitsText(units: number): string {
  return `${Math.floor(units / 100)}.${String(units % 100).padStart(2, '0')}`
}

export function isLiabilitySatisfied(row: { amountDue: unknown; isPaid: boolean }): boolean {
  return Number(row.amountDue) === 0 || row.isPaid
}

function proportional(total: number, weights: number[]): number[] {
  const denominator = weights.reduce((sum, w) => sum + BigInt(w), BigInt(0))
  if (denominator <= BigInt(0)) return fail('At least one positive share is required.')
  const products = weights.map(w => BigInt(total) * BigInt(w))
  const result = products.map(p => Number(p / denominator))
  const ranked = products.map((p, i) => ({ i, remainder: p % denominator }))
    .sort((a, b) => a.remainder === b.remainder ? a.i - b.i : a.remainder > b.remainder ? -1 : 1)
  let remaining = total - result.reduce((a, b) => a + b, 0)
  for (const { i } of ranked) { if (remaining-- <= 0) break; result[i]++ }
  return result
}

export function normalizeSplit(input: unknown, userIds: string[]): SplitConfiguration {
  if (userIds.length < 2 || userIds.length > MAX_PEOPLE || new Set(userIds).size !== userIds.length || userIds.some(id => !id)) {
    return fail(`Select 2–${MAX_PEOPLE} different participants, including the primary client.`)
  }
  if (input === undefined || input === null) {
    return { version: 1, mode: 'EQUAL', participants: userIds.map(userId => ({ userId, value: '1' })) }
  }
  if (typeof input !== 'object' || Array.isArray(input)) return fail('Invalid split configuration.')
  const c = input as SplitConfiguration
  if (c.version !== 1 || !SPLIT_MODES.some(m => m.value === c.mode) || !Array.isArray(c.participants)) {
    return fail('Unsupported split configuration.')
  }
  const ids = c.participants.map(p => p?.userId)
  if (ids.length !== userIds.length || new Set(ids).size !== ids.length || ids.some(id => !userIds.includes(id))) {
    return fail('Every selected participant needs exactly one share.')
  }
  if (c.remainderUserId && (c.mode !== 'EXACT' || !ids.includes(c.remainderUserId))) return fail('Invalid remainder recipient.')
  // Configuration order, rather than database fetch order, determines rounding ties.
  const participants = c.participants.map(p => {
    if (typeof p.value !== 'string') return fail('Split values must be decimal text.')
    const value = p.value.trim()
    if (c.mode === 'RATIO' && (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 1_000_000)) {
      return fail('Ratio shares must be whole numbers between 1 and 1,000,000.')
    }
    if (c.mode !== 'EQUAL') decimalUnits(value)
    return { userId: p.userId, value: c.mode === 'EQUAL' ? '1' : value }
  })
  return { version: 1, mode: c.mode, participants, ...(c.remainderUserId ? { remainderUserId: c.remainderUserId } : {}) }
}

export function splitTargets(total: number, config: SplitConfiguration): number[] {
  if (!Number.isSafeInteger(total) || total <= 0 || total > MAX_CENTS) return fail('Enter a positive total within the supported limit.')
  const values = config.participants.map(p => config.mode === 'EQUAL' ? 1 : config.mode === 'RATIO' ? Number(p.value) : decimalUnits(p.value))
  let targets: number[]
  if (config.mode === 'EQUAL') {
    targets = values.map(() => Math.floor(total / values.length))
    targets[targets.length - 1] += total % values.length
  } else if (config.mode === 'EXACT') {
    targets = [...values]
    const remainder = total - values.reduce((a, b) => a + b, 0)
    if (config.remainderUserId) {
      if (remainder < 0) return fail('Assigned amounts exceed the total.')
      targets[config.participants.findIndex(p => p.userId === config.remainderUserId)] += remainder
    } else if (remainder !== 0) return fail('Assigned amounts must equal the order total.')
  } else {
    if (config.mode === 'PERCENTAGE' && values.reduce((a, b) => a + b, 0) !== 10_000) return fail('Percentages must total exactly 100%.')
    targets = proportional(total, values)
  }
  if (targets.some(t => t <= 0)) return fail('Each participant must owe at least ₱0.01. Remove zero-share participants or adjust the split.')
  return targets
}

/** Controlled matrix rounding: integral max-flow preserves both margins and floor/ceil bounds. */
export function allocateInstallments(total: number, rows: number[], targets: number[]): number[][] {
  if (!Number.isSafeInteger(total) || total <= 0 || total > MAX_CENTS || !targets.length || targets.length > MAX_PEOPLE || targets.some(t => !Number.isSafeInteger(t) || t < 0)) {
    return fail('Invalid order or participant totals.')
  }
  if (!rows.length || rows.length > MAX_INSTALLMENTS || rows.some(r => !Number.isSafeInteger(r) || r < 0)) {
    return fail('The installment schedule contains an invalid amount or unsupported term. Adjust the total or term.')
  }
  if (rows.reduce((a, b) => a + b, 0) !== total || targets.reduce((a, b) => a + b, 0) !== total) {
    return fail('The installment schedule does not match the order total. Correct the schedule first.')
  }
  const divisor = BigInt(total)
  const matrix = rows.map(r => targets.map(c => Number(BigInt(r) * BigInt(c) / divisor)))
  type Edge = { to: number; reverse: number; capacity: number }
  const source = rows.length + targets.length, sink = source + 1
  const graph: Edge[][] = Array.from({ length: sink + 1 }, () => [])
  function edge(from: number, to: number, capacity: number) {
    const forward = { to, reverse: graph[to].length, capacity }
    graph[from].push(forward)
    graph[to].push({ to: from, reverse: graph[from].length - 1, capacity: 0 })
    return forward
  }
  const residualEdges: { row: number; column: number; edge: Edge }[] = []
  rows.forEach((r, i) => {
    edge(source, i, r - matrix[i].reduce((a, b) => a + b, 0))
    targets.forEach((c, j) => {
      if (BigInt(r) * BigInt(c) % divisor !== BigInt(0)) residualEdges.push({ row: i, column: j, edge: edge(i, rows.length + j, 1) })
    })
  })
  targets.forEach((c, j) => edge(rows.length + j, sink, c - matrix.reduce((sum, row) => sum + row[j], 0)))
  // Residual totals are bounded by rows × participants, independent of currency magnitude.
  while (true) {
    const level = Array(graph.length).fill(-1) as number[], queue = [source]
    level[source] = 0
    for (let q = 0; q < queue.length; q++) for (const e of graph[queue[q]]) {
      if (e.capacity > 0 && level[e.to] < 0) { level[e.to] = level[queue[q]] + 1; queue.push(e.to) }
    }
    if (level[sink] < 0) break
    const next = Array(graph.length).fill(0) as number[]
    const send = (node: number, available: number): number => {
      if (node === sink) return available
      for (; next[node] < graph[node].length; next[node]++) {
        const e = graph[node][next[node]]
        if (e.capacity <= 0 || level[e.to] !== level[node] + 1) continue
        const amount = send(e.to, Math.min(available, e.capacity))
        if (amount) { e.capacity -= amount; graph[e.to][e.reverse].capacity += amount; return amount }
      }
      return 0
    }
    while (send(source, MAX_CENTS) > 0) { /* exhaust this level graph */ }
  }
  if (graph[source].some(e => e.capacity > 0)) return fail('Unable to reconcile installment shares.')
  for (const item of residualEdges) if (item.edge.capacity === 0) matrix[item.row][item.column]++
  return matrix
}

export function previewSplit(totalAmount: string | number, installments: (string | number)[], input: unknown, userIds: string[]) {
  const total = decimalUnits(totalAmount)
  const config = normalizeSplit(input, userIds)
  const targets = splitTargets(total, config)
  const matrix = allocateInstallments(total, installments.map(amount => decimalUnits(amount)), targets)
  return { config, total, targets, matrix }
}

export function previewInstallmentSplit(totalAmount: string | number, months: number, input: unknown, userIds: string[]) {
  const total = decimalUnits(totalAmount)
  if (!Number.isInteger(months) || months < 1 || months > MAX_INSTALLMENTS) return fail('Choose an installment term between 1 and 120 months.')
  const regular = Math.round(total / months)
  const schedule = Array.from({ length: months }, (_, i) => i === months - 1 ? total - regular * (months - 1) : regular)
  if (schedule.some(cents => cents < 0)) return fail('This total is too small for the selected installment term. Adjust the amount or term.')
  return previewSplit(totalAmount, schedule.map(unitsText), input, userIds)
}

/** Slider adjustments preserve locked peers and exactly 100.00%. */
export function adjustPercentage(values: number[], index: number, requested: number, locked: boolean[]): number[] {
  if (locked[index] || !Number.isInteger(requested)) return values
  const peers = values.map((_, i) => i).filter(i => i !== index && !locked[i])
  if (!peers.length) return values
  const fixed = values.reduce((sum, v, i) => sum + (i !== index && locked[i] ? v : 0), 0)
  const target = Math.max(0, Math.min(10_000 - fixed, requested))
  const weights = peers.map(i => values[i])
  const shares = proportional(10_000 - fixed - target, weights.some(v => v > 0) ? weights : peers.map(() => 1))
  const next = [...values]; next[index] = target
  peers.forEach((i, j) => { next[i] = shares[j] })
  return next
}

export function distributePercentageRemainder(values: number[], locked: boolean[]): number[] {
  if (values.some(v => !Number.isSafeInteger(v) || v < 0)) return fail('Complete the percentage inputs first.')
  const fixed = values.reduce((sum, value, i) => sum + (locked[i] ? value : 0), 0)
  const indexes = values.map((_, i) => i).filter(i => !locked[i])
  if (!indexes.length || fixed > 10000) return fail('Unlock a share before distributing the remaining percentage.')
  const weights = indexes.map(i => values[i])
  const allocated = proportional(10000 - fixed, weights.some(v => v > 0) ? weights : indexes.map(() => 1))
  const next = [...values]
  indexes.forEach((i, j) => { next[i] = allocated[j] })
  return next
}

export function participantPercentage(config: unknown, userId: string, amount: number, total: number): string {
  const c = config as SplitConfiguration | null
  const requested = c?.mode === 'PERCENTAGE' ? c.participants?.find(p => p.userId === userId)?.value : undefined
  const effective = total > 0 ? (amount / total * 100).toFixed(2) : '0.00'
  const effectiveLabel = `${Number(effective)}%`
  return requested !== undefined ? `${Number(requested)}%${Number(requested).toFixed(2) !== effective ? ` (effective ${effectiveLabel})` : ''}` : effectiveLabel
}

export function splitModeLabel(config: unknown): string {
  const c = config as SplitConfiguration | null
  const label = SPLIT_MODES.find(mode => mode.value === c?.mode)?.label ?? 'Shared allocation'
  return c?.mode === 'RATIO' && Array.isArray(c.participants) ? `${label} ${c.participants.map(p => p.value).join(':')}` : label
}
