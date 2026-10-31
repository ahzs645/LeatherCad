import { getEditorLocale } from '../ops/locale-store'
import { getTranslationMapSnapshot, translateUiText } from '../ops/translation-ops'
import './EvenStitchCountDialog.css'

let dismissCurrent: (() => void) | undefined
/** Native modal dialog keeps the canvas inert while a count is entered. This
 * request is shared by toolbar and preferred-pitch actions. */
export function requestEvenStitchCount(initial = 8): Promise<number | null> {
  dismissCurrent?.()
  const t = (key: string) => translateUiText(getEditorLocale(), getTranslationMapSnapshot(), key, key)
  return new Promise(resolve => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = document.createElement('dialog')
    dialog.className = 'even-stitch-count-dialog'
    dialog.setAttribute('aria-label', t('Evenly spaced stitch holes'))
    dialog.setAttribute('aria-modal', 'true')
    dialog.setAttribute('role', 'dialog')
    const form = document.createElement('form')
    form.noValidate = true
    const heading = document.createElement('h3')
    heading.textContent = t('Evenly spaced stitch holes')
    const label = document.createElement('label')
    label.textContent = t('Number of holes per selected path')
    const input = document.createElement('input')
    input.type = 'number'; input.min = '2'; input.max = '10000'; input.step = '1'; input.value = String(initial)
    label.append(input)
    const hint = document.createElement('p')
    hint.textContent = t('Holes include both ends of an open path. Existing holes on selected stitch paths are replaced.')
    const error = document.createElement('p')
    error.setAttribute('role', 'alert')
    const cancel = document.createElement('button')
    cancel.type = 'button'; cancel.textContent = t('Cancel')
    const apply = document.createElement('button')
    apply.type = 'submit'; apply.textContent = t('Place holes')
    const valid = () => input.value.trim() !== '' && Number.isInteger(Number(input.value)) && Number(input.value) >= 2 && Number(input.value) <= 10000
    input.addEventListener('input', () => {
      input.setAttribute('aria-invalid', String(!valid()))
      error.textContent = valid() ? '' : t('Enter a whole number from 2 to 10000.')
      apply.disabled = !valid()
    })
    let finished = false
    const finish = (count: number | null) => {
      if (finished) return
      finished = true
      dismissCurrent = undefined
      if (typeof dialog.close === 'function') dialog.close()
      dialog.remove()
      if (previous?.isConnected) previous.focus()
      resolve(count)
    }
    dismissCurrent = () => finish(null)
    cancel.addEventListener('click', () => finish(null))
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(null) })
    form.addEventListener('submit', event => {
      event.preventDefault()
      if (valid()) finish(Number(input.value))
    })
    form.append(heading, label, hint, error, cancel, apply)
    dialog.append(form)
    document.body.append(dialog)
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
    input.focus(); input.select()
  })
}
