import { expect, test, type Page } from '@playwright/test'

/**
 * The agent half of the app, driven the way an agent drives it.
 *
 * No browser in CI ships WebMCP yet, so the page's own registration path is
 * exercised against a stub `document.modelContext` installed before the app
 * loads — the same shape the spec defines. Everything after that is real: the
 * tools registered here are the tools the app publishes, and calling one runs
 * it against the live editor state and the canvas the user is looking at.
 */
type ToolResult = { content: Array<{ text: string }> }
type ToolExecute = (input: unknown) => Promise<ToolResult>

/**
 * The page globals this spec reaches for, typed here because the e2e project
 * compiles without the DOM lib.
 */
type PageGlobals = {
  document: { modelContext?: unknown }
  __webmcpTools?: Record<string, ToolExecute>
}

async function installModelContextStub(page: Page) {
  await page.addInitScript(() => {
    const host = globalThis as unknown as PageGlobals
    const tools: Record<string, ToolExecute> = {}
    Object.defineProperty(host.document, 'modelContext', {
      configurable: true,
      value: {
        registerTool(tool: { name: string; execute: ToolExecute }) {
          tools[tool.name] = tool.execute
        },
      },
    })
    host.__webmcpTools = tools
  })
}

async function callTool(page: Page, name: string, input: Record<string, unknown> = {}) {
  const text = await page.evaluate(
    async ([toolName, args]) => {
      const host = globalThis as unknown as PageGlobals
      const execute = host.__webmcpTools?.[toolName]
      if (!execute) {
        throw new Error(`Tool ${String(toolName)} was never registered`)
      }
      const result = await execute(args)
      return result.content.map((part) => part.text).join('\n')
    },
    [name, input] as const,
  )
  return JSON.parse(text) as Record<string, unknown>
}

test.describe('WebMCP agent tools', () => {
  test.beforeEach(async ({ page }) => {
    await installModelContextStub(page)
    await page.goto('/')
  })

  test('registers its tools with the page and says so', async ({ page }) => {
    await expect(page.locator('.webmcp-panel-title')).toHaveText('Agent tools live')

    const names = await page.evaluate(() =>
      Object.keys((globalThis as unknown as PageGlobals).__webmcpTools ?? {}),
    )
    expect(names).toContain('create_pattern_piece')
    expect(names).toContain('check_pattern')
    expect(names).toContain('estimate_material')
  })

  test('draws a piece on the canvas the user is looking at, then measures it back', async ({ page }) => {
    await expect(page.locator('.webmcp-panel-title')).toHaveText('Agent tools live')

    const created = await callTool(page, 'create_pattern_piece', {
      shape: 'rounded_rect',
      name: 'Wallet body',
      width_mm: 190,
      height_mm: 95,
      corner_radius_mm: 8,
      stitch_inset_mm: 4,
      stitch_pitch_mm: 3.85,
    })
    expect(created.ok).toBe(true)

    const listed = (await callTool(page, 'list_pattern_pieces')) as {
      pieces: Array<{ name: string; widthMm: number; stitchHoleCount: number; boundaryResolved: boolean }>
    }
    expect(listed.pieces).toHaveLength(1)
    expect(listed.pieces[0].name).toBe('Wallet body')
    expect(listed.pieces[0].boundaryResolved).toBe(true)
    expect(listed.pieces[0].widthMm).toBeGreaterThan(189)
    expect(listed.pieces[0].stitchHoleCount).toBeGreaterThan(100)

    // The write went through the editor rather than around it, so the app's own
    // status bar has moved: the agent's layer is active and its new shapes are
    // the selection the user would see highlighted on the canvas.
    await expect(page.locator('.workbench-statusbar')).toContainText('Layer Agent')
    await expect(page.locator('.workbench-statusbar')).not.toContainText('No selection')
  })

  test('checks its own work and reports a pattern that cannot be cut', async ({ page }) => {
    await expect(page.locator('.webmcp-panel-title')).toHaveText('Agent tools live')

    await callTool(page, 'create_pattern_piece', {
      shape: 'rounded_rect', name: 'A', width_mm: 100, height_mm: 60, center_x_mm: 0, center_y_mm: 0,
    })
    const clean = (await callTool(page, 'check_pattern')) as { score: { passing: boolean } }
    expect(clean.score.passing).toBe(true)

    await callTool(page, 'create_pattern_piece', {
      shape: 'rounded_rect', name: 'B', width_mm: 100, height_mm: 60, center_x_mm: 20, center_y_mm: 20,
    })
    const overlapping = (await callTool(page, 'check_pattern')) as {
      score: { passing: boolean }
      checks: Array<{ name: string; passed: boolean }>
    }
    expect(overlapping.score.passing).toBe(false)
    expect(overlapping.checks.some((check) => !check.passed)).toBe(true)
  })

  test('costs the pattern in hides and thread', async ({ page }) => {
    await expect(page.locator('.webmcp-panel-title')).toHaveText('Agent tools live')

    await callTool(page, 'create_pattern_piece', {
      shape: 'rounded_rect',
      name: 'Body',
      width_mm: 190,
      height_mm: 95,
      quantity: 2,
      stitch_inset_mm: 4,
    })

    const estimate = (await callTool(page, 'estimate_material', {
      hide_area_sqft: 24,
      price_per_hide: 180,
    })) as { hidesRequired: number; estimatedCost: number; thread: { threadLengthM: number } }

    expect(estimate.hidesRequired).toBe(1)
    expect(estimate.estimatedCost).toBe(180)
    expect(estimate.thread.threadLengthM).toBeGreaterThan(1)
  })

  test('shows the person every call the agent made', async ({ page }) => {
    await expect(page.locator('.webmcp-panel-title')).toHaveText('Agent tools live')
    await page.locator('.webmcp-panel-head').click()

    await callTool(page, 'get_pattern_overview')
    await callTool(page, 'rename_document', { name: 'Bifold v3' })

    await expect(page.locator('.webmcp-activity')).toHaveCount(2)
    await expect(page.locator('.webmcp-activity-name').first()).toHaveText('rename_document')
  })
})
