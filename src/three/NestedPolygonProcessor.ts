import * as THREE from 'three';


/**
 * 嵌套多边形信息
 */
export interface NestedPolygon {
  /** 多边形点集 */
  points: THREE.Vector2[];
  /** 有符号面积（正=CCW，负=CW） */
  signedArea: number;
  /** 包围盒 */
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  /** 嵌套层级（0=最外层，1=第一层孔洞，2=孔洞中的岛...） */
  nestLevel: number;
  /** 父多边形索引 */
  parentIndex: number;
  /** 子多边形索引数组 */
  childIndices: number[];
  /** 是否需要填充（奇偶规则：偶数层填充，奇数层不填充） */
  shouldFill: boolean;
}

/**
 * 嵌套多边形处理器
 * 用于处理多层嵌套的闭合多边形数据，支持检测挖洞和岛中岛
 */
export class NestedPolygonProcessor {
  private epsilon: number = 1e-6;

  /**
   * 处理闭合多边形集合，构建嵌套关系树
   * @param polygons 闭合多边形点集数组
   * @returns 带嵌套信息的多边形数组
   */
  processPolygons(polygons: THREE.Vector2[][]): NestedPolygon[] {
    if (polygons.length === 0) return [];

    // 1. 计算每个多边形的基本信息
    const polygonInfos: NestedPolygon[] = polygons.map((points, index) => {
      const cleanedPoints = this.cleanPolygonPoints(points);
      const signedArea = this.calculateSignedArea(cleanedPoints);
      const bbox = this.calculateBoundingBox(cleanedPoints);
      
      return {
        points: cleanedPoints,
        signedArea,
        bbox,
        nestLevel: 0,
        parentIndex: -1,
        childIndices: [],
        shouldFill: true
      };
    });

    // 过滤掉点数过少的多边形
    const validPolygons = polygonInfos.filter(p => p.points.length >= 3);
    if (validPolygons.length === 0) return [];

    // 2. 按面积绝对值降序排序（最大的最可能是最外层）
    const sortedIndices = validPolygons
      .map((_, i) => i)
      .sort((a, b) => Math.abs(validPolygons[b].signedArea) - Math.abs(validPolygons[a].signedArea));

    // 3. 构建嵌套关系树
    this.buildNestingTree(validPolygons, sortedIndices);

    // 4. 计算嵌套层级并确定是否填充
    this.calculateNestLevels(validPolygons);

    return validPolygons;
  }

  /**
   * 构建嵌套关系树
   */
  private buildNestingTree(polygons: NestedPolygon[], sortedIndices: number[]): void {
    for (let i = 0; i < sortedIndices.length; i++) {
      const currentIdx = sortedIndices[i];
      const current = polygons[currentIdx];
      
      // 找到直接父多边形（包含当前多边形且面积最小的多边形）
      let directParentIdx = -1;
      let minParentArea = Infinity;

      for (let j = 0; j < i; j++) {
        const candidateIdx = sortedIndices[j];
        const candidate = polygons[candidateIdx];
        
        if (this.isPolygonInsidePolygon(current, candidate)) {
          const candidateArea = Math.abs(candidate.signedArea);
          if (candidateArea < minParentArea) {
            minParentArea = candidateArea;
            directParentIdx = candidateIdx;
          }
        }
      }

      if (directParentIdx !== -1) {
        current.parentIndex = directParentIdx;
        polygons[directParentIdx].childIndices.push(currentIdx);
      }
    }
  }

  /**
   * 计算嵌套层级并确定是否填充
   */
  private calculateNestLevels(polygons: NestedPolygon[]): void {
    const roots = polygons.filter(p => p.parentIndex === -1);
    
    const setLevel = (polygon: NestedPolygon, level: number) => {
      polygon.nestLevel = level;
      polygon.shouldFill = level % 2 === 0;
      
      for (const childIdx of polygon.childIndices) {
        setLevel(polygons[childIdx], level + 1);
      }
    };

    for (const root of roots) {
      setLevel(root, 0);
    }
  }

  /**
   * 创建填充网格
   */
  createFilledMesh(polygons: NestedPolygon[], color: number): THREE.Mesh | null {
    const allVertices: number[] = [];
    const allIndices: number[] = [];
    
    // 筛选出所有需要填充的多边形（根节点或奇数层级的岛屿）
    const fillPolygons = polygons.filter(p => p.shouldFill && p.points.length >= 3);
    
    for (const polygon of fillPolygons) {
      // 对每个填充区域应用微小的 Z 偏移，层级越高，偏移越大，防止 Z-fighting
      // 这里的偏移量应非常小，以免侧面观察时明显
      const zOffset = polygon.nestLevel * 0.0001;

      try {
        // 直接使用 ShapeGeometry (earcut)，它对 CAD 这种不规则数据的容忍度更高，且不需要复杂的 preparePointsForPoly2tri
        this.addPolygonWithShapeGeometry(polygon, polygons, allVertices, allIndices, zOffset);
      } catch (error) {
        console.warn('Triangulation failed for polygon:', error);
      }
    }

    if (allIndices.length === 0) return null;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(allVertices, 3));
    geometry.setIndex(allIndices);
    geometry.computeVertexNormals();

    const material = new THREE.MeshBasicMaterial({
      color: color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
      // 对于半透明填充，关闭 depthWrite 可以减少由于排序问题导致的“破面”感
      // 只有在确定不重叠或能接受排序错误时才开启。在 CAD 填充中，通常关闭更好。
      depthWrite: false,
      depthTest: true
    });

    return new THREE.Mesh(geometry, material);
  }

  private addPolygonWithShapeGeometry(
    polygon: NestedPolygon,
    allPolygons: NestedPolygon[],
    allVertices: number[],
    allIndices: number[],
    zOffset: number = 0
  ): void {
    try {
      let outerPoints = polygon.points;
      // ShapeGeometry 内部使用 earcut，通常需要 CCW 外环
      if (polygon.signedArea < 0) {
        outerPoints = [...outerPoints].reverse();
      }

      const shape = new THREE.Shape();
      shape.moveTo(outerPoints[0].x, outerPoints[0].y);
      for (let i = 1; i < outerPoints.length; i++) {
        shape.lineTo(outerPoints[i].x, outerPoints[i].y);
      }
      shape.closePath();

      // 添加直接子级作为孔洞
      for (const childIdx of polygon.childIndices) {
        const child = allPolygons[childIdx];
        if (child.shouldFill) continue; // 跳过嵌套的岛屿（它们会作为独立 fillPolygons 处理）

        let holePoints = child.points;
        // ShapeGeometry 期望孔洞方向与外环相反（即 CW）
        if (child.signedArea > 0) {
          holePoints = [...holePoints].reverse();
        }

        const hole = new THREE.Path();
        if (holePoints.length < 3) continue;
        hole.moveTo(holePoints[0].x, holePoints[0].y);
        for (let i = 1; i < holePoints.length; i++) {
          hole.lineTo(holePoints[i].x, holePoints[i].y);
        }
        hole.closePath();
        shape.holes.push(hole);
      }

      const shapeGeom = new THREE.ShapeGeometry(shape);
      const posAttr = shapeGeom.getAttribute('position');
      const indexAttr = shapeGeom.getIndex();

      if (posAttr && indexAttr) {
        const baseOffset = allVertices.length / 3;
        for (let i = 0; i < posAttr.count; i++) {
          allVertices.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i) + zOffset);
        }
        for (let i = 0; i < indexAttr.count; i++) {
          allIndices.push(baseOffset + indexAttr.getX(i));
        }
      }
      shapeGeom.dispose();
    } catch (error) {
      console.warn('ShapeGeometry processing failed:', error);
    }
  }


  private isPolygonInsidePolygon(inner: NestedPolygon, outer: NestedPolygon): boolean {
    if (inner.bbox.minX < outer.bbox.minX - this.epsilon ||
        inner.bbox.maxX > outer.bbox.maxX + this.epsilon ||
        inner.bbox.minY < outer.bbox.minY - this.epsilon ||
        inner.bbox.maxY > outer.bbox.maxY + this.epsilon) {
      return false;
    }

    const sampleCount = Math.min(inner.points.length, 5);
    const step = Math.max(1, Math.floor(inner.points.length / sampleCount));
    let insideCount = 0;

    for (let i = 0; i < sampleCount; i++) {
      const idx = (i * step) % inner.points.length;
      if (this.isPointInPolygon(inner.points[idx], outer.points)) {
        insideCount++;
      }
    }
    return insideCount > sampleCount / 2;
  }

  private isPointInPolygon(point: THREE.Vector2, polygon: THREE.Vector2[]): boolean {
    let inside = false;
    const { x, y } = point;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  private calculateSignedArea(points: THREE.Vector2[]): number {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    return area / 2;
  }

  private calculateBoundingBox(points: THREE.Vector2[]) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY };
  }

  /**
   * 清理多边形点：去除重复点和共线点，修复自相交
   */
  private cleanPolygonPoints(points: THREE.Vector2[]): THREE.Vector2[] {
    if (points.length < 3) return points;
    
    let cleaned: THREE.Vector2[] = [];
    const epsilon = 1e-6; 
    
    // 1. 移除重复点
    for (let i = 0; i < points.length; i++) {
      const current = points[i];
      if (cleaned.length > 0) {
        const last = cleaned[cleaned.length - 1];
        if (current.distanceTo(last) < epsilon) continue;
      }
      cleaned.push(current);
    }
    
    // 2. 检查首尾闭合
    if (cleaned.length > 1) {
      const first = cleaned[0];
      const last = cleaned[cleaned.length - 1];
      if (first.distanceTo(last) < epsilon) {
        cleaned.pop();
      }
    }
    
    if (cleaned.length < 3) return [];

    // 3. 移除共线点 (使用面积法判定，更稳定)
    const noCollinear: THREE.Vector2[] = [];
    for (let i = 0; i < cleaned.length; i++) {
      const prev = cleaned[(i - 1 + cleaned.length) % cleaned.length];
      const curr = cleaned[i];
      const next = cleaned[(i + 1) % cleaned.length];
      
      const area = Math.abs((curr.x - prev.x) * (next.y - prev.y) - (next.x - prev.x) * (curr.y - prev.y));
      // 如果面积非常小，说明三点几乎共线，移除中间点
      if (area > 1e-8) {
        noCollinear.push(curr);
      }
    }
    
    if (noCollinear.length < 3) return [];

    // 4. 粗修复自相交 (移除尖锐回退)
    return this.fixSelfIntersections(noCollinear);
  }

  /**
   * 修复自相交 (移除尖锐回退点)
   */
  private fixSelfIntersections(points: THREE.Vector2[]): THREE.Vector2[] {
    const result: THREE.Vector2[] = [];
    const n = points.length;
    
    for (let i = 0; i < n; i++) {
      const curr = points[i];
      if (result.length >= 2) {
        const prev = result[result.length - 1];
        const prevPrev = result[result.length - 2];
        
        const v1 = new THREE.Vector2().subVectors(prev, prevPrev);
        const v2 = new THREE.Vector2().subVectors(curr, prev);
        
        const v1Len = v1.length();
        const v2Len = v2.length();
        
        if (v1Len > 1e-9 && v2Len > 1e-9) {
          const dot = v1.dot(v2) / (v1Len * v2Len);
          // 如果点几乎完全反向 (dot < -0.999), 则说明发生了尖锐回退，跳过 prev 点
          if (dot < -0.9999) {
            result.pop();
            // 递归检查新的 prev
            i--; 
            continue;
          }
        }
      }
      result.push(curr);
    }
    return result;
  }
}


