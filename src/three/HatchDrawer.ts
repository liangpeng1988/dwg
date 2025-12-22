import * as THREE from 'three';
import * as poly2tri from 'poly2tri';
import { BaseDrawer } from './BaseDrawer';
import { DwgEntity } from '../database';
import { DwgHatchEntity } from '../database/entities/hatch';

/**
 * HATCH 实体绘制器
 * 专门处理填充图案实体的绘制
 */
export class HatchDrawer extends BaseDrawer<DwgEntity> {
  // 调试开关：显示顶点球体
  private static DEBUG_VERTICES = true;
  // 调试球体半径
  private static DEBUG_SPHERE_RADIUS = 0.5;
  
  draw(entity: DwgEntity): THREE.Group | null {
    const group = new THREE.Group();
    
    // 类型检查
    if (!this.canDraw(entity)) return null;
    
    // 获取边界路径
    const hatchEntity = entity as DwgHatchEntity;
    const boundaryPaths = hatchEntity.boundaryPaths || [];
    if (boundaryPaths.length === 0) return null;
    
    // 获取颜色
    const color = this.getHatchColor(hatchEntity);
    const isSolidFill = hatchEntity.solidFill === 1;
    
    try {
      if (isSolidFill) {
        // 实心填充 - 支持孔洞
        const mesh = this.createSolidFillWithHoles(boundaryPaths, color, hatchEntity.hatchStyle);
        if (mesh) {
          group.add(mesh);
        }
      } else {
        // 非实心填充 - 只绘制边界线
        for (const boundaryPath of boundaryPaths) {
          const shapePoints = this.extractBoundaryPoints(boundaryPath);
          if (shapePoints.length >= 3) {
            const line = this.createBoundaryLine(shapePoints, color);
            group.add(line);
          }
        }
      }
      
      // 应用 extrusionDirection
      if (hatchEntity.extrusionDirection) {
        if (hatchEntity.extrusionDirection.z === -1) {
          group.scale.x *= -1;
        }
      }
      
      // 应用 elevation（Z轴位置）
      if (hatchEntity.elevation != null) {
        group.position.z = hatchEntity.elevation * this.scaleFactor;
      }
    } catch (error) {
      console.error('Error drawing hatch:', error);
    }
    
    return group.children.length > 0 ? group : null;
  }

  canDraw(entity: DwgEntity): entity is DwgHatchEntity {
    return entity.type === 'HATCH' || entity.type === 'MPOLYGON';
  }

  /**
   * 获取 HATCH 颜色
   * 使用 BaseDrawer 的颜色处理逻辑，与 SVG 保持一致
   */
  private getHatchColor(entity: DwgHatchEntity): number {
    // 使用 BaseDrawer 的 getEntityColor 方法
    // 默认颜色使用灰色 0x888888
    return this.getEntityColor(entity, 0x888888);
  }

  /**
   * 创建调试用的顶点球体
   * 为每个顶点创建一个小球体来可视化顶点位置
   */
  private createDebugVertexSpheres(points: THREE.Vector2[], elevation: number = 0): THREE.Group {
    const group = new THREE.Group();
    const radius = HatchDrawer.DEBUG_SPHERE_RADIUS;
    const z = elevation * this.scaleFactor;
    
    // 颜色序列：红、绿、蓝、黄、青、品红
    const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0x00ffff, 0xff00ff];
    
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const color = colors[i % colors.length];
      
      // 创建球体几何体
      const geometry = new THREE.SphereGeometry(radius, 8, 6);
      const material = new THREE.MeshBasicMaterial({ color });
      const sphere = new THREE.Mesh(geometry, material);
      
      // 设置位置
      sphere.position.set(p.x, p.y, z);
      
      // 添加索引标签（通过 userData）
      sphere.userData = {
        vertexIndex: i,
        x: p.x,
        y: p.y,
        z: z
      };
      
      group.add(sphere);
    }
    
    console.log(`[HatchDrawer DEBUG] 创建 ${points.length} 个顶点球体`);
    
    return group;
  }

  /**
   * 从边界路径提取点
   */
  private extractBoundaryPoints(boundaryPath: any): THREE.Vector2[] {
    const points: THREE.Vector2[] = [];
    
    // 多段线边界
    if (boundaryPath.vertices && boundaryPath.vertices.length > 0) {
      const vertices = boundaryPath.vertices;
      for (let i = 0; i < vertices.length; i++) {
        const vertex = vertices[i];
        const x = (vertex.x || 0) * this.scaleFactor;
        const y = (vertex.y || 0) * this.scaleFactor;
        points.push(new THREE.Vector2(x, y));
        
        // 处理 bulge（凸度）
        if (vertex.bulge && Math.abs(vertex.bulge) > 1e-6) {
          const nextIndex = (i + 1) % vertices.length;
          const nextVertex = vertices[nextIndex];
          if (nextVertex) {
            const arcPoints = this.interpolateBulge(
              { x: vertex.x, y: vertex.y },
              { x: nextVertex.x, y: nextVertex.y },
              vertex.bulge
            );
            // 弧线点不包含起点和终点，避免重复
            points.push(...arcPoints);
          }
        }
      }
    }
    
    // 边界边
    if (boundaryPath.edges && boundaryPath.edges.length > 0) {
      for (let i = 0; i < boundaryPath.edges.length; i++) {
        const edge = boundaryPath.edges[i];
        const isFirst = (i === 0);
        const edgePoints = this.extractEdgePoints(edge, isFirst);
        points.push(...edgePoints);
      }
    }
    
    return points;
  }

  /**
   * 从边界边提取点
   * @param edge 边界边
   * @param includeStart 是否包含起点（第一个边需要包含，后续边不需要）
   */
  private extractEdgePoints(edge: any, includeStart: boolean = true): THREE.Vector2[] {
    const points: THREE.Vector2[] = [];
    const edgeType = edge.type || edge.edgeType;
    
    switch (edgeType) {
      case 1: // LINE
      case 'LINE':
        if (includeStart && edge.start) {
          points.push(new THREE.Vector2(
            (edge.start.x || 0) * this.scaleFactor,
            (edge.start.y || 0) * this.scaleFactor
          ));
        }
        // 只添加终点，起点由上一个边提供
        if (edge.end) {
          points.push(new THREE.Vector2(
            (edge.end.x || 0) * this.scaleFactor,
            (edge.end.y || 0) * this.scaleFactor
          ));
        }
        break;
        
      case 2: // ARC
      case 'ARC':
        if (edge.center && edge.radius != null) {
          const cx = (edge.center.x || 0) * this.scaleFactor;
          const cy = (edge.center.y || 0) * this.scaleFactor;
          const radius = edge.radius * this.scaleFactor;
          const startAngle = edge.startAngle || 0;
          const endAngle = edge.endAngle || Math.PI * 2;
          const isCCW = edge.isCCW !== false;
          
          const arcPoints = this.generateArcPoints(cx, cy, radius, startAngle, endAngle, isCCW, includeStart);
          points.push(...arcPoints);
        }
        break;
        
      case 3: // ELLIPSE
      case 'ELLIPSE':
        if (edge.center) {
          const cx = (edge.center.x || 0) * this.scaleFactor;
          const cy = (edge.center.y || 0) * this.scaleFactor;
          const startAngle = edge.startAngle || 0;
          const endAngle = edge.endAngle || Math.PI * 2;
          
          // 计算主轴长度
          let majorRadius = 1 * this.scaleFactor;
          let rotation = 0;
          if (edge.end) {
            const dx = (edge.end.x || 0) * this.scaleFactor;
            const dy = (edge.end.y || 0) * this.scaleFactor;
            majorRadius = Math.sqrt(dx * dx + dy * dy);
            rotation = Math.atan2(dy, dx);
          }
          const minorRadius = majorRadius * (edge.lengthOfMinorAxis || 0.5);
          
          const ellipsePoints = this.generateEllipsePoints(
            cx, cy, majorRadius, minorRadius, startAngle, endAngle, rotation, includeStart
          );
          points.push(...ellipsePoints);
        }
        break;
        
      case 4: // SPLINE
      case 'SPLINE':
        // 使用控制点或拟合点
        if (edge.fitDatum && edge.fitDatum.length > 0) {
          // 优先使用拟合点
          const startIdx = includeStart ? 0 : 1;
          for (let i = startIdx; i < edge.fitDatum.length; i++) {
            const fp = edge.fitDatum[i];
            points.push(new THREE.Vector2(
              (fp.x || 0) * this.scaleFactor,
              (fp.y || 0) * this.scaleFactor
            ));
          }
        } else if (edge.controlPoints && edge.controlPoints.length > 0) {
          // 使用控制点插值
          const splinePoints = this.interpolateSpline(edge, includeStart);
          points.push(...splinePoints);
        }
        break;
    }
    
    return points;
  }

  /**
   * 生成圆弧点
   * @param includeStart 是否包含起点
   */
  private generateArcPoints(
    cx: number, cy: number, radius: number,
    startAngle: number, endAngle: number, isCCW: boolean,
    includeStart: boolean = true
  ): THREE.Vector2[] {
    const points: THREE.Vector2[] = [];
    const segments = 32;
    
    let angle = endAngle - startAngle;
    if (isCCW && angle < 0) angle += Math.PI * 2;
    if (!isCCW && angle > 0) angle -= Math.PI * 2;
    
    const startIdx = includeStart ? 0 : 1;
    for (let i = startIdx; i <= segments; i++) {
      const t = i / segments;
      const a = startAngle + angle * t;
      points.push(new THREE.Vector2(
        cx + radius * Math.cos(a),
        cy + radius * Math.sin(a)
      ));
    }
    
    return points;
  }

  /**
   * 生成椭圆点
   * @param rotation 椭圆旋转角度
   * @param includeStart 是否包含起点
   */
  private generateEllipsePoints(
    cx: number, cy: number,
    majorRadius: number, minorRadius: number,
    startAngle: number, endAngle: number,
    rotation: number = 0, includeStart: boolean = true
  ): THREE.Vector2[] {
    const points: THREE.Vector2[] = [];
    const segments = 32;
    
    const angle = endAngle - startAngle;
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    
    const startIdx = includeStart ? 0 : 1;
    for (let i = startIdx; i <= segments; i++) {
      const t = i / segments;
      const a = startAngle + angle * t;
      // 计算椭圆上的点（未旋转）
      const px = majorRadius * Math.cos(a);
      const py = minorRadius * Math.sin(a);
      // 应用旋转
      const rx = px * cosR - py * sinR;
      const ry = px * sinR + py * cosR;
      points.push(new THREE.Vector2(cx + rx, cy + ry));
    }
    
    return points;
  }

  /**
   * 插值 bulge 弧线 (2D)
   */
  private interpolateBulge(
    start: { x: number; y: number },
    end: { x: number; y: number },
    bulge: number
  ): THREE.Vector2[] {
    const points: THREE.Vector2[] = [];
    
    const startX = (start.x || 0) * this.scaleFactor;
    const startY = (start.y || 0) * this.scaleFactor;
    const endX = (end.x || 0) * this.scaleFactor;
    const endY = (end.y || 0) * this.scaleFactor;
    
    const dx = endX - startX;
    const dy = endY - startY;
    const chordLength = Math.sqrt(dx * dx + dy * dy);
    
    if (chordLength < 1e-6) return points;
    
    const theta = 4 * Math.atan(Math.abs(bulge));
    const radius = chordLength / (2 * Math.sin(theta / 2));
    
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    
    const sagitta = radius * (1 - Math.cos(theta / 2));
    const apothemLength = radius - sagitta;
    
    const nx = -dy / chordLength;
    const ny = dx / chordLength;
    
    const sign = bulge > 0 ? 1 : -1;
    const cx = midX + sign * apothemLength * nx;
    const cy = midY + sign * apothemLength * ny;
    
    const startAngle = Math.atan2(startY - cy, startX - cx);
    
    const segments = Math.max(8, Math.ceil(Math.abs(theta) * 10));
    const angleStep = (bulge > 0 ? 1 : -1) * theta / segments;
    
    for (let i = 1; i < segments; i++) {
      const angle = startAngle + i * angleStep;
      points.push(new THREE.Vector2(
        cx + radius * Math.cos(angle),
        cy + radius * Math.sin(angle)
      ));
    }
    
    return points;
  }

  /**
   * 插值样条曲线
   */
  private interpolateSpline(edge: any, includeStart: boolean): THREE.Vector2[] {
    const points: THREE.Vector2[] = [];
    const controlPoints = edge.controlPoints || [];
    if (controlPoints.length < 2) return points;
    
    // 简化处理：使用 Catmull-Rom 插值
    const segments = Math.max(controlPoints.length * 4, 16);
    const startIdx = includeStart ? 0 : 1;
    
    for (let i = startIdx; i <= segments; i++) {
      const t = i / segments;
      const pt = this.catmullRomInterpolate(controlPoints, t);
      points.push(new THREE.Vector2(
        pt.x * this.scaleFactor,
        pt.y * this.scaleFactor
      ));
    }
    
    return points;
  }

  /**
   * Catmull-Rom 插值
   */
  private catmullRomInterpolate(points: any[], t: number): { x: number; y: number } {
    const n = points.length;
    if (n === 0) return { x: 0, y: 0 };
    if (n === 1) return { x: points[0].x || 0, y: points[0].y || 0 };
    
    const p = t * (n - 1);
    const i = Math.floor(p);
    const f = p - i;
    
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[Math.min(n - 1, i + 1)];
    const p3 = points[Math.min(n - 1, i + 2)];
    
    const x = this.catmullRom(p0.x || 0, p1.x || 0, p2.x || 0, p3.x || 0, f);
    const y = this.catmullRom(p0.y || 0, p1.y || 0, p2.y || 0, p3.y || 0, f);
    
    return { x, y };
  }

  private catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * (
      (2 * p1) +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    );
  }

  /**
   * 创建带孔洞的实心填充
   * @param boundaryPaths 所有边界路径
   * @param color 填充颜色
   * @param hatchStyle 填充样式 (0=Normal, 1=Outer, 2=Ignore)
   */
  private createSolidFillWithHoles(
    boundaryPaths: any[],
    color: number,
    hatchStyle?: number
  ): THREE.Mesh | null {
    if (boundaryPaths.length === 0) return null;
    
    try {
      // 提取所有边界路径的点并计算面积
      const pathsWithArea: { path: any; points: THREE.Vector2[]; area: number; isOuter: boolean; bbox: { minX: number; minY: number; maxX: number; maxY: number } }[] = [];
      
      for (const path of boundaryPaths) {
        const points = this.extractBoundaryPoints(path);
        if (points.length < 3) continue;
        
        // 清理点：去除重复点和过近的点
        let cleanedPoints = this.cleanPolygonPoints(points);
        if (cleanedPoints.length < 3) continue;
        
        // 修复自相交多边形
        cleanedPoints = this.fixSelfIntersections(cleanedPoints);
        if (cleanedPoints.length < 3) continue;
        
        const area = this.calculateSignedArea(cleanedPoints);
        const flag = path.boundaryPathTypeFlag || 0;
        // 外边界: External (1) 或 Outermost (16)
        const isOuter = (flag & 1) !== 0 || (flag & 16) !== 0;
        const bbox = this.calculateBoundingBox(cleanedPoints);
        
        pathsWithArea.push({ path, points: cleanedPoints, area, isOuter, bbox });
      }
      
      if (pathsWithArea.length === 0) return null;
      
      // 按面积绝对值排序，最大的是外边界
      pathsWithArea.sort((a, b) => Math.abs(b.area) - Math.abs(a.area));
      
      // 分类：第一个最大的是外边界，其他是孔洞
      const outerPaths: typeof pathsWithArea = [];
      const innerPaths: typeof pathsWithArea = [];
      
      for (let i = 0; i < pathsWithArea.length; i++) {
        const p = pathsWithArea[i];
        if (i === 0 || p.isOuter) {
          outerPaths.push(p);
        } else {
          innerPaths.push(p);
        }
      }
      
      // 如果只有一个路径且没有孔洞，直接创建
      if (outerPaths.length === 1 && innerPaths.length === 0) {
        return this.createSolidFillMesh(outerPaths[0].points, color);
      }
      
      // 使用 poly2tri 进行三角剖分（更稳定的孔洞处理）
      const allTriangles: number[] = [];
      const allVertices: number[] = [];
      let vertexOffset = 0;
      
      for (const outer of outerPaths) {
        // 确保外边界是逆时针方向（面积 > 0）
        let outerPoints = outer.points;
        if (outer.area < 0) {
          outerPoints = [...outerPoints].reverse();
        }
        
        try {
          // 为 poly2tri 准备点数据（需要去除重复点）
          const contourPoints = this.preparePointsForPoly2tri(outerPoints);
          if (contourPoints.length < 3) continue;
          
          // 创建 poly2tri 轮廓
          const contour = contourPoints.map(p => new poly2tri.Point(p.x, p.y));
          const swctx = new poly2tri.SweepContext(contour);
          
          // 添加孔洞
          for (const inner of innerPaths) {
            if (!this.isPolygonInsidePolygon(inner.points, inner.bbox, outerPoints, outer.bbox)) {
              continue;
            }
            
            // 确保孔洞是顺时针方向（面积 < 0）
            let holePoints = inner.points;
            if (inner.area > 0) {
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
              allTriangles.push(pointIndexMap.get(key)!);
            }
          }
          
          vertexOffset = allVertices.length / 3;
          
        } catch (poly2triError) {
          // poly2tri 失败时回退到 ShapeGeometry
          console.warn('poly2tri triangulation failed, falling back to ShapeGeometry:', poly2triError);
          return this.createSolidFillWithShapeGeometry(outerPaths, innerPaths, color);
        }
      }
      
      if (allTriangles.length === 0) return null;
      
      // 创建 BufferGeometry
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(allVertices, 3));
      geometry.setIndex(allTriangles);
      geometry.computeVertexNormals();
      
      const material = new THREE.MeshBasicMaterial({
        color: color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      });
      
      return new THREE.Mesh(geometry, material);
      
    } catch (error) {
      console.error('Error creating solid fill with holes:', error);
      try {
        const points = this.extractBoundaryPoints(boundaryPaths[0]);
        return this.createSolidFillMesh(points, color);
      } catch {
        return null;
      }
    }
  }

  /**
   * 计算多边形包围盒
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
   * 为 poly2tri 准备点数据
   * poly2tri 要求：没有重复点、没有共线点
   */
  private preparePointsForPoly2tri(points: THREE.Vector2[]): THREE.Vector2[] {
    if (points.length < 3) return points;
    
    const epsilon = 1e-8;
    const result: THREE.Vector2[] = [];
    const seen = new Set<string>();
    
    for (const p of points) {
      // 使用高精度的 key 来检测重复点
      const key = `${p.x.toFixed(8)},${p.y.toFixed(8)}`;
      if (seen.has(key)) continue;
      
      // 检查是否与前一个点太近
      if (result.length > 0) {
        const last = result[result.length - 1];
        const dx = p.x - last.x;
        const dy = p.y - last.y;
        if (dx * dx + dy * dy < epsilon * epsilon) continue;
      }
      
      seen.add(key);
      result.push(p);
    }
    
    // 检查首尾点是否重复
    if (result.length > 1) {
      const first = result[0];
      const last = result[result.length - 1];
      const dx = first.x - last.x;
      const dy = first.y - last.y;
      if (dx * dx + dy * dy < epsilon * epsilon) {
        result.pop();
      }
    }
    
    // poly2tri 要求至少 3 个点
    if (result.length < 3) return [];
    
    // 移除共线点
    return this.removeCollinearPoints(result);
  }

  /**
   * 移除共线点（poly2tri 不能处理共线点）
   */
  private removeCollinearPoints(points: THREE.Vector2[]): THREE.Vector2[] {
    if (points.length < 3) return points;
    
    const epsilon = 1e-10;
    const result: THREE.Vector2[] = [];
    const n = points.length;
    
    for (let i = 0; i < n; i++) {
      const prev = points[(i - 1 + n) % n];
      const curr = points[i];
      const next = points[(i + 1) % n];
      
      // 计算叉积检测共线
      const cross = (curr.x - prev.x) * (next.y - prev.y) - (curr.y - prev.y) * (next.x - prev.x);
      
      // 如果不共线，保留这个点
      if (Math.abs(cross) > epsilon) {
        result.push(curr);
      }
    }
    
    return result.length >= 3 ? result : points;
  }

  /**
   * 使用 poly2tri 创建带孔洞的填充（备用方法，逐个处理）
   * 处理多个闭合空间
   */
  private createSolidFillWithShapeGeometry(
    outerPaths: { points: THREE.Vector2[]; area: number; bbox: { minX: number; minY: number; maxX: number; maxY: number } }[],
    innerPaths: { points: THREE.Vector2[]; area: number; bbox: { minX: number; minY: number; maxX: number; maxY: number } }[],
    color: number
  ): THREE.Mesh | null {
    const allVertices: number[] = [];
    const allIndices: number[] = [];
    let vertexOffset = 0;
    
    for (const outer of outerPaths) {
      // 确保外边界是逆时针方向
      let outerPoints = outer.points;
      if (outer.area < 0) {
        outerPoints = [...outerPoints].reverse();
      }
      
      // 收集属于这个外边界的孔洞
      const holesForThisOuter: THREE.Vector2[][] = [];
      for (const inner of innerPaths) {
        if (this.isPolygonInsidePolygon(inner.points, inner.bbox, outerPoints, outer.bbox)) {
          let holePoints = inner.points;
          if (inner.area > 0) {
            holePoints = [...holePoints].reverse();
          }
          holesForThisOuter.push(holePoints);
        }
      }
      
      try {
        // 为 poly2tri 准备点
        const preparedOuter = this.preparePointsForPoly2tri(outerPoints);
        if (preparedOuter.length < 3) continue;
        
        const contour = preparedOuter.map(p => new poly2tri.Point(p.x, p.y));
        const swctx = new poly2tri.SweepContext(contour);
        
        // 添加孔洞
        for (const holePoints of holesForThisOuter) {
          const preparedHole = this.preparePointsForPoly2tri(holePoints);
          if (preparedHole.length >= 3) {
            const holeContour = preparedHole.map(p => new poly2tri.Point(p.x, p.y));
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
        
      } catch (poly2triError) {
        // 单个外边界失败，尝试使用 ShapeGeometry
        console.warn('poly2tri failed for outer path, trying ShapeGeometry:', poly2triError);
        try {
          const shape = new THREE.Shape();
          shape.moveTo(outerPoints[0].x, outerPoints[0].y);
          for (let i = 1; i < outerPoints.length; i++) {
            shape.lineTo(outerPoints[i].x, outerPoints[i].y);
          }
          shape.closePath();
          
          for (const holePoints of holesForThisOuter) {
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
            vertexOffset = allVertices.length / 3;
          }
          
          shapeGeom.dispose();
        } catch (shapeError) {
          console.warn('ShapeGeometry also failed:', shapeError);
        }
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
      opacity: 0.8
    });
    
    return new THREE.Mesh(geometry, material);
  }

  /**
   * 检查多边形A是否完全在多边形B内部
   */
  private isPolygonInsidePolygon(
    innerPoints: THREE.Vector2[],
    innerBBox: { minX: number; minY: number; maxX: number; maxY: number },
    outerPoints: THREE.Vector2[],
    outerBBox: { minX: number; minY: number; maxX: number; maxY: number }
  ): boolean {
    // 先检查包围盒
    if (innerBBox.minX < outerBBox.minX || innerBBox.maxX > outerBBox.maxX ||
        innerBBox.minY < outerBBox.minY || innerBBox.maxY > outerBBox.maxY) {
      return false;
    }
    
    // 检查多个点确保可靠性
    const sampleCount = Math.min(innerPoints.length, 5);
    const step = Math.floor(innerPoints.length / sampleCount);
    let insideCount = 0;
    
    for (let i = 0; i < sampleCount; i++) {
      const idx = (i * step) % innerPoints.length;
      if (this.isPointInPolygon(innerPoints[idx], outerPoints)) {
        insideCount++;
      }
    }
    
    // 如果大多数点在内部，认为在内部
    return insideCount >= sampleCount / 2;
  }

  /**
   * 检查点是否在多边形内部 (射线法)
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
   * 修复自相交多边形
   * 简化版本：移除导致自相交的点
   */
  private fixSelfIntersections(points: THREE.Vector2[]): THREE.Vector2[] {
    if (points.length < 4) return points;
    
    const epsilon = 1e-6;
    const result: THREE.Vector2[] = [];
    const n = points.length;
    
    // 检测简单的自相交情况（相邻边回跳）
    for (let i = 0; i < n; i++) {
      const curr = points[i];
      const prev = result.length > 0 ? result[result.length - 1] : null;
      
      // 检查是否与之前的点形成尖角（突然回跳）
      if (result.length >= 2 && prev) {
        const prevPrev = result[result.length - 2];
        
        // 计算角度变化
        const v1x = prev.x - prevPrev.x;
        const v1y = prev.y - prevPrev.y;
        const v2x = curr.x - prev.x;
        const v2y = curr.y - prev.y;
        
        const cross = v1x * v2y - v1y * v2x;
        const dot = v1x * v2x + v1y * v2y;
        
        // 如果方向突然反转（尖角），跳过这个点
        if (dot < 0 && Math.abs(cross) < epsilon) {
          continue;
        }
      }
      
      result.push(curr);
    }
    
    // 检查是否有边相交，如果有则简化多边形
    if (this.hasIntersectingEdges(result)) {
      // 尝试简化：只保留凸包
      return this.computeConvexHull(result);
    }
    
    return result;
  }

  /**
   * 检查多边形是否有相交的边
   */
  private hasIntersectingEdges(points: THREE.Vector2[]): boolean {
    const n = points.length;
    if (n < 4) return false;
    
    for (let i = 0; i < n; i++) {
      const a1 = points[i];
      const a2 = points[(i + 1) % n];
      
      // 检查与非相邻的边是否相交
      for (let j = i + 2; j < n; j++) {
        if (j === (i + n - 1) % n) continue; // 跳过相邻边
        
        const b1 = points[j];
        const b2 = points[(j + 1) % n];
        
        if (this.segmentsIntersect(a1, a2, b1, b2)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * 检查两条线段是否相交
   */
  private segmentsIntersect(
    a1: THREE.Vector2, a2: THREE.Vector2,
    b1: THREE.Vector2, b2: THREE.Vector2
  ): boolean {
    const d1 = this.crossProduct(b2.x - b1.x, b2.y - b1.y, a1.x - b1.x, a1.y - b1.y);
    const d2 = this.crossProduct(b2.x - b1.x, b2.y - b1.y, a2.x - b1.x, a2.y - b1.y);
    const d3 = this.crossProduct(a2.x - a1.x, a2.y - a1.y, b1.x - a1.x, b1.y - a1.y);
    const d4 = this.crossProduct(a2.x - a1.x, a2.y - a1.y, b2.x - a1.x, b2.y - a1.y);
    
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
      return true;
    }
    
    return false;
  }

  private crossProduct(ax: number, ay: number, bx: number, by: number): number {
    return ax * by - ay * bx;
  }

  /**
   * 计算凸包（Graham 扫描法）
   */
  private computeConvexHull(points: THREE.Vector2[]): THREE.Vector2[] {
    if (points.length < 3) return points;
    
    // 找到最下方的点
    let start = 0;
    for (let i = 1; i < points.length; i++) {
      if (points[i].y < points[start].y ||
         (points[i].y === points[start].y && points[i].x < points[start].x)) {
        start = i;
      }
    }
    
    const pivot = points[start];
    const sorted = points.slice().sort((a, b) => {
      const angleA = Math.atan2(a.y - pivot.y, a.x - pivot.x);
      const angleB = Math.atan2(b.y - pivot.y, b.x - pivot.x);
      return angleA - angleB;
    });
    
    const hull: THREE.Vector2[] = [];
    for (const p of sorted) {
      while (hull.length >= 2) {
        const a = hull[hull.length - 2];
        const b = hull[hull.length - 1];
        const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
        if (cross <= 0) {
          hull.pop();
        } else {
          break;
        }
      }
      hull.push(p);
    }
    
    return hull;
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
   * 清理多边形点：去除重复点、过近的点和共线点
   */
  private cleanPolygonPoints(points: THREE.Vector2[]): THREE.Vector2[] {
    if (points.length < 3) return points;
    
    // 第一步：移除重复和过近的点
    const epsilon = 1e-4; // 最小距离阈值（增大以处理 DWG 数据）
    let cleaned: THREE.Vector2[] = [];
    
    for (let i = 0; i < points.length; i++) {
      const current = points[i];
      
      // 检查是否与上一个点重复
      if (cleaned.length > 0) {
        const last = cleaned[cleaned.length - 1];
        const dx = current.x - last.x;
        const dy = current.y - last.y;
        if (dx * dx + dy * dy < epsilon * epsilon) {
          continue; // 跳过重复点
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
        cleaned.pop(); // 移除最后一个重复点
      }
    }
    
    // 第二步：移除共线点（在同一线上的中间点）
    if (cleaned.length > 3) {
      const result: THREE.Vector2[] = [];
      for (let i = 0; i < cleaned.length; i++) {
        const prev = cleaned[(i - 1 + cleaned.length) % cleaned.length];
        const curr = cleaned[i];
        const next = cleaned[(i + 1) % cleaned.length];
        
        // 计算叉积，如果为0则共线
        const cross = (curr.x - prev.x) * (next.y - curr.y) - (curr.y - prev.y) * (next.x - curr.x);
        if (Math.abs(cross) > epsilon) {
          result.push(curr);
        }
      }
      cleaned = result.length >= 3 ? result : cleaned;
    }
    
    return cleaned;
  }

  /**
   * 创建实心填充网格
   * 使用 poly2tri 进行三角剖分
   */
  private createSolidFillMesh(points: THREE.Vector2[], color: number): THREE.Mesh | null {
    if (points.length < 3) return null;
    
    try {
      // 为 poly2tri 准备点数据
      const preparedPoints = this.preparePointsForPoly2tri(points);
      if (preparedPoints.length < 3) {
        // 回退到 ShapeGeometry
        return this.createSolidFillMeshWithShape(points, color);
      }
      
      // 确保是逆时针方向
      const area = this.calculateSignedArea(preparedPoints);
      let orderedPoints = preparedPoints;
      if (area < 0) {
        orderedPoints = [...preparedPoints].reverse();
      }
      
      // 创建 poly2tri 轮廓
      const contour = orderedPoints.map(p => new poly2tri.Point(p.x, p.y));
      const swctx = new poly2tri.SweepContext(contour);
      
      // 执行三角剖分
      swctx.triangulate();
      const triangles = swctx.getTriangles();
      
      // 收集顶点和索引
      const vertices: number[] = [];
      const indices: number[] = [];
      const pointIndexMap = new Map<string, number>();
      
      for (const tri of triangles) {
        const triPoints = tri.getPoints();
        for (const tp of triPoints) {
          const key = `${tp.x.toFixed(6)},${tp.y.toFixed(6)}`;
          if (!pointIndexMap.has(key)) {
            pointIndexMap.set(key, vertices.length / 3);
            vertices.push(tp.x, tp.y, 0);
          }
          indices.push(pointIndexMap.get(key)!);
        }
      }
      
      if (indices.length === 0) {
        return this.createSolidFillMeshWithShape(points, color);
      }
      
      // 创建 BufferGeometry
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      
      const material = new THREE.MeshBasicMaterial({
        color: color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      });
      
      return new THREE.Mesh(geometry, material);
      
    } catch (error) {
      console.warn('poly2tri failed for solid fill, falling back to ShapeGeometry:', error);
      return this.createSolidFillMeshWithShape(points, color);
    }
  }

  /**
   * 使用 ShapeGeometry 创建实心填充网格（回退方法）
   */
  private createSolidFillMeshWithShape(points: THREE.Vector2[], color: number): THREE.Mesh | null {
    if (points.length < 3) return null;
    
    try {
      const shape = new THREE.Shape();
      shape.moveTo(points[0].x, points[0].y);
      
      for (let i = 1; i < points.length; i++) {
        shape.lineTo(points[i].x, points[i].y);
      }
      shape.closePath();
      
      const geometry = new THREE.ShapeGeometry(shape);
      const material = new THREE.MeshBasicMaterial({
        color: color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      });
      
      return new THREE.Mesh(geometry, material);
    } catch (error) {
      console.error('Error creating solid fill mesh with Shape:', error);
      return null;
    }
  }

  /**
   * 创建边界线
   */
  private createBoundaryLine(points: THREE.Vector2[], color: number): THREE.LineLoop {
    const points3D = points.map(p => new THREE.Vector3(p.x, p.y, 0));
    const geometry = new THREE.BufferGeometry().setFromPoints(points3D);
    const material = new THREE.LineBasicMaterial({ color });
    return new THREE.LineLoop(geometry, material);
  }
}