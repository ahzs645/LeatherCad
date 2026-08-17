/**
 * App-owned themed stage over @atelier/viewport's LightingRig — the LeatherCad
 * equivalent of Seamer Studio's SeamerLighting. The engine owns direct-light
 * lifecycles, PMREM conversion, and environment caching; this file owns what a
 * leather bench shot needs: warm key light, room-environment reflections so
 * dyed and burnished surfaces read as leather rather than plastic, a shadow
 * floor, and the editor's dark/light theme palettes.
 */

import {
  AmbientLight,
  Color,
  GridHelper,
  LineBasicMaterial,
  Mesh,
  PlaneGeometry,
  ShadowMaterial,
  type Scene,
} from 'three'
import type { DirectionalLightSpec, Viewport } from '@atelier/viewport'
import { ResourceScope } from '@atelier/viewport'

export type StageThemeMode = 'dark' | 'light'

type StageTheme = {
  background: string
  ambientColor: string
  ambientIntensity: number
  environmentIntensity: number
  gridMajor: string
  gridMinor: string
  shadowOpacity: number
  lights: readonly DirectionalLightSpec[]
}

// Hues carried over from the previous hand-rolled runtime so the scene stays
// recognizable; intensities are retuned for the engine's ACES tone mapping
// and image-based lighting.
const THEMES: Readonly<Record<StageThemeMode, StageTheme>> = {
  dark: {
    background: '#0a1220',
    ambientColor: '#ffffff',
    ambientIntensity: 0.9,
    environmentIntensity: 0.45,
    gridMajor: '#334155',
    gridMinor: '#1e293b',
    shadowOpacity: 0.32,
    lights: [
      { position: [1.2, 2.2, 1.4], color: 0xdbeafe, intensity: 2.4, castShadow: true },
      { position: [-1.4, 1.2, -1.4], color: 0x93c5fd, intensity: 0.9 },
      { position: [0, 2.6, -2.4], color: 0xffffff, intensity: 0.7 },
    ],
  },
  light: {
    background: '#eef4ff',
    ambientColor: '#ffffff',
    ambientIntensity: 1.05,
    environmentIntensity: 0.6,
    gridMajor: '#b7c5dc',
    gridMinor: '#d8e0ee',
    shadowOpacity: 0.18,
    lights: [
      { position: [1.2, 2.2, 1.4], color: 0xffffff, intensity: 2.1, castShadow: true },
      { position: [-1.4, 1.2, -1.4], color: 0x93c5fd, intensity: 0.55 },
      { position: [0, 2.6, -2.4], color: 0xfff3e0, intensity: 0.7 },
    ],
  },
}

const FLOOR_Y = -0.35
const GRID_SIZE = 4.2
const GRID_DIVISIONS = 14

export class LeatherStage {
  private readonly viewport: Viewport
  private readonly scene: Scene
  private readonly resources = new ResourceScope()
  private readonly ambient: AmbientLight
  private readonly grid: GridHelper
  private readonly shadowFloor: Mesh
  private readonly shadowMaterial: ShadowMaterial
  private themeMode: StageThemeMode = 'dark'
  private disposed = false

  constructor(viewport: Viewport) {
    this.viewport = viewport
    this.scene = viewport.scene

    this.ambient = new AmbientLight('#ffffff', THEMES.dark.ambientIntensity)
    this.scene.add(this.ambient)

    this.grid = new GridHelper(GRID_SIZE, GRID_DIVISIONS, THEMES.dark.gridMajor, THEMES.dark.gridMinor)
    this.grid.position.y = FLOOR_Y
    this.resources.track(this.grid.geometry)
    for (const material of this.gridMaterials()) {
      this.resources.track(material)
    }
    this.scene.add(this.grid)

    this.shadowMaterial = this.resources.track(
      new ShadowMaterial({ color: 0x000000, opacity: THEMES.dark.shadowOpacity, transparent: true }),
    )
    this.shadowFloor = new Mesh(this.resources.track(new PlaneGeometry(GRID_SIZE * 2, GRID_SIZE * 2)), this.shadowMaterial)
    this.shadowFloor.rotation.x = -Math.PI / 2
    this.shadowFloor.position.y = FLOOR_Y
    this.shadowFloor.receiveShadow = true
    this.shadowFloor.renderOrder = -1
    this.scene.add(this.shadowFloor)

    this.applyTheme('dark')
  }

  setTheme(mode: StageThemeMode) {
    if (this.disposed || mode === this.themeMode) {
      return
    }
    this.applyTheme(mode)
  }

  private applyTheme(mode: StageThemeMode) {
    this.themeMode = mode
    const theme = THEMES[mode]

    this.viewport.lighting.setBackground(theme.background)
    this.viewport.lighting.setLights(theme.lights)
    // Room environment gives dyed/burnished leather its reflections. The rig
    // caches the PMREM texture, so repeat calls only adjust intensity.
    void this.viewport.lighting
      .setEnvironment('room', theme.environmentIntensity)
      .then(() => this.viewport.invalidate())

    this.ambient.color = new Color(theme.ambientColor)
    this.ambient.intensity = theme.ambientIntensity
    this.shadowMaterial.opacity = theme.shadowOpacity

    const [major, minor] = [theme.gridMajor, theme.gridMinor]
    this.gridMaterials().forEach((material, index) => {
      material.color.set(index === 0 ? major : minor)
      material.needsUpdate = true
    })

    this.viewport.invalidate()
  }

  private gridMaterials(): LineBasicMaterial[] {
    const material: unknown = this.grid.material
    const materials: unknown[] = Array.isArray(material) ? material : [material]
    return materials.filter((entry): entry is LineBasicMaterial => entry instanceof LineBasicMaterial)
  }

  dispose() {
    if (this.disposed) {
      return
    }
    this.disposed = true
    this.scene.remove(this.ambient)
    this.scene.remove(this.grid)
    this.scene.remove(this.shadowFloor)
    this.resources.release()
  }
}
