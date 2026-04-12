import {
  useThreePreviewController,
  type ThreePreviewController,
  type ThreePreviewControllerProps,
} from '../hooks/useThreePreviewController'

export type WorkbenchThreePreviewProps = ThreePreviewControllerProps

export function useWorkbenchThreePreviewController(props: WorkbenchThreePreviewProps): ThreePreviewController {
  return useThreePreviewController(props)
}

export type WorkbenchThreePreviewController = ThreePreviewController
