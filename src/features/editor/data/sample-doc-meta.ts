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
    id: 'compact-clasp-wallet',
    label: 'Compact Clasp Wallet',
  },
  {
    id: 'card-sleeve',
    label: 'Card Sleeve',
  },
  {
    id: 'trifold',
    label: 'Tri-fold Layout',
  },
  {
    id: 'folding-box-net',
    label: 'Open Box Tray Net',
  },
]

export const DEFAULT_PRESET_ID = PRESET_META[0].id
