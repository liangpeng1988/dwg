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
  return new THREE.MeshBasicMaterial({ 
    color, 
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
  });
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
 * 从索引获取颜色 (AutoCAD Color Index - ACI)
 * 完整的 255 色 ACI 表
 */
export function getColorFromIndex(colorIndex: number): number {
  const aciColors: { [key: number]: number } = {
    1: 0xff0000, 2: 0xffff00, 3: 0x00ff00, 4: 0x00ffff, 5: 0x0000ff, 6: 0xff00ff, 7: 0xffffff,
    8: 0x808080, 9: 0xc0c0c0, 10: 0xff0000, 11: 0xff7f7f, 12: 0xa50000, 13: 0xa55252, 14: 0x7f0000,
    15: 0x7f3f3f, 16: 0x4c0000, 17: 0x4c2626, 18: 0x330000, 19: 0x331919, 20: 0xff3f00, 21: 0xff9f7f,
    22: 0xa52900, 23: 0xa56752, 24: 0x7f1f00, 25: 0x7f4f3f, 26: 0x4c1300, 27: 0x4c2f26, 28: 0x330d00,
    29: 0x331f19, 30: 0xff7f00, 31: 0xffbf7f, 32: 0xa55200, 33: 0xa57b52, 34: 0x7f3f00, 35: 0x7f5f3f,
    36: 0x4c2600, 37: 0x4c3926, 38: 0x331900, 39: 0x332619, 40: 0xffbf00, 41: 0xffdf7f, 42: 0xa57b00,
    43: 0xa59052, 44: 0x7f5f00, 45: 0x7f6f3f, 46: 0x4c3900, 47: 0x4c4326, 48: 0x332600, 49: 0x332d19,
    50: 0xffff00, 51: 0xffff7f, 52: 0xa5a500, 53: 0xa5a552, 54: 0x7f7f00, 55: 0x7f7f3f, 56: 0x4c4c00,
    57: 0x4c4c26, 58: 0x333300, 59: 0x333319, 60: 0xbfff00, 61: 0xdfff7f, 62: 0x7ba500, 63: 0x90a552,
    64: 0x5f7f00, 65: 0x6f7f3f, 66: 0x394c00, 67: 0x434c26, 68: 0x263300, 69: 0x2d3319, 70: 0x7fff00,
    71: 0xbfff7f, 72: 0x52a500, 73: 0x7ba552, 74: 0x3f7f00, 75: 0x5f7f3f, 76: 0x264c00, 77: 0x394c26,
    78: 0x193300, 79: 0x263319, 80: 0x3fff00, 81: 0x9fff7f, 82: 0x29a500, 83: 0x67a552, 84: 0x1f7f00,
    85: 0x4f7f3f, 86: 0x134c00, 87: 0x2f4c26, 88: 0x0d3300, 89: 0x1f3319, 90: 0x00ff00, 91: 0x7fff7f,
    92: 0x00a500, 93: 0x52a552, 94: 0x007f00, 95: 0x3f7f3f, 96: 0x004c00, 97: 0x264c26, 98: 0x003300,
    99: 0x193319, 100: 0x00ff3f, 101: 0x7fff9f, 102: 0x00a529, 103: 0x52a567, 104: 0x007f1f, 105: 0x3f7f4f,
    106: 0x004c13, 107: 0x264c2f, 108: 0x00330d, 109: 0x19331f, 110: 0x00ff7f, 111: 0x7fffbf, 112: 0x00a552,
    113: 0x52a57b, 114: 0x007f3f, 115: 0x3f7f5f, 116: 0x004c26, 117: 0x264c39, 118: 0x003319, 119: 0x193326,
    120: 0x00ffbf, 121: 0x7fffdf, 122: 0x00a57b, 123: 0x52a590, 124: 0x007f5f, 125: 0x3f7f6f, 126: 0x004c39,
    127: 0x264c43, 128: 0x003326, 129: 0x19332d, 130: 0x00ffff, 131: 0x7fffff, 132: 0x00a5a5, 133: 0x52a5a5,
    134: 0x007f7f, 135: 0x3f7f7f, 136: 0x004c4c, 137: 0x264c4c, 138: 0x003333, 139: 0x193333, 140: 0x00bfff,
    141: 0x7fdfff, 142: 0x007ba5, 143: 0x5290a5, 144: 0x005f7f, 145: 0x3f6f7f, 146: 0x00394c, 147: 0x26434c,
    148: 0x002633, 149: 0x192d33, 150: 0x007fff, 151: 0x7fbfff, 152: 0x0052a5, 153: 0x527ba5, 154: 0x003f7f,
    155: 0x3f5f7f, 156: 0x00264c, 157: 0x26394c, 158: 0x001933, 159: 0x192633, 160: 0x003fff, 161: 0x7f9fff,
    162: 0x0029a5, 163: 0x5267a5, 164: 0x001f7f, 165: 0x3f4f7f, 166: 0x00134c, 167: 0x262f4c, 168: 0x000d33,
    169: 0x191f33, 170: 0x0000ff, 171: 0x7f7fff, 172: 0x0000a5, 173: 0x5252a5, 174: 0x00007f, 175: 0x3f3f7f,
    176: 0x00004c, 177: 0x26264c, 178: 0x000033, 179: 0x191933, 180: 0x3f00ff, 181: 0x9f7fff, 182: 0x2900a5,
    183: 0x6752a5, 184: 0x1f007f, 185: 0x4f3f7f, 186: 0x13004c, 187: 0x2f264c, 188: 0x0d0033, 189: 0x1f1933,
    190: 0x7f00ff, 191: 0xbf7fff, 192: 0x5200a5, 193: 0x7b52a5, 194: 0x3f007f, 195: 0x5f3f7f, 196: 0x26004c,
    197: 0x39264c, 198: 0x190033, 199: 0x261933, 200: 0xbf00ff, 201: 0xdf7fff, 202: 0x7b00a5, 203: 0x9052a5,
    204: 0x5f007f, 205: 0x6f3f7f, 206: 0x39004c, 207: 0x43264c, 208: 0x260033, 209: 0x2d1933, 210: 0xff00ff,
    211: 0xff7fff, 212: 0xa500a5, 213: 0xa552a5, 214: 0x7f007f, 215: 0x7f3f7f, 216: 0x4c004c, 217: 0x4c264c,
    218: 0x330033, 219: 0x331933, 220: 0xff00bf, 221: 0xff7fdf, 222: 0xa5007b, 223: 0xa55290, 224: 0x7f005f,
    225: 0x7f3f6f, 226: 0x4c0039, 227: 0x4c2643, 228: 0x330026, 229: 0x33192d, 230: 0xff007f, 231: 0xff7fbf,
    232: 0xa50052, 233: 0xa5527b, 234: 0x7f003f, 235: 0x7f3f5f, 236: 0x4c0026, 237: 0x4c2639, 238: 0x330019,
    239: 0x331926, 240: 0xff003f, 241: 0xff7f9f, 242: 0xa50029, 243: 0xa55267, 244: 0x7f001f, 245: 0x7f3f4f,
    246: 0x4c0013, 247: 0x4c262f, 248: 0x33000d, 249: 0x33191f, 250: 0x333333, 251: 0x505050, 252: 0x696969,
    253: 0x828282, 254: 0xbebebe, 255: 0xffffff
  };
  
  // 处理 ACI 7 (白/黑自动转换)
  if (colorIndex === 7) {
    // 这里简单返回白色，如果需要根据背景自动调整，需要 context 传入背景色
    return 0xffffff;
  }
  
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

  // 1. 图层真彩色
  if (typeof layer.trueColor === 'number' && layer.trueColor !== 0) {
    return layer.trueColor;
  }

  // 2. 图层颜色索引
  if (typeof layer.colorIndex === 'number') {
    const ci = layer.colorIndex;
    if (ci > 0 && ci < 256) {
      return getColorFromIndex(ci);
    }
  }

  // 3. 普通颜色字段
  if (typeof layer.color === 'number' && layer.color !== 0) {
    if (layer.color > 255) {
      return layer.color;
    } else {
      return getColorFromIndex(layer.color);
    }
  }

  // 4. 默认
  return 0xffffff;
}


/**
 * 获取实体颜色（DWG 规则）
 * 优先级：trueColor > colorIndex(1-255) / BYLAYER / BYBLOCK / 图层色 > color (真彩色) > 默认
 */
export function getEntityColor(entity: DwgEntity, context?: DrawContext, defaultColor: number = 0xffffff): number {
  // 1. 实体真彩色（24 位 RGB）
  // 注意：在 libredwg 中，trueColor 通常已经是正确的 RGB 格式
  if (typeof entity.trueColor === 'number' && entity.trueColor !== 0) {
    return entity.trueColor;
  }

  // 2. 使用颜色索引 (ACI)
  // 这是最常用的颜色定义方式
  if (typeof entity.colorIndex === 'number') {
    let ci = entity.colorIndex;

    // 负值表示图层关闭，绝对值即为颜色索引
    if (ci < 0) ci = Math.abs(ci);

    // 256 = BYLAYER
    if (ci === 256) {
      if (context?.layers) {
        return getLayerColor(entity.layer, context.layers);
      }
      return defaultColor;
    }

    // 0 = BYBLOCK
    if (ci === 0) {
      if (typeof context?.inheritedColor === 'number') {
        return context.inheritedColor;
      }
      if (context?.layers) {
        return getLayerColor(entity.layer, context.layers);
      }
      return defaultColor;
    }

    // 1–255 = ACI
    if (ci > 0 && ci < 256) {
      return getColorFromIndex(ci);
    }
  }

  // 3. 实体自带颜色字段 (可能是 BGR 或 RGB，视版本而定)
  // 如果没有 trueColor 和 colorIndex，才使用此字段
  if (typeof entity.color === 'number' && entity.color !== 0) {
    // 如果数值大于 255，说明它是一个真彩色值
    if (entity.color > 255) {
      // 根据 entity.ts 说明，lowest byte is blue -> 0xRRGGBB
      return entity.color;
    } else {
      // 否则它可能也是一个索引
      return getColorFromIndex(entity.color);
    }
  }

  // 4. 没有显式颜色和索引时，使用图层颜色
  if (context?.layers) {
    return getLayerColor(entity.layer, context.layers);
  }

  // 5. 最后兜底
  return defaultColor;
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
  applyBasePointOffset: boolean = true
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
  const basePointOffsetMatrix = new THREE.Matrix4();
  if (applyBasePointOffset && basePoint) {
    basePointOffsetMatrix.makeTranslation(
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
  
  // 组合变换顺序（从右到左应用）：
  // v_wcs = OCS_to_WCS * Translation_OCS * Rotation * Scale * Translation_NegativeBasePoint * v_block
  matrix
    .multiply(ocsMatrix)              // 首先应用 OCS 到 WCS 的转换
    .multiply(translationMatrix)      // 然后应用 OCS 中的平移（插入点）
    .multiply(rotationMatrix)         // 然后应用旋转
    .multiply(scaleMatrix)            // 然后应用缩放
    .multiply(basePointOffsetMatrix); // 首先应用基点偏移（将块对齐到基点）

  
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
