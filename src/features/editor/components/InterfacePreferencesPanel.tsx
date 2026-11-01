import { DESKTOP_TOOL_ICON_ITEMS } from '../editor-constants'
import { useTranslate } from '../hooks/useTranslate'
import { SHOW_TOUR_EVENT } from './ScreenTour'
import { DEFAULT_INTERFACE_PREFERENCES, updateInterfacePreferences, useInterfacePreferences, type WheelMode } from '../ops/interface-preferences'

export function InterfacePreferencesPanel() {
  const t = useTranslate()
  const prefs = useInterfacePreferences()
  function moveTool(index: number, direction: number) {
    const toolOrder = [...prefs.toolOrder]
    const destination = index + direction
    if (destination < 0 || destination >= toolOrder.length) return
    ;[toolOrder[index], toolOrder[destination]] = [toolOrder[destination], toolOrder[index]]
    updateInterfacePreferences({ toolOrder })
  }
  return <>
    <label className="field-row"><span>{t('Wheel behavior')}</span><select aria-label={t('Wheel behavior')} value={prefs.wheelMode} onChange={event => updateInterfacePreferences({ wheelMode: event.target.value as WheelMode })}>
      <option value="auto">{t('Auto: mouse zoom, trackpad pan')}</option><option value="zoom">{t('Zoom')}</option><option value="pan">{t('Pan')}</option>
    </select></label>
    <p>{t('Ctrl / Command or pinch always zooms. Existing Alt and Shift selection shortcuts are preserved.')}</p>
    <label className="field-row"><span>{t('Trackpad sensitivity')}</span><input type="range" min="0.25" max="2" step="0.05" value={prefs.trackpadSensitivity} onChange={event => updateInterfacePreferences({ trackpadSensitivity: Number(event.target.value) })} /><output>{prefs.trackpadSensitivity.toFixed(2)}×</output></label>
    <label className="field-row"><span>{t('Mouse edge-pick radius (px)')}</span><input type="range" min="1" max="40" step="0.5" value={prefs.edgePickRadiusPx} onChange={event => updateInterfacePreferences({ edgePickRadiusPx: Number(event.target.value) })} /><output>{prefs.edgePickRadiusPx}px</output></label>
    <label className="field-row"><span>{t('Touch edge-pick radius (px)')}</span><input type="range" min="1" max="40" step="0.5" value={prefs.touchPickRadiusPx} onChange={event => updateInterfacePreferences({ touchPickRadiusPx: Number(event.target.value) })} /><output>{prefs.touchPickRadiusPx}px</output></label>
    <label className="layer-toggle-item"><input type="checkbox" checked={prefs.toolLabels} onChange={event => updateInterfacePreferences({ toolLabels: event.target.checked })} /><span>{t('Show tool labels')}</span></label>
    <h5>{t('Drawing surface')}</h5>
    <label className="layer-toggle-item"><input type="checkbox" checked={prefs.edgeRulers} onChange={event => updateInterfacePreferences({ edgeRulers: event.target.checked })} /><span>{t('Edge rulers (S shows or hides them)')}</span></label>
    <label className="layer-toggle-item"><input type="checkbox" checked={prefs.invertYAxis} onChange={event => updateInterfacePreferences({ invertYAxis: event.target.checked })} /><span>{t('Invert Y axis (up = positive) in rulers and size fields')}</span></label>
    <label className="layer-toggle-item"><input type="checkbox" checked={prefs.toolHints} onChange={event => updateInterfacePreferences({ toolHints: event.target.checked })} /><span>{t('Show the tool hint bubble')}</span></label>
    <label className="field-row"><span>{t('Touch pad (finger and pen)')}</span><select aria-label={t('Touch pad (finger and pen)')} value={prefs.modifierPad} onChange={event => updateInterfacePreferences({ modifierPad: event.target.value as typeof prefs.modifierPad })}>
      <option value="left">{t('Left')}</option><option value="right">{t('Right')}</option><option value="off">{t('Hidden')}</option>
    </select></label>
    <p>{t('On touch screens: pinch to zoom, drag with two fingers to pan, two-finger double tap to undo, three-finger double tap to redo.')}</p>
    <button type="button" onClick={() => { updateInterfacePreferences({ tourCompleted: false }); window.dispatchEvent(new CustomEvent(SHOW_TOUR_EVENT)) }}>{t('Show the screen tour')}</button>
    <h5>{t('Tool order')}</h5>
    <ol className="options-tool-order">{prefs.toolOrder.map((id, index) => {
      const label = t(DESKTOP_TOOL_ICON_ITEMS.find(item => item.value === id)?.label ?? id)
      return <li key={id}><span>{label}</span><button type="button" aria-label={`${t('Move up')}: ${label}`} disabled={index === 0} onClick={() => moveTool(index, -1)}>↑</button><button type="button" aria-label={`${t('Move down')}: ${label}`} disabled={index === prefs.toolOrder.length - 1} onClick={() => moveTool(index, 1)}>↓</button></li>
    })}</ol>
    <button type="button" onClick={() => updateInterfacePreferences({ ...DEFAULT_INTERFACE_PREFERENCES, displayUnit: prefs.displayUnit, canvasBackground: prefs.canvasBackground, tourCompleted: prefs.tourCompleted })}>{t('Reset input and tool preferences')}</button>
  </>
}
