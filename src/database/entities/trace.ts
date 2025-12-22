import { DwgPoint2D, DwgPoint3D } from '../common'
import { DwgEntity } from './entity'

export interface DwgTraceEntity extends DwgEntity {
  /**
   * Entity type
   */
  type: 'TRACE'
  /**
   * Point1
   */
  point1: DwgPoint2D
  /**
   * Point2
   */
  point2: DwgPoint2D
  /**
   * Point3
   */
  point3: DwgPoint2D
  /**
   * Point4. If only three points are entered to define the TRACE,
   * then the fourth point coordinate is the same as the third.
   */
  point4?: DwgPoint2D
  /**
   * Thickness (optional; default = 0)
   */
  thickness: number
  /**
   * Extrusion direction (optional; default = 0, 0, 1)
   */
  extrusionDirection: DwgPoint3D
}