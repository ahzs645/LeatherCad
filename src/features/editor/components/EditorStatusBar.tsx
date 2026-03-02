type EditorStatusBarProps = {
  toolLabel: string
  status: string
  zoomPercent: number
  visibleShapeCount: number
  shapeCount: number
  layerCount: number
  sketchGroupCount: number
  visibleLineTypeCount: number
  lineTypeCount: number
  foldLineCount: number
  stitchHoleCount: number
  seamAllowanceCount: number
  constraintCount: number
  hardwareMarkerCount: number
  tracingOverlayCount: number
  templateCount: number
}

export function EditorStatusBar({
  toolLabel,
  status,
  zoomPercent,
  visibleShapeCount,
  shapeCount,
  layerCount,
  sketchGroupCount,
  visibleLineTypeCount,
  lineTypeCount,
  foldLineCount,
  stitchHoleCount,
  seamAllowanceCount,
  constraintCount,
  hardwareMarkerCount,
  tracingOverlayCount,
  templateCount,
}: EditorStatusBarProps) {
  return (
    <footer className="statusbar">
      <span>Tool: {toolLabel}</span>
      <span>{status}</span>
      <span className="statusbar-meta">{zoomPercent}% zoom</span>
      <span className="statusbar-meta">
        {visibleShapeCount}/{shapeCount} visible shapes
      </span>
      <span className="statusbar-meta">{layerCount} layers</span>
      <span className="statusbar-meta">{sketchGroupCount} sub-sketches</span>
      <span className="statusbar-meta">
        {visibleLineTypeCount}/{lineTypeCount} line types
      </span>
      <span className="statusbar-meta">{foldLineCount} bends</span>
      <span className="statusbar-meta">{stitchHoleCount} stitch holes</span>
      <span className="statusbar-meta">{seamAllowanceCount} seam offsets</span>
      <span className="statusbar-meta">{constraintCount} constraints</span>
      <span className="statusbar-meta">{hardwareMarkerCount} hardware markers</span>
      <span className="statusbar-meta">{tracingOverlayCount} traces</span>
      <span className="statusbar-meta">{templateCount} templates</span>
    </footer>
  )
}
