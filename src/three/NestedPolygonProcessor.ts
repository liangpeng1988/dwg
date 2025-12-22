import * as THREE from 'three';
import * as poly2tri from 'poly2tri';

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

    // 2. 按面积绝对值降序排序（最大的最可能是最外层）
    const sortedIndices = polygonInfos
      .map((_, i) => i)
      .sort((a, b) => Math.abs(polygonInfos[b].signedArea) - Math.abs(polygonInfos[a].signedArea));

    // 3. 构建嵌套关系树
    this.buildNestingTree(polygonInfos, sortedIndices);

    // 4. 计算嵌套层级并确定是否填充
    this.calculateNestLevels(polygonInfos);

    return polygonInfos;
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
    // 找到所有根节点（没有父节点的多边形）
    const roots = polygons.filter(p => p.parentIndex === -1);
    
    // 递归计算层级
    const setLevel = (polygon: NestedPolygon, level: number) => {
      polygon.nestLevel = level;
      // 奇偶规则：偶数层（0, 2, 4...）填充，奇数层（1, 3, 5...）是孔洞
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
   * 创建填充网格（处理嵌套孔洞）
   * @param polygons 处理后的嵌套多边形数组
   * @param color 填充颜色
   * @returns THREE.Mesh 或 null
   */
  createFilledMesh(polygons: NestedPolygon[], color: number): THREE.Mesh | null {
    const allVertices: number[] = [];
    const allIndices: number[] = [];
    let vertexOffset = 0;

    // 处理每个需要填充的多边形
    for (const polygon of polygons) {
      if (!polygon.shouldFill || polygon.points.length < 3) continue;

      try {
        // 确保外边界是逆时针方向
        let outerPoints = polygon.points;
        if (polygon.signedArea < 0) {
          outerPoints = [...outerPoints].reverse();
        }

        // 准备 poly2tri 轮廓
        const contour = this.preparePointsForPoly2tri(outerPoints)
          .map(p => new poly2tri.Point(p.x, p.y));
        
        if (contour.length < 3) continue;
        
        const swctx = new poly2tri.SweepContext(contour);

        // 添加直接子多边形作为孔洞（它们是 shouldFill=false 的）
        for (const childIdx of polygon.childIndices) {
          const child = polygons[childIdx];
          if (child.shouldFill) continue; // 跳过需要填充的子多边形（岛中岛）

          let holePoints = child.points;
          // 确保孔洞是顺时针方向
          if (child.signedArea > 0) {
            holePoints = [...holePoints].reverse();
          }

          const holePrepared = this.preparePointsForPoly2tri(holePoints);
          if (holePrepared.length >= 3) {
            const holeContour = holePrepared.map(p => new poly2tri.Point(p.x, p.y));
            swctx.addHole(holeContour);
          }
        }

        // 执行三角剖分
        swctx.triangulate();
        const triangles = swctx.getTriangles();

        // 收集顶点和索引
        const pointIndexMap = new Map<string, number>();

        for (const tri of triangles) {
          const triPoints = tri.getPoints();
          for (const tp of triPoints) {
            const key = `${tp.x.toFixed(6)},${tp.y.toFixed(6)}`;
            if (!pointIndexMap.has(key)) {
              pointIndexMap.set(key, vertexOffset + allVertices.length / 3);
              allVertices.push(tp.x, tp.y, 0);
            }
            allIndices.push(pointIndexMap.get(key)!);
          }
        }

        vertexOffset = allVertices.length / 3;

      } catch (error) {
        console.warn('poly2tri failed for polygon, trying ShapeGeometry:', error);
        // 回退到 ShapeGeometry
        this.addPolygonWithShapeGeometry(polygon, polygons, allVertices, allIndices, vertexOffset);
        vertexOffset = allVertices.length / 3;
      }
    }

    if (allIndices.length === 0) return null;

    // 创建 BufferGeometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(allVertices, 3));
    geometry.setIndex(allIndices);
    geometry.computeVertexNormals();

    const material = new THREE.MeshBasicMaterial({
      color: color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });

    return new THREE.Mesh(geometry, material);
  }

  /**
   * 使用 ShapeGeometry 添加多边形（回退方案）
   */
  private addPolygonWithShapeGeometry(
    polygon: NestedPolygon,
    allPolygons: NestedPolygon[],
    allVertices: number[],
    allIndices: number[],
    vertexOffset: number
  ): void {
    try {
      let outerPoints = polygon.points;
      if (polygon.signedArea < 0) {
        outerPoints = [...outerPoints].reverse();
      }

      const shape = new THREE.Shape();
      shape.moveTo(outerPoints[0].x, outerPoints[0].y);
      for (let i = 1; i < outerPoints.length; i++) {
        shape.lineTo(outerPoints[i].x, outerPoints[i].y);
      }
      shape.closePath();

      // 添加孔洞
      for (const childIdx of polygon.childIndices) {
        const child = allPolygons[childIdx];
        if (child.shouldFill) continue;

        let holePoints = child.points;
        if (child.signedArea > 0) {
          holePoints = [...holePoints].reverse();
        }

        const hole = new THREE.Path();
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
          allVertices.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
        }
        for (let i = 0; i < indexAttr.count; i++) {
          allIndices.push(baseOffset + indexAttr.getX(i));
        }
      }

      shapeGeom.dispose();
    } catch (error) {
      console.warn('ShapeGeometry also failed:', error);
    }
  }

  /**
   * 检查多边形A是否在多边形B内部
   */
  private isPolygonInsidePolygon(inner: NestedPolygon, outer: NestedPolygon): boolean {
    // 先检查包围盒
    if (inner.bbox.minX < outer.bbox.minX - this.epsilon ||
        inner.bbox.maxX > outer.bbox.maxX + this.epsilon ||
        inner.bbox.minY < outer.bbox.minY - this.epsilon ||
        inner.bbox.maxY > outer.bbox.maxY + this.epsilon) {
      return false;
    }

    // 检查多个采样点
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

  /**
   * 检查点是否在多边形内部（射线法）
   */
  private isPointInPolygon(point: THREE.Vector2, polygon: THREE.Vector2[]): boolean {
    let inside = false;
    const x = point.x;
    const y = point.y;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;

      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }

    return inside;
  }

  /**
   * 计算多边形的有符号面积
   * 正值表示逆时针（CCW），负值表示顺时针（CW）
   */
  private calculateSignedArea(points: THREE.Vector2[]): number {
    let area = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    return area / 2;
  }

  /**
   * 计算包围盒
   */
  private calculateBoundingBox(points: THREE.Vector2[]): { minX: number; minY: number; maxX: number; maxY: number } {
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
   * 清理多边形点：去除重复点和过近的点
   */
  private cleanPolygonPoints(points: THREE.Vector2[]): THREE.Vector2[] {
    if (points.length < 3) return points;

    const cleaned: THREE.Vector2[] = [];
    const epsilon = 1e-4;

    for (let i = 0; i < points.length; i++) {
      const current = points[i];

      if (cleaned.length > 0) {
        const last = cleaned[cleaned.length - 1];
        const dx = current.x - last.x;
        const dy = current.y - last.y;
        if (dx * dx + dy * dy < epsilon * epsilon) {
          continue;
        }
      }

      cleaned.push(current);
    }

    // 检查首尾是否重复
    if (cleaned.length > 1) {
      const first = cleaned[0];
      const last = cleaned[cleaned.length - 1];
      const dx = first.x - last.x;
      const dy = first.y - last.y;
      if (dx * dx + dy * dy < epsilon * epsilon) {
        cleaned.pop();
      }
    }

    return cleaned;
  }

  /**
   * 为 poly2tri 准备点数据
   */
  private preparePointsForPoly2tri(points: THREE.Vector2[]): THREE.Vector2[] {
    if (points.length < 3) return [];

    // 使用更高精度的去重
    const epsilon = 1e-6;
    const seen = new Set<string>();
    const result: THREE.Vector2[] = [];

    for (const p of points) {
      const key = `${Math.round(p.x / epsilon) * epsilon},${Math.round(p.y / epsilon) * epsilon}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(p);
      }
    }

    return result;
  }

  /**
   * 获取需要填充的多边形（按嵌套层级分组）
   */
  getPolygonsByLevel(polygons: NestedPolygon[]): Map<number, NestedPolygon[]> {
    const byLevel = new Map<number, NestedPolygon[]>();
    
    for (const p of polygons) {
      if (!byLevel.has(p.nestLevel)) {
        byLevel.set(p.nestLevel, []);
      }
      byLevel.get(p.nestLevel)!.push(p);
    }

    return byLevel;
  }

  /**
   * 打印嵌套结构（调试用）
   */
  printNestingStructure(polygons: NestedPolygon[]): void {
    const printNode = (polygon: NestedPolygon, idx: number, indent: string) => {
      console.log(`${indent}[${idx}] Level=${polygon.nestLevel}, Fill=${polygon.shouldFill}, Area=${polygon.signedArea.toFixed(2)}`);
      for (const childIdx of polygon.childIndices) {
        printNode(polygons[childIdx], childIdx, indent + '  ');
      }
    };

    console.log('=== Nesting Structure ===');
    for (let i = 0; i < polygons.length; i++) {
      if (polygons[i].parentIndex === -1) {
        printNode(polygons[i], i, '');
      }
    }
  }
}
