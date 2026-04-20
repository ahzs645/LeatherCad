import type { ReactNode } from 'react'

export type TopbarCommand = {
  id: string
  label: ReactNode
  disabled?: boolean
  title?: string
  run: () => void
}

export type TopbarSection = {
  id: string
  label: string
  commands: TopbarCommand[]
}
