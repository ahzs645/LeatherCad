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
    label: 'Trifold Wallet Prototype',
  },
  {
    id: 'folding-box-net',
    label: 'Open Box Tray Net',
  },
  {
    id: 'card-case',
    label: 'Two-Panel Card Case',
  },
  {
    id: 'boxed-pouch',
    label: 'Boxed Zip Pouch',
  },
  {
    id: 'dice-cup',
    label: 'Round Dice Cup',
  },
  {
    id: 'tote-bag',
    label: 'Tote Bag',
  },
]

export const DEFAULT_PRESET_ID = 'trifold'
