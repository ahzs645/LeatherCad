import { act, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type RenderResult = {
  container: HTMLDivElement
  rerender: (element: ReactElement) => void
  unmount: () => void
}

export function renderForTest(element: ReactElement): RenderResult {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  act(() => {
    root.render(element)
  })

  return {
    container,
    rerender(nextElement) {
      act(() => {
        root.render(nextElement)
      })
    },
    unmount() {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

export function cleanupRender(result: RenderResult | null) {
  result?.unmount()
}

export function click(node: Element | null) {
  if (!node) {
    throw new Error('Missing element for click()')
  }
  act(() => {
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

export function changeValue(node: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null, value: string) {
  if (!node) {
    throw new Error('Missing form field for changeValue()')
  }
  act(() => {
    const prototype =
      node instanceof HTMLInputElement
        ? HTMLInputElement.prototype
        : node instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLSelectElement.prototype
    const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
    valueSetter?.call(node, value)
    node.dispatchEvent(new Event('input', { bubbles: true }))
    node.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

export function pointerDown(node: Element | null, init: PointerEventInit = {}) {
  if (!node) {
    throw new Error('Missing element for pointerDown()')
  }
  const PointerEventCtor = window.PointerEvent ?? window.MouseEvent
  act(() => {
    node.dispatchEvent(
      new PointerEventCtor('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        clientX: 400,
        ...init,
      }),
    )
  })
}

export function getByText<T extends Element>(container: ParentNode, selector: string, text: string): T {
  const match = Array.from(container.querySelectorAll(selector)).find((node) => node.textContent?.trim() === text)
  if (!match) {
    throw new Error(`Unable to find ${selector} with text "${text}"`)
  }
  return match as T
}
