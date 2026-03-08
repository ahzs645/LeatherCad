declare module 'opentype.js' {
  export interface Glyph {
    advanceWidth?: number
    name?: string
    unicode?: number
  }

  export interface PathCommand {
    type: 'M' | 'L' | 'Q' | 'C' | 'Z'
    x?: number
    y?: number
    x1?: number
    y1?: number
    x2?: number
    y2?: number
  }

  export interface Path {
    commands: PathCommand[]
    toPathData(decimalPlaces?: number): string
    toSVG(decimalPlaces?: number): string
  }

  export interface Font {
    unitsPerEm: number
    familyName: string
    styleName: string
    glyphs: { length: number }
    charToGlyph(char: string): Glyph
    getKerningValue(leftGlyph: Glyph, rightGlyph: Glyph): number
    getPath(text: string, x: number, y: number, fontSize: number, options?: object): Path
    getPaths(text: string, x: number, y: number, fontSize: number, options?: object): Path[]
  }

  export function load(url: string): Promise<Font>
  export function parse(buffer: ArrayBuffer): Font
}
