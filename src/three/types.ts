import * as THREE from 'three';
import { DwgEntity, DwgLTypeTableEntry, DwgDimStyleTableEntry } from '../database';

/**
 * 绘制上下文接口
 */
export interface DrawContext {
  scaleFactor: number;
  backgroundColor?: number;
  lineTypes?: Map<string, DwgLTypeTableEntry>;
  /**
   * 图层信息映射（图层名 -> 图层信息）
   */
  layers?: Map<string, LayerInfo>;
  /**
   * BYBLOCK 继承颜色（由上级 INSERT 或标注等传入）
   */
  inheritedColor?: number;
  /**
   * 标注样式映射（样式名 -> 标注样式）
   */
  dimStyles?: Map<string, DwgDimStyleTableEntry>;
  /**
   * 累积变换矩阵（用于嵌套块，父块的变换会累积到子块）
   * 当块内包含 INSERT 时，子块的变换 = 父块变换 × 子块变换
   */
  accumulatedTransform?: THREE.Matrix4;
}

/**
 * 绘制结果接口
 */
export interface DrawResult {
  object: THREE.Object3D;
  layers?: Map<string, THREE.Object3D>;
}

/**
 * 图层信息接口
 */
export interface LayerInfo {
  name: string;
  visible: boolean;  // true: 可见, false: 隐藏 (off 或 frozen)
  frozen: boolean;
  locked: boolean;
  color?: number;        // RGB 颜色值
  colorIndex?: number;   // ACI 颜色索引 (1-255)
  trueColor?: number;    // 24位真彩色值 (0x000000-0xFFFFFF)
}

/**
 * 背景颜色类型
 */
export type BackgroundColorType = 'light' | 'dark' | number;

/**
 * 缩放点坐标
 */
export function scalePoint(
  point: { x: number; y: number; z?: number } | undefined,
  scaleFactor: number = 1
): THREE.Vector3 {
  if (!point) {
    return new THREE.Vector3(0, 0, 0);
  }
  return new THREE.Vector3(
    point.x * scaleFactor,
    point.y * scaleFactor,
    (point.z || 0) * scaleFactor
  );
}

/**
 * 缩放2D点坐标
 */
export function scalePoint2D(
  point: { x: number; y: number } | undefined,
  scaleFactor: number = 1
): THREE.Vector2 {
  if (!point) {
    return new THREE.Vector2(0, 0);
  }
  return new THREE.Vector2(point.x * scaleFactor, point.y * scaleFactor);
}

/**
 * 根据绘制平面缩放点坐标（仅支持XY平面）
 */
export function scalePointForPlane(
  point: { x: number; y: number; z?: number } | undefined,
  scaleFactor: number = 1
): THREE.Vector3 {
  // 固定使用XY平面
  return scalePoint(point, scaleFactor);
}

/**
 * XY坐标转XZ坐标
 */
export function xyToXz(point: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3(point.x, point.z, point.y);
}

/**
 * XZ坐标转XY坐标
 */
export function xzToXy(point: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3(point.x, point.z, point.y);
}

/**
 * 批量XY坐标转XZ坐标
 */
export function batchXyToXz(points: THREE.Vector3[]): THREE.Vector3[] {
  return points.map(p => xyToXz(p));
}

/**
 * 批量XZ坐标转XY坐标
 */
export function batchXzToXy(points: THREE.Vector3[]): THREE.Vector3[] {
  return points.map(p => xzToXy(p));
}

/**
 * 应用挤出方向变换
 */
export function applyExtrusionDirection(
  object: THREE.Object3D,
  extrusionDirection?: { x: number; y: number; z: number }
): void {
  if (!extrusionDirection) return;

  const direction = new THREE.Vector3(
    extrusionDirection.x,
    extrusionDirection.y,
    extrusionDirection.z
  );

  // 如果不是默认的 (0, 0, 1)，应用旋转
  if (!direction.equals(new THREE.Vector3(0, 0, 1))) {
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction.normalize());
    object.applyQuaternion(quaternion);
  }
}

/**
 * 创建线条材质
 */
export function createLineMaterial(color: number = 0xffffff): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({ color });
}

/**
 * 创建网格材质
 */
export function createMeshMaterial(color: number = 0xffffff): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
}

/**
 * BGR转RGB颜色
 */
export function bgrToRgb(bgr: number): number {
  const b = (bgr >> 16) & 0xff;
  const g = (bgr >> 8) & 0xff;
  const r = bgr & 0xff;
  return (r << 16) | (g << 8) | b;
}

/**
 * 从索引获取颜色
 */
export function getColorFromIndex(colorIndex: number): number {
  // AutoCAD颜色索引映射
  const aciColors: { [key: number]: number } = {
    0: 0x000000, // ByBlock
    1: 0xff0000, // Red
    2: 0xffff00, // Yellow
    3: 0x00ff00, // Green
    4: 0x00ffff, // Cyan
    5: 0x0000ff, // Blue
    6: 0xff00ff, // Magenta
    7: 0xffffff, // White/Black
    // ... 更多颜色索引
  };
  return aciColors[colorIndex] || 0xffffff;
}

/**
 * 从颜色名称获取颜色
 */
export function getColorFromName(colorName: string): number {
  const colorMap: { [key: string]: number } = {
    red: 0xff0000,
    green: 0x00ff00,
    blue: 0x0000ff,
    yellow: 0xffff00,
    cyan: 0x00ffff,
    magenta: 0xff00ff,
    white: 0xffffff,
    black: 0x000000,
  };
  return colorMap[colorName.toLowerCase()] || 0xffffff;
}

/**
 * 验证RGB颜色值
 */
export function isValidRgbColor(color: number): boolean {
  return color >= 0 && color <= 0xffffff;
}

/**
 * 验证ACI索引
 */
export function isValidAciIndex(index: number): boolean {
  return index >= 0 && index <= 255;
}

/**
 * 获取图层颜色
 * 优先级：trueColor > colorIndex(1-255) > color 字段 > 默认白色
 */
export function getLayerColor(layerName: string, layers?: Map<string, LayerInfo>): number {
  if (!layers) return 0xffffff;
  const layer = layers.get(layerName);
  if (!layer) return 0xffffff;

  // 1. 图层真彩色（已是 RGB）
  if (typeof layer.trueColor === 'number' && isValidRgbColor(layer.trueColor)) {
    return layer.trueColor;
  }

  // 2. 图层颜色索引
  if (typeof layer.colorIndex === 'number') {
    const ci = layer.colorIndex;
    // 0 = ByBlock, 256 = ByLayer，这里都退回到图层自身颜色或默认
    if (ci > 0 && ci < 256) {
      return getColorFromIndex(ci);
    }
  }

  // 3. 普通 RGB 颜色
  if (typeof layer.color === 'number' && isValidRgbColor(layer.color)) {
    return layer.color;
  }

  // 4. 默认
  return 0xffffff;
}

/**
 * 获取实体颜色（DWG 规则）
 * 优先级：trueColor > color(BGR) > colorIndex(1-255) / BYLAYER / BYBLOCK / 图层色 > 默认
 */
export function getEntityColor(entity: DwgEntity, context?: DrawContext): number {
  // 1. 实体真彩色（24 位 RGB）
  if (typeof entity.trueColor === 'number' && isValidRgbColor(entity.trueColor)) {
    return entity.trueColor;
  }

  // 2. 实体自带 BGR 颜色（libredwg 解析出的 BGR）
  if (typeof entity.color === 'number') {
    return bgrToRgb(entity.color);
  }

  // 3. 使用颜色索引
  if (typeof entity.colorIndex === 'number') {
    let ci = entity.colorIndex;

    // 负值表示图层关闭等，这里简单取绝对值以得到有效索引
    if (ci < 0) ci = Math.abs(ci);

    // 256 = BYLAYER
    if (ci === 256) {
      if (context?.layers) {
        return getLayerColor(entity.layer, context.layers);
      }
      return 0xffffff;
    }

    // 0 = BYBLOCK，优先使用继承色，其次退回到图层色
    if (ci === 0) {
      if (typeof context?.inheritedColor === 'number') {
        return context.inheritedColor;
      }
      if (context?.layers) {
        return getLayerColor(entity.layer, context.layers);
      }
      return 0xffffff;
    }

    // 1–255 = ACI
    if (ci > 0 && ci < 256) {
      return getColorFromIndex(ci);
    }
  }

  // 4. 没有显式颜色和索引时，使用图层颜色
  if (context?.layers) {
    return getLayerColor(entity.layer, context.layers);
  }

  // 5. 最后兜底为白色
  return 0xffffff;
}

/**
 * 判断是否为浅色背景
 */
export function isLightBackground(backgroundColor: number): boolean {
  const r = (backgroundColor >> 16) & 0xff;
  const g = (backgroundColor >> 8) & 0xff;
  const b = backgroundColor & 0xff;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128;
}

/**
 * 为实体创建线条材质
 */
export function createLineMaterialForEntity(
  entity: DwgEntity,
  context?: DrawContext
): THREE.LineBasicMaterial {
  const color = getEntityColor(entity, context);
  return createLineMaterial(color);
}

/**
 * 为实体创建网格材质
 */
export function createMeshMaterialForEntity(
  entity: DwgEntity,
  context?: DrawContext
): THREE.MeshBasicMaterial {
  const color = getEntityColor(entity, context);
  return createMeshMaterial(color);
}

/**
 * 获取线宽
 */
export function getLineWidth(entity: DwgEntity): number {
  return entity.lineweight ?? 1;
}

/**
 * 创建带线宽的线条材质
 */
export function createLineMaterialWithWidth(
  color: number,
  lineWidth: number
): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({ color, linewidth: lineWidth });
}

/**
 * 获取OCS到WCS的变换矩阵
 */
export function getOcsToWcsMatrix(
  extrusionDirection: { x: number; y: number; z: number }
): THREE.Matrix4 {
  const ez = new THREE.Vector3(
    extrusionDirection.x,
    extrusionDirection.y,
    extrusionDirection.z
  ).normalize();

  // 计算任意轴算法
  let ex: THREE.Vector3;
  if (Math.abs(ez.x) < 1 / 64 && Math.abs(ez.y) < 1 / 64) {
    ex = new THREE.Vector3(0, 1, 0).cross(ez).normalize();
  } else {
    ex = new THREE.Vector3(0, 0, 1).cross(ez).normalize();
  }

  const ey = ez.clone().cross(ex).normalize();

  const matrix = new THREE.Matrix4();
  matrix.makeBasis(ex, ey, ez);

  return matrix;
}

/**
 * OCS点转WCS点
 */
export function ocsPointToWcs(
  point: THREE.Vector3,
  extrusionDirection: { x: number; y: number; z: number }
): THREE.Vector3 {
  const matrix = getOcsToWcsMatrix(extrusionDirection);
  return point.clone().applyMatrix4(matrix);
}

/**
 * 创建INSERT实体的变换矩阵
 * 完全参考 SVG 转换器的变换方式（svgConverter.ts 第 550 行）
 * SVG: transform = `translate(${insertionPoint.x},${insertionPoint.y}) rotate(${rotation}) scale(${xScale},${yScale})`
 * 注意：SVG 中没有处理基点偏移，块内实体坐标已经是相对于基点的
 * @param insertionPoint 插入点位置
 * @param basePoint 块基点（当前未使用，保留以便后续扩展）
 * @param scale 缩放比例
 * @param rotation 旋转角度（弧度）
 * @param extrusionDirection 挤出方向（可选）
 * @param scaleFactor 全局缩放因子
 */
export function createInsertTransformMatrix(
  insertionPoint: { x: number; y: number; z?: number },
  basePoint?: { x: number; y: number; z?: number },
  scale: { x: number; y: number; z?: number } = { x: 1, y: 1, z: 1 },
  rotation: number = 0,
  extrusionDirection?: { x: number; y: number; z: number },
  scaleFactor: number = 1,
  applyBasePointOffset: boolean = false
): THREE.Matrix4 {
  const matrix = new THREE.Matrix4();
  
  // 变换顺序：
  // 1. 基点偏移（首先应用负基点偏移，使块内容相对于基点定位）
  // 2. 缩放
  // 3. 旋转
  // 4. OCS到WCS变换
  // 5. 插入点平移
  // 使用叠层计算方式处理基点偏移
  
  // 1. 基点偏移变换
  let basePointOffsetMatrix = new THREE.Matrix4();
  if (applyBasePointOffset && basePoint) {
    basePointOffsetMatrix = new THREE.Matrix4().makeTranslation(
      -basePoint.x * scaleFactor,
      -basePoint.y * scaleFactor,
      -(basePoint.z || 0) * scaleFactor
    );
  }
  
  // 2. 缩放变换
  const scaleMatrix = new THREE.Matrix4().makeScale(
    scale.x,
    scale.y,
    scale.z || 1
  );
  
  // 3. 旋转变换（绕Z轴）
  const rotationMatrix = new THREE.Matrix4().makeRotationZ(rotation);
  
  // 4. OCS到WCS的变换（如果有挤出方向）
  let ocsMatrix = new THREE.Matrix4();
  if (extrusionDirection && 
      (extrusionDirection.x !== 0 || extrusionDirection.y !== 0 || extrusionDirection.z !== 1)) {
    ocsMatrix = getOcsToWcsMatrix(extrusionDirection);
  }
  
  // 5. 插入点平移变换
  const translationMatrix = new THREE.Matrix4().makeTranslation(
    insertionPoint.x * scaleFactor,
    insertionPoint.y * scaleFactor,
    (insertionPoint.z || 0) * scaleFactor
  );
  
  // 组合变换顺序（从右到左应用，匹配 SVG 转换器）：
  // SVG: translate → rotate → scale
  // Three.js (3D): translate → OCS → rotate → scale
  // 注意：不使用基点偏移（与 SVG 一致，块内实体坐标已相对基点）
  matrix
    .multiply(translationMatrix)      // 最后应用插入点平移
    .multiply(ocsMatrix)              // 然后应用OCS变换（如果有）
    .multiply(rotationMatrix)         // 然后应用旋转（绕原点）
    .multiply(scaleMatrix);           // 首先应用缩放
  // 注意：不应用 basePointOffsetMatrix（与 SVG 一致）
  
  return matrix;
}

/**
 * 根据线型创建线条材质
 */
export function createLineMaterialFromLineType(
  color: number,
  lineType?: string,
  lineTypeScale: number = 1,
  lineTypes?: Map<string, DwgLTypeTableEntry>
): THREE.LineBasicMaterial | THREE.LineDashedMaterial {
  // 如果没有线型或线型为CONTINUOUS/ByLayer，返回普通材质
  if (!lineType || lineType === 'CONTINUOUS' || lineType === 'ByLayer') {
    return new THREE.LineBasicMaterial({ color });
  }

  // 查找线型定义
  const lineTypeEntry = lineTypes?.get(lineType);
  if (!lineTypeEntry) {
    return new THREE.LineBasicMaterial({ color });
  }

  // 创建虚线材质
  // 这里简化处理，可以根据线型定义计算dash和gap
  return new THREE.LineDashedMaterial({
    color,
    dashSize: 3 * lineTypeScale,
    gapSize: 1 * lineTypeScale,
  });
}
