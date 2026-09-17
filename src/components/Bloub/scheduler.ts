import { AppState, type AppStateStatus } from 'react-native'

export type TickCallback = (ms: number) => void

/** Frames per second the shared loop aims for. */
export const TARGET_FPS = 30
/** Subscriber groups; one lane runs per dispatch, so each subscriber updates at TARGET_FPS / LANES. */
export const LANES = 2

const FRAME_MS = 1000 / TARGET_FPS

const schedule = (cb: (ms: number) => void): number => {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(cb)
  return setTimeout(() => cb(Date.now()), 16) as unknown as number
}

const cancel = (id: number) => {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id)
  else clearTimeout(id)
}

const subscribers = new Map<TickCallback, number>()

let nextLane = 0
let counter = 0
let lastDispatch = 0
let handle = 0
let running = false
let appStateBound = false
/** 'unknown' is the initial iOS value, so only the two clear pause states count as background. */
let active = AppState.currentState !== 'background' && AppState.currentState !== 'inactive'

const onAppStateChange = (next: AppStateStatus) => {
  const nextActive = next !== 'background' && next !== 'inactive'
  if (nextActive === active) return
  active = nextActive
  if (active) {
    // Let the first frame through right away. Subscribers clamp their own dt.
    lastDispatch = 0
    start()
  } else {
    stop()
  }
}

const bindAppState = () => {
  if (appStateBound) return
  appStateBound = true
  AppState.addEventListener('change', onAppStateChange)
}

function start() {
  if (running || !active || subscribers.size === 0) return
  running = true
  handle = schedule(tick)
}

function stop() {
  if (!running) return
  running = false
  cancel(handle)
  handle = 0
}

function tick(ms: number) {
  if (!running) return
  if (!active || subscribers.size === 0) {
    running = false
    return
  }
  if (ms - lastDispatch < FRAME_MS) {
    // Skipped frames are dropped, never queued.
    handle = schedule(tick)
    return
  }
  lastDispatch = ms
  const lane = counter % LANES
  counter += 1
  // Snapshot the keys: a callback may unsubscribe or subscribe during the dispatch.
  for (const cb of [...subscribers.keys()]) {
    if (subscribers.get(cb) === lane) cb(ms)
  }
  if (running) handle = schedule(tick)
}

export function subscribeTick(cb: TickCallback): () => void {
  bindAppState()
  subscribers.set(cb, nextLane)
  nextLane = (nextLane + 1) % LANES
  start()
  return () => {
    subscribers.delete(cb)
    if (subscribers.size === 0) stop()
  }
}
