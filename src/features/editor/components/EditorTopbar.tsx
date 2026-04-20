import type { EditorTopbarProps } from './topbar/EditorTopbar.types'
import { DesktopRibbonStrip } from './topbar/DesktopRibbonStrip'
import {
  FileSection,
  LayerSection,
  LineTypeSection,
  MobileOptionsTabs,
  StitchSection,
  TransformSection,
  WorkspaceViewSection,
} from './topbar/EditorTopbarSections'
import { TopbarCommandGroup } from './topbar/TopbarCommandGroup'
import { TopbarToolSection } from './topbar/TopbarToolSection'
import { buildTopbarEditSection } from '../modules/topbar/buildTopbarEditSection'

export function EditorTopbar(props: EditorTopbarProps) {
  const editSection = buildTopbarEditSection(props)
  const {
    topbarClassName,
    isMobileLayout,
    showToolSection,
    showMobileMenu,
    showZoomSection,
    showEditSection,
    showLineTypeSection,
    showStitchSection,
    showLayerSection,
    showFileSection,
  } = props

  return (
    <header className={topbarClassName}>
      {!isMobileLayout && <DesktopRibbonStrip {...props} />}

      <div className={`topbar-body ${isMobileLayout ? 'topbar-body-mobile' : 'desktop-ribbon-panel'}`}>
        {showToolSection && <TopbarToolSection {...props} />}

        {isMobileLayout && showMobileMenu && <MobileOptionsTabs {...props} />}

        {showZoomSection && <WorkspaceViewSection {...props} />}

        {showEditSection && (
          <TopbarCommandGroup section={editSection} className="group edit-controls ribbon-section" />
        )}

        {showEditSection && <TransformSection {...props} />}

        {showLineTypeSection && <LineTypeSection {...props} />}

        {showStitchSection && <StitchSection {...props} />}

        {showLayerSection && <LayerSection {...props} />}

        {showFileSection && <FileSection {...props} />}
      </div>
    </header>
  )
}
