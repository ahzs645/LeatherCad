import { useEffect, useRef, useState } from 'react'
import type { StlMesh } from '../io/stl-mesh'

type StlMeshPreviewProps = {
  mesh: StlMesh
  label: string
  unavailableMessage: string
}

/** Loads the renderer only when an STL dialog has a validated mesh to show. */
export default function StlMeshPreview({ mesh, label, unavailableMessage }: StlMeshPreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    let dispose: (() => void) | undefined
    void Promise.all([import('three'), import('three/examples/jsm/controls/OrbitControls.js')]).then(([three, { OrbitControls }]) => {
      const host = hostRef.current
      if (cancelled || !host) return
      const scene = new three.Scene()
      scene.background = new three.Color(0x1c2028)
      const geometry = new three.BufferGeometry()
      geometry.setAttribute('position', new three.Float32BufferAttribute(mesh.vertices.flatMap((point) => [point.x, point.y, point.z]), 3))
      geometry.setIndex(mesh.triangles.flat())
      geometry.computeVertexNormals()
      geometry.computeBoundingBox()
      const bounds = geometry.boundingBox!
      const center = bounds.getCenter(new three.Vector3())
      const size = bounds.getSize(new three.Vector3())
      geometry.translate(-center.x, -center.y, -center.z)
      const material = new three.MeshStandardMaterial({ color: 0xc79558, roughness: 0.8, metalness: 0.05, flatShading: true })
      scene.add(new three.Mesh(geometry, material))
      scene.add(new three.HemisphereLight(0xffffff, 0x343947, 2.2))
      const light = new three.DirectionalLight(0xffffff, 2.5)
      light.position.set(1, -2, 4)
      scene.add(light)
      const camera = new three.PerspectiveCamera(38, 1, 0.01, Math.max(size.length() * 30, 100))
      camera.up.set(0, 0, 1)
      const radius = Math.max(size.length(), 1)
      camera.position.set(radius * 0.8, -radius * 1.1, radius * 0.9)
      camera.lookAt(0, 0, 0)
      let renderer: InstanceType<typeof three.WebGLRenderer>
      try {
        renderer = new three.WebGLRenderer({ antialias: true })
      } catch {
        geometry.dispose()
        material.dispose()
        if (!cancelled) setUnavailable(true)
        return
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.domElement.setAttribute('aria-label', label)
      renderer.domElement.setAttribute('role', 'img')
      host.replaceChildren(renderer.domElement)
      const controls = new OrbitControls(camera, renderer.domElement)
      const render = () => renderer.render(scene, camera)
      controls.addEventListener('change', render)
      const resize = () => {
        const width = Math.max(host.clientWidth, 1), height = Math.max(host.clientHeight, 1)
        renderer.setSize(width, height)
        camera.aspect = width / height
        camera.updateProjectionMatrix()
        render()
      }
      const observer = new ResizeObserver(resize)
      observer.observe(host)
      resize()
      dispose = () => {
        observer.disconnect()
        controls.dispose()
        geometry.dispose()
        material.dispose()
        renderer.dispose()
        renderer.domElement.remove()
      }
    }).catch(() => { if (!cancelled) setUnavailable(true) })
    return () => { cancelled = true; dispose?.() }
  }, [mesh, label])

  return <div ref={hostRef} style={{ width: '100%', height: 260, overflow: 'hidden', borderRadius: 6 }}>
    {unavailable && <p role="status">{unavailableMessage}</p>}
  </div>
}
