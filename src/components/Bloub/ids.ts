/**
 * Typed id lists for the Bloub avatar, plus friendly labels and resolution of
 * prop values. The canonical ids are the ones the ported engine defines
 * (src/components/Bloub/engine); English aliases are accepted so props like
 * shape="round" or expression="happy" work.
 */

import { COLORS, type ColorId } from './engine/skins'
import { SHAPES, type ShapeId } from './engine/skins'
import { EXPRESSIONS, type ExpressionId } from './engine/expressions'
import { SEQUENCE, type StateId } from './engine/states'

export type { ColorId, ShapeId, ExpressionId, StateId }

export const STATE_IDS: readonly StateId[] = SEQUENCE

export const SHAPE_IDS: readonly ShapeId[] = SHAPES.map((s) => s.id)

export const SHAPE_LABELS: Record<ShapeId, string> = {
  cercle: 'Circle',
  galet: 'Pebble',
  squircle: 'Squircle',
  capsule: 'Capsule',
  triangle: 'Triangle',
  hexagone: 'Hexagon',
  nuage: 'Cloud',
  goutte: 'Droplet'
}

export interface ColorOption {
  id: ColorId
  hex: string
  label: string
}

export const COLOR_PALETTE: readonly ColorOption[] = COLORS.map((c) => ({
  id: c.id,
  hex: c.hex,
  label: LABELS_COLOR[c.id]
}))

const LABELS_COLOR: Record<ColorId, string> = {
  encre: 'Ink',
  creme: 'Cream',
  brun: 'Brown',
  rouge: 'Red',
  orange: 'Orange',
  ambre: 'Amber',
  vert: 'Green',
  turquoise: 'Turquoise',
  bleu: 'Blue',
  violet: 'Violet',
  rose: 'Pink',
  gris: 'Grey'
}

export interface ExpressionOption {
  id: ExpressionId
  label: string
}

export const EXPRESSION_IDS: readonly ExpressionOption[] = EXPRESSIONS.map((e) => ({
  id: e.id,
  label: LABELS_EXPRESSION[e.id]
}))

const LABELS_EXPRESSION: Record<ExpressionId, string> = {
  neutre: 'Neutral',
  attentif: 'Attentive',
  surpris: 'Surprised',
  excite: 'Excited',
  heureux: 'Happy',
  hilare: 'Laughing',
  colere: 'Angry',
  triste: 'Sad',
  effraye: 'Scared',
  mefiant: 'Suspicious',
  confus: 'Confused',
  curieux: 'Curious',
  fier: 'Proud',
  timide: 'Shy',
  blase: 'Unimpressed',
  somnolent: 'Sleepy'
}

const SHAPE_ALIASES: Record<string, ShapeId> = {
  round: 'cercle',
  circle: 'cercle',
  pebble: 'galet',
  squircle: 'squircle',
  capsule: 'capsule',
  triangle: 'triangle',
  hexagon: 'hexagone',
  cloud: 'nuage',
  droplet: 'goutte'
}

const EXPRESSION_ALIASES: Record<string, ExpressionId> = {
  neutral: 'neutre',
  attentive: 'attentif',
  surprised: 'surpris',
  excited: 'excite',
  happy: 'heureux',
  laughing: 'hilare',
  angry: 'colere',
  sad: 'triste',
  scared: 'effraye',
  suspicious: 'mefiant',
  confused: 'confus',
  curious: 'curieux',
  proud: 'fier',
  shy: 'timide',
  unimpressed: 'blase',
  sleepy: 'somnolent'
}

const COLOR_ALIASES: Record<string, ColorId> = {
  ink: 'encre',
  cream: 'creme',
  brown: 'brun',
  red: 'rouge',
  orange: 'orange',
  amber: 'ambre',
  green: 'vert',
  turquoise: 'turquoise',
  blue: 'bleu',
  violet: 'violet',
  pink: 'rose',
  grey: 'gris',
  gray: 'gris'
}

export function resolveState(id: string | undefined): StateId {
  const fallback: StateId = 'idle'
  if (!id) return fallback
  const known = (SEQUENCE as readonly string[]).includes(id) || id === 'swirl'
  return known ? (id as StateId) : fallback
}

export function resolveShape(id: string | undefined): ShapeId {
  if (!id) return 'cercle'
  const alias = SHAPE_ALIASES[id]
  if (alias) return alias
  return (SHAPE_IDS as readonly string[]).includes(id) ? (id as ShapeId) : 'cercle'
}

export function resolveExpression(id: string | undefined): ExpressionId {
  if (!id) return 'neutre'
  return EXPRESSION_ALIASES[id] ?? (EXPRESSION_IDS.some((e) => e.id === id) ? (id as ExpressionId) : 'neutre')
}

export function resolveColor(color: string | undefined): string {
  if (!color) return '#0a0a0c'
  if (color.startsWith('#')) return color
  const aliased = COLOR_ALIASES[color]
  if (aliased) {
    const entry = COLORS.find((c) => c.id === aliased)
    if (entry) return entry.hex
  }
  const direct = COLORS.find((c) => c.id === color)
  return direct ? direct.hex : '#0a0a0c'
}
