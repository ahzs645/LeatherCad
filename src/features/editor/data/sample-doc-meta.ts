export type PresetMeta = {
  id: string
  label: string
}

export const PRESET_META: PresetMeta[] = [
  {
    id: 'wallet',
    label: 'Wallet',
  },
  {
    id: 'card-sleeve',
    label: 'Card Sleeve',
  },
  {
    id: 'trifold',
    label: 'Tri-fold Layout',
  },
]

export const DEFAULT_PRESET_ID = PRESET_META[0].id
