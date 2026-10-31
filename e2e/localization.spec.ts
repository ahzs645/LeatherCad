import { expect, test } from '@playwright/test'

test('interface language changes real drafting and file controls and survives reload', async ({ page }) => {
  await page.goto('/')
  const language = page.getByTestId('interface-language').first()
  await expect(language).toBeVisible()
  await language.selectOption('ja')
  await expect(page.getByTestId('ribbon-tab-draft')).toHaveText('作図')
  await page.getByTestId('ribbon-tab-output').click()
  await expect(page.getByTestId('ribbon-command-save-json')).toHaveText('保存')
  await page.reload()
  await expect(page.getByTestId('interface-language').first()).toHaveValue('ja')
  await expect(page.getByTestId('ribbon-tab-draft')).toHaveText('作図')
  await page.getByTestId('interface-language').first().selectOption('de')
  await expect(page.getByTestId('ribbon-tab-draft')).toHaveText('Zeichnen')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
})

test('phone options expose a working language selector', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Options', exact: true }).click()
  const language = page.getByTestId('interface-language').first()
  await expect(language).toBeVisible()
  await language.selectOption('ja')
  await expect(page.getByRole('button', { name: 'プロジェクトメモ', exact: true })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
})
