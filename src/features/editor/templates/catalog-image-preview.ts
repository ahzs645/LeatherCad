const ZIP_LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50

function copyBytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(arrayBuffer).set(bytes)
  return arrayBuffer
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  const normalized = base64.replace(/\s+/g, '')
  if (typeof globalThis.atob !== 'function') {
    throw new Error('Base64 decoder is unavailable in this environment')
  }
  const decoded = globalThis.atob(normalized)
  const bytes = new Uint8Array(decoded.length)
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index)
  }
  return bytes
}

function sniffImageMimeType(bytes: Uint8Array): string {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png'
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return 'image/gif'
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp'
  }
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return 'image/bmp'
  }
  return 'application/octet-stream'
}

function parseZipLocalFileHeader(zipBytes: Uint8Array) {
  if (zipBytes.length < 30) {
    throw new Error('Image payload is too small to be a valid ZIP entry')
  }
  const view = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength)
  if (view.getUint32(0, true) !== ZIP_LOCAL_FILE_HEADER_SIGNATURE) {
    throw new Error('Image payload has an unsupported ZIP format')
  }
  const compressionMethod = view.getUint16(8, true)
  const compressedSize = view.getUint32(18, true)
  const fileNameLength = view.getUint16(26, true)
  const extraFieldLength = view.getUint16(28, true)
  const dataStart = 30 + fileNameLength + extraFieldLength
  const dataEnd = dataStart + compressedSize
  if (dataEnd > zipBytes.length || dataStart < 0 || dataEnd < dataStart) {
    throw new Error('Image payload ZIP entry boundaries are invalid')
  }
  return {
    compressionMethod,
    compressedData: zipBytes.slice(dataStart, dataEnd),
  }
}

async function decompressZipEntry(compressionMethod: number, compressedData: Uint8Array): Promise<Uint8Array> {
  if (compressionMethod === 0) {
    return compressedData
  }
  if (compressionMethod !== 8) {
    throw new Error(`Unsupported ZIP compression method: ${compressionMethod}`)
  }
  if (typeof DecompressionStream !== 'function') {
    throw new Error('Your browser does not support ZIP thumbnail decompression')
  }
  const stream = new Blob([copyBytesToArrayBuffer(compressedData)]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  const decompressedBuffer = await new Response(stream).arrayBuffer()
  return new Uint8Array(decompressedBuffer)
}

export async function decodeCatalogZipBmpToObjectUrl(zipBmpBase64: string): Promise<string> {
  const zipBytes = decodeBase64ToBytes(zipBmpBase64)
  const { compressionMethod, compressedData } = parseZipLocalFileHeader(zipBytes)
  const imageBytes = await decompressZipEntry(compressionMethod, compressedData)
  const mimeType = sniffImageMimeType(imageBytes)
  return URL.createObjectURL(new Blob([copyBytesToArrayBuffer(imageBytes)], { type: mimeType }))
}
