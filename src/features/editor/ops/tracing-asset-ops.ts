export function fileToTracingDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('FileReader produced non-string result'))
        return
      }
      resolve(result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'))
    reader.readAsDataURL(file)
  })
}

export function readTracingImageNaturalSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () =>
      resolve({
        width: image.naturalWidth || 1,
        height: image.naturalHeight || 1,
      })
    image.onerror = () => reject(new Error('Could not decode tracing image'))
    image.src = dataUrl
  })
}

export function dataUrlToUint8Array(dataUrl: string) {
  const separatorIndex = dataUrl.indexOf(',')
  if (!dataUrl.startsWith('data:') || separatorIndex === -1) {
    throw new Error('Expected a data URL')
  }

  const metadata = dataUrl.slice(0, separatorIndex)
  const payload = dataUrl.slice(separatorIndex + 1)
  const binary = metadata.includes(';base64') ? globalThis.atob(payload) : decodeURIComponent(payload)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

export function canvasToTracingPngDataUrl(canvas: HTMLCanvasElement) {
  const dataUrl = canvas.toDataURL('image/png')
  if (!dataUrl.startsWith('data:image/png')) {
    throw new Error('Could not encode rendered PDF page')
  }
  return dataUrl
}
