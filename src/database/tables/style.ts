import { DwgCommonTableEntry } from './table'

export interface DwgStyleTableEntry extends DwgCommonTableEntry {
  /**
   * Standard flag (DXF 70):
   * - 1: is_vertical
   * - 2: is_upsidedown
   * - 4: is_shape
   * - 8: underlined
   * - 16: overlined
   * - 32: is_shx
   * - 64: pre_loaded
   * - 128: is_backward
   * - 256: shape_loaded
   * - 512: is_striked
   */
  standardFlag: number
  fixedTextHeight: number
  widthFactor: number
  obliqueAngle: number
  /**
   * Text generation flags:
   * - 2: Text is backward (mirrored in X)
   * - 4: Text is upside down (mirrored in Y)
   */
  textGenerationFlag: number
  lastHeight: number
  font: string
  bigFont: string
  extendedFont?: string
}