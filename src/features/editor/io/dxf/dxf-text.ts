/** Pre-2007 DXF is code-page based; ASCII escapes keep Unicode names portable. */
export const escapeDxfText = (value: string): string => value.replace(/[^\u0020-\u007e]/g, character => `\\U+${character.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`)
export const unescapeDxfText = (value: string): string => value.replace(/\\U\+([0-9a-f]{4})/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
