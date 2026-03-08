/**
 * PBR material presets for different leather types in 3D preview.
 *
 * Each preset defines MeshStandardMaterial properties for realistic
 * leather rendering with appropriate roughness, metalness, and color.
 */

export type LeatherPreset = {
  id: string
  label: string
  color: string
  roughness: number
  metalness: number
  normalScale: number
  /** Bump map intensity (for grain texture simulation) */
  bumpScale: number
  /** Environment map intensity */
  envMapIntensity: number
}

export const LEATHER_PRESETS: Record<string, LeatherPreset> = {
  'full-grain': {
    id: 'full-grain',
    label: 'Full Grain',
    color: '#8a6742',
    roughness: 0.82,
    metalness: 0.02,
    normalScale: 1.2,
    bumpScale: 0.15,
    envMapIntensity: 0.3,
  },
  'top-grain': {
    id: 'top-grain',
    label: 'Top Grain',
    color: '#9b7653',
    roughness: 0.75,
    metalness: 0.03,
    normalScale: 0.8,
    bumpScale: 0.08,
    envMapIntensity: 0.4,
  },
  suede: {
    id: 'suede',
    label: 'Suede',
    color: '#a08060',
    roughness: 0.97,
    metalness: 0.0,
    normalScale: 1.5,
    bumpScale: 0.25,
    envMapIntensity: 0.1,
  },
  patent: {
    id: 'patent',
    label: 'Patent',
    color: '#2c1810',
    roughness: 0.15,
    metalness: 0.08,
    normalScale: 0.3,
    bumpScale: 0.02,
    envMapIntensity: 0.9,
  },
  nubuck: {
    id: 'nubuck',
    label: 'Nubuck',
    color: '#b8956a',
    roughness: 0.92,
    metalness: 0.01,
    normalScale: 1.0,
    bumpScale: 0.18,
    envMapIntensity: 0.15,
  },
  'veg-tan': {
    id: 'veg-tan',
    label: 'Vegetable Tanned',
    color: '#c4a46c',
    roughness: 0.85,
    metalness: 0.02,
    normalScale: 0.9,
    bumpScale: 0.12,
    envMapIntensity: 0.25,
  },
  'chrome-tan': {
    id: 'chrome-tan',
    label: 'Chrome Tanned',
    color: '#6b4c3b',
    roughness: 0.78,
    metalness: 0.04,
    normalScale: 0.7,
    bumpScale: 0.10,
    envMapIntensity: 0.35,
  },
  'exotic-croc': {
    id: 'exotic-croc',
    label: 'Crocodile',
    color: '#3d2b1f',
    roughness: 0.65,
    metalness: 0.05,
    normalScale: 2.0,
    bumpScale: 0.30,
    envMapIntensity: 0.5,
  },
}

export const PRESET_IDS: string[] = Object.keys(LEATHER_PRESETS)

/**
 * Predefined leather colors for quick selection.
 */
export const LEATHER_COLORS = [
  { id: 'natural', label: 'Natural', color: '#c4a46c' },
  { id: 'saddle-tan', label: 'Saddle Tan', color: '#8a6742' },
  { id: 'brown', label: 'Brown', color: '#6b4c3b' },
  { id: 'dark-brown', label: 'Dark Brown', color: '#3d2b1f' },
  { id: 'black', label: 'Black', color: '#1a1a1a' },
  { id: 'burgundy', label: 'Burgundy', color: '#722f37' },
  { id: 'navy', label: 'Navy', color: '#2c3e50' },
  { id: 'olive', label: 'Olive', color: '#556b2f' },
  { id: 'oxblood', label: 'Oxblood', color: '#4a0000' },
  { id: 'honey', label: 'Honey', color: '#d4a850' },
]
