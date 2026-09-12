import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Circle, Defs, G, LinearGradient, Mask, Path, Rect, Stop, Svg } from 'react-native-svg'
import { NOTIF_BLUE, type DotRender } from './engine/decor'
import { BotEngine, type BotFrame } from './engine/engine'
import { EXPRESSION_BY_ID } from './engine/expressions'
import { clamp, easings } from './engine/math'
import { DEMI_VIEWBOX, RAYON } from './engine/repere'
import { SHAPE_BY_ID, mixHex } from './engine/skins'
import { STATE_BY_ID } from './engine/states'
import { GazeScript, TURN_TIME, lookTarget } from './gaze'
import { resolveColor, resolveExpression, resolveShape, resolveState } from './ids'

const R = RAYON
const VB = DEMI_VIEWBOX
const SCRIPT_MORPH = 1 / 60

export interface BloubProps {
  /** one of STATE_IDS (14) or the extra 'swirl' transition state */
  state?: string
  size?: number
  /** one of SHAPE_IDS (8) or an English alias like "round" */
  shape?: string
  /** hex string (e.g. "#4F8CFF") or a COLOR_PALETTE id/alias */
  color?: string
  /** one of EXPRESSION_IDS (16) or an English alias like "happy" */
  expression?: string
  /** background colour behind the eye holes, used for depth fog of particles */
  paper?: string
  /** freeze the render at this time (seconds within the state) — no loop */
  frozenAt?: number
  /** clock speed multiplier for the animation loop */
  playSpeed?: number
  /** normalised gaze target, each axis -1..1; only affects baseFace states */
  follow?: { x: number; y: number }
  /** scripted gaze, evaluated each frame with elapsed seconds */
  gaze?: GazeScript
  /** run the rAF loop; default false renders one frozen frame for cheap lists */
  animate?: boolean
}

const schedule = (cb: (ms: number) => void): number => {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(cb)
  return setTimeout(() => cb(Date.now()), 16) as unknown as number
}

const cancel = (id: number) => {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id)
  else clearTimeout(id)
}

function BloubImpl({
  state = 'idle',
  size = 320,
  shape = 'cercle',
  color = '#0a0a0c',
  expression = 'neutre',
  paper = '#f9f9f9',
  frozenAt,
  playSpeed = 1,
  follow,
  gaze,
  animate = false
}: BloubProps) {
  const uid = useRef(`bloub-${Math.random().toString(36).slice(2, 10)}`).current
  const maskId = `${uid}-mask`

  const stateId = resolveState(state)
  const shapeId = resolveShape(shape)
  const exprId = resolveExpression(expression)
  const ink = resolveColor(color)
  const radii = SHAPE_BY_ID.get(shapeId)?.radii ?? null
  const expr = EXPRESSION_BY_ID.get(exprId) ?? null

  const frozen = !animate || frozenAt !== undefined

  const frozenFrame = useMemo<BotFrame>(() => {
    const eng = new BotEngine(R, stateId, radii, expr)
    return eng.sample(frozenAt ?? 0)
  }, [stateId, radii, expr, frozenAt])

  const [liveFrame, setLiveFrame] = useState<BotFrame | null>(null)
  const frameRef = useRef({ state: stateId, radii, expr })
  const clockRef = useRef({ value: 0, turnSince: 0, gazeSince: 0, aiming: false })
  const gazeRef = useRef<GazeScript | null>(null)
  const propsRef = useRef({ stateId, radii, expr, playSpeed, follow, gaze })
  propsRef.current = { stateId, radii, expr, playSpeed, follow, gaze }

  useEffect(() => {
    if (frozen) return
    const engine = new BotEngine(R, stateId, radii, expr)
    frameRef.current = { state: stateId, radii, expr }
    let raf = 0
    let last = 0

    const tick = (ms: number) => {
      raf = schedule(tick)
      const dt = last ? Math.min((ms - last) / 1000, 0.064) : 0
      last = ms
      const clock = clockRef.current
      clock.value += dt * propsRef.current.playSpeed
      const t = clock.value

      const want = propsRef.current
      const held = frameRef.current
      if (want.stateId !== held.state) {
        engine.setState(want.stateId, t)
        held.state = want.stateId
      }
      if (want.radii !== held.radii) {
        engine.setShape(want.radii, t)
        held.radii = want.radii
      }
      if (want.expr !== held.expr) {
        engine.setExpression(want.expr, t)
        held.expr = want.expr
      }

      const f = want.follow
      if (f !== undefined) {
        const def = STATE_BY_ID.get(engine.state)
        if (def?.baseFace) {
          if (!clock.aiming) {
            clock.turnSince = t
            clock.aiming = true
          }
          const tour = easings.easeOutQuint(clamp((t - clock.turnSince) / TURN_TIME))
          engine.setLook(
            lookTarget({
              nx: clamp(f.x, -1, 1),
              ny: clamp(f.y, -1, 1),
              tour,
              pointer: true
            }),
            t
          )
        } else {
          engine.setLook(null, t)
          clock.aiming = false
        }
      } else if (clock.aiming) {
        engine.setLook(null, t)
        clock.aiming = false
      }

      const g = want.gaze
      if (g) {
        if (gazeRef.current !== g) {
          gazeRef.current = g
          clock.gazeSince = t
          engine.setLook(g(0), t - SCRIPT_MORPH, SCRIPT_MORPH)
        } else {
          engine.setLook(g(t - clock.gazeSince), t, SCRIPT_MORPH)
        }
      } else if (gazeRef.current) {
        gazeRef.current = null
        engine.setLook(null, t)
      }

      setLiveFrame(engine.sample(t))
    }

    raf = schedule(tick)
    return () => cancel(raf)
    // engine is (re)created when the loop starts; per-frame prop sync happens via propsRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frozen])

  const frame = frozen ? frozenFrame : liveFrame
  if (!frame) return null

  const dotFill = (dot: DotRender) =>
    dot.color ?? (dot.depth === undefined ? ink : mixHex(paper, ink, dot.depth))

  const dotEl = (dot: DotRender, key: string) =>
    dot.d ? (
      <Path
        key={key}
        d={dot.d}
        fill={dotFill(dot)}
        opacity={dot.opacity}
        transform={`translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(${R})`}
      />
    ) : (
      <Circle key={key} cx={dot.x} cy={dot.y} r={dot.r} fill={dotFill(dot)} opacity={dot.opacity} />
    )

  return (
    <Svg width={size} height={size} viewBox={`${-VB} ${-VB} ${VB * 2} ${VB * 2}`}>
      <Defs>
        <Mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          x={-VB}
          y={-VB}
          width={VB * 2}
          height={VB * 2}
        >
          <Path d={frame.bodyPath} fill="#fff" />
          {frame.eyes.map((eye, i) => (
            <Path key={i} d={eye.d} transform={eye.matrix} opacity={eye.alpha} fill="#000" />
          ))}
          {frame.notch ? (
            <Circle cx={frame.notch.x} cy={frame.notch.y} r={frame.notch.r} fill="#000" />
          ) : null}
        </Mask>
        {frame.arcs.map((arc) => (
          <LinearGradient
            key={arc.id}
            id={`${uid}-${arc.id}`}
            gradientUnits="userSpaceOnUse"
            x1={arc.grad.x1}
            y1={arc.grad.y1}
            x2={arc.grad.x2}
            y2={arc.grad.y2}
          >
            {arc.grad.stops.map((c, i) => (
              <Stop key={i} offset={i / (arc.grad.stops.length - 1)} stopColor={c} />
            ))}
          </LinearGradient>
        ))}
      </Defs>

      <G fill="none" strokeLinecap="round">
        {frame.arcs.map((arc) => (
          <Path
            key={`b${arc.id}`}
            d={arc.back}
            stroke={`url(#${uid}-${arc.id})`}
            strokeWidth={arc.width}
            opacity={arc.opacity}
          />
        ))}
      </G>

      {frame.dotsBehind ? <G>{frame.dots.map((dot, i) => dotEl(dot, `pb${i}`))}</G> : null}

      <G opacity={frame.bodyAlpha}>
        <Path d={frame.bodyPath} fill={paper} />
        <G mask={`url(#${maskId})`}>
          <Rect x={-VB} y={-VB} width={VB * 2} height={VB * 2} fill={ink} />
        </G>
      </G>

      {!frame.dotsBehind ? <G>{frame.dots.map((dot, i) => dotEl(dot, `pf${i}`))}</G> : null}

      {frame.notif ? (
        <Circle cx={frame.notif.x} cy={frame.notif.y} r={frame.notif.r} fill={NOTIF_BLUE} />
      ) : null}

      <G fill="none" strokeLinecap="round">
        {frame.arcs.map((arc) => (
          <Path
            key={`f${arc.id}`}
            d={arc.front}
            stroke={`url(#${uid}-${arc.id})`}
            strokeWidth={arc.width}
            opacity={arc.opacity}
          />
        ))}
      </G>
    </Svg>
  )
}

export const Bloub = memo(BloubImpl)
export default Bloub
