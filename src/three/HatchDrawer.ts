import * as THREE from 'three';
import * as poly2tri from 'poly2tri';
import { BaseDrawer } from './BaseDrawer';
import { DwgEntity } from '../database';
import { DwgHatchEntity } from '../database/entities/hatch';
import { NestedPolygonProcessor } from './NestedPolygonProcessor';
import { getOcsToWcsMatrix } from './types';


/**
 * HATCH 实体绘制器
 * 专门处理填充图案实体的绘制
 */
export class HatchDrawer extends BaseDrawer<DwgEntity> {
  // 调试开关：显示顶点球体
  private static DEBUG_VERTICES = false;
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
        // 实心填充 - 使用 NestedPolygonProcessor 处理复杂嵌套
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
      
      // 应用 OCS 变换
      if (hatchEntity.extrusionDirection) {
        const ocsMatrix = getOcsToWcsMatrix(hatchEntity.extrusionDirection);
        group.applyMatrix4(ocsMatrix);
      }
      
      // 应用 elevation (在 OCS 中是沿 Z 轴的偏移)
      if (hatchEntity.elevation != null) {
        // 注意：elevation 是在 OCS 中的 Z 偏移，应该在应用 OCS 矩阵之前或作为其一部分应用
        // 这里我们简单地沿局部 Z 轴平移
        group.translateZ(hatchEntity.elevation * this.scaleFactor);
      }

      // 稍微偏移一点 Z，防止多个 HATCH 在同一平面 Z-fighting
      const jitter = (parseInt(entity.handle || '0', 16) % 100) * 0.0001;
      group.translateZ(jitter);


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
   */
  private getHatchColor(entity: DwgHatchEntity): number {
    return this.getEntityColor(entity, 0x888888);
  }

  /**
   * 提取边界点
   */
  private extractBoundaryPoints(boundaryPath: any): THREE.Vector2[] {
    const points: THREE.Vector2[] = [];
    
    if (boundaryPath.vertices && boundaryPath.vertices.length > 0) {
      const vertices = boundaryPath.vertices;
      for (let i = 0; i < vertices.length; i++) {
        const vertex = vertices[i];
        const x = (vertex.x || 0) * this.scaleFactor;
        const y = (vertex.y || 0) * this.scaleFactor;
        
        // 只有当点与上一个点不同时才添加 (简单去重)
        if (points.length > 0) {
          const last = points[points.length - 1];
          if (Math.abs(x - last.x) < 1e-8 && Math.abs(y - last.y) < 1e-8) {
            // 如果相同且没有 bulge，跳过
            if (!vertex.bulge || Math.abs(vertex.bulge) < 1e-6) continue;
          }
        }
        
        points.push(new THREE.Vector2(x, y));
        
        if (vertex.bulge && Math.abs(vertex.bulge) > 1e-6) {
          const nextIndex = (i + 1) % vertices.length;
          const nextVertex = vertices[nextIndex];
          if (nextVertex) {
            const arcPoints = this.interpolateBulge(
              { x: vertex.x, y: vertex.y },
              { x: nextVertex.x, y: nextVertex.y },
              vertex.bulge
            );
            points.push(...arcPoints);
          }
        }
      }
    }
    
    if (boundaryPath.edges && boundaryPath.edges.length > 0) {
      for (let i = 0; i < boundaryPath.edges.length; i++) {
        const edge = boundaryPath.edges[i];
        const isFirst = (points.length === 0);
        const edgePoints = this.extractEdgePoints(edge, isFirst);
        
        // 检查连接处是否有重复
        if (points.length > 0 && edgePoints.length > 0) {
          const last = points[points.length - 1];
          const first = edgePoints[0];
          if (last.distanceTo(first) < 1e-8) {
            edgePoints.shift();
          }
        }
        
        points.push(...edgePoints);
      }
    }

    // 确保闭合：如果首尾不重合且点数 > 2，闭合它
    if (points.length >= 3) {
      const first = points[0];
      const last = points[points.length - 1];
      if (first.distanceTo(last) > 1e-7) {
        // 注意：HATCH 边界通常应该是闭合的，如果不闭合，可能是数据不全
        // 这里我们不做强行闭合，让 NestedPolygonProcessor 里的 cleanPolygonPoints 处理
      }
    }
    
    return points;
  }


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
          let majorRadius = 1 * this.scaleFactor;
          let rotation = 0;
          if (edge.end) {
            const dx = (edge.end.x || 0) * this.scaleFactor;
            const dy = (edge.end.y || 0) * this.scaleFactor;
            majorRadius = Math.sqrt(dx * dx + dy * dy);
            rotation = Math.atan2(dy, dx);
          }
          const minorRadius = majorRadius * (edge.lengthOfMinorAxis || 0.5);
          const ellipsePoints = this.generateEllipsePoints(cx, cy, majorRadius, minorRadius, startAngle, endAngle, rotation, includeStart);
          points.push(...ellipsePoints);
        }
        break;
      case 4: // SPLINE
      case 'SPLINE':
        if (edge.fitDatum && edge.fitDatum.length > 0) {
          const startIdx = includeStart ? 0 : 1;
          for (let i = startIdx; i < edge.fitDatum.length; i++) {
            const fp = edge.fitDatum[i];
            points.push(new THREE.Vector2((fp.x || 0) * this.scaleFactor, (fp.y || 0) * this.scaleFactor));
          }
        } else if (edge.controlPoints && edge.controlPoints.length > 0) {
          const splinePoints = this.interpolateSpline(edge, includeStart);
          points.push(...splinePoints);
        }
        break;
    }
    return points;
  }

  private generateArcPoints(cx: number, cy: number, radius: number, startAngle: number, endAngle: number, isCCW: boolean, includeStart: boolean): THREE.Vector2[] {
    const points: THREE.Vector2[] = [];
    const segments = 32;
    let angle = endAngle - startAngle;
    if (isCCW && angle < 0) angle += Math.PI * 2;
    if (!isCCW && angle > 0) angle -= Math.PI * 2;
    const startIdx = includeStart ? 0 : 1;
    for (let i = startIdx; i <= segments; i++) {
      const t = i / segments;
      const a = startAngle + angle * t;
      points.push(new THREE.Vector2(cx + radius * Math.cos(a), cy + radius * Math.sin(a)));
    }
    return points;
  }

  private generateEllipsePoints(cx: number, cy: number, majorRadius: number, minorRadius: number, startAngle: number, endAngle: number, rotation: number, includeStart: boolean): THREE.Vector2[] {
    const points: THREE.Vector2[] = [];
    const segments = 32;
    const angle = endAngle - startAngle;
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    const startIdx = includeStart ? 0 : 1;
    for (let i = startIdx; i <= segments; i++) {
      const t = i / segments;
      const a = startAngle + angle * t;
      const px = majorRadius * Math.cos(a);
      const py = minorRadius * Math.sin(a);
      const rx = px * cosR - py * sinR;
      const ry = px * sinR + py * cosR;
      points.push(new THREE.Vector2(cx + rx, cy + ry));
    }
    return points;
  }

  private interpolateBulge(start: { x: number; y: number }, end: { x: number; y: number }, bulge: number): THREE.Vector2[] {
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
    // 增加分段数，提高圆弧平滑度
    const segments = Math.max(16, Math.ceil(Math.abs(theta) * 20));
    const angleStep = (bulge > 0 ? 1 : -1) * theta / segments;

    for (let i = 1; i < segments; i++) {
      const angle = startAngle + i * angleStep;
      points.push(new THREE.Vector2(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)));
    }
    return points;
  }

  private interpolateSpline(edge: any, includeStart: boolean): THREE.Vector2[] {
    const points: THREE.Vector2[] = [];
    const controlPoints = edge.controlPoints || [];
    if (controlPoints.length < 2) return points;
    const segments = Math.max(controlPoints.length * 4, 16);
    const startIdx = includeStart ? 0 : 1;
    for (let i = startIdx; i <= segments; i++) {
      const t = i / segments;
      const pt = this.catmullRomInterpolate(controlPoints, t);
      points.push(new THREE.Vector2(pt.x * this.scaleFactor, pt.y * this.scaleFactor));
    }
    return points;
  }

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
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  }

  /**
   * 创建带孔洞的实心填充
   */
  private createSolidFillWithHoles(
    boundaryPaths: any[],
    color: number,
    hatchStyle?: number
  ): THREE.Mesh | null {
    if (boundaryPaths.length === 0) return null;
    
    try {
      // 1. 提取所有边界路径的点
      const allPathPoints: THREE.Vector2[][] = [];
      for (const path of boundaryPaths) {
        const points = this.extractBoundaryPoints(path);
        if (points.length >= 3) {
          allPathPoints.push(points);
        }
      }
      
      if (allPathPoints.length === 0) return null;
      
      // 2. 使用 NestedPolygonProcessor 处理嵌套关系
      const processor = new NestedPolygonProcessor();
      const nestedPolygons = processor.processPolygons(allPathPoints);
      
      // 3. 根据 hatchStyle 调整 shouldFill (0=Normal, 1=Outer, 2=Ignore)
      if (hatchStyle === 1) { // Outer
        for (const p of nestedPolygons) {
          if (p.nestLevel > 1) p.shouldFill = false;
        }
      } else if (hatchStyle === 2) { // Ignore
        for (const p of nestedPolygons) {
          if (p.nestLevel > 0) p.shouldFill = false;
        }
      }
      
      // 4. 创建填充网格
      const mesh = processor.createFilledMesh(nestedPolygons, color);
      
      if (mesh) {
        // 确保材质配置正确（破面修复）
        const material = mesh.material as THREE.MeshBasicMaterial;
        material.polygonOffset = true;
        material.polygonOffsetFactor = 1;
        material.polygonOffsetUnits = 1;
        material.depthWrite = true;
        material.transparent = true;
        material.opacity = 0.8;
      }
      
      return mesh;
      
    } catch (error) {
      console.error('Error creating solid fill with NestedPolygonProcessor:', error);
      // 回退方案在 NestedPolygonProcessor 中已经包含 ShapeGeometry 回退
      return null;
    }
  }

  private createBoundaryLine(points: THREE.Vector2[], color: number): THREE.LineLoop {
    const points3D = points.map(p => new THREE.Vector3(p.x, p.y, 0));
    const geometry = new THREE.BufferGeometry().setFromPoints(points3D);
    const material = new THREE.LineBasicMaterial({ color });
    return new THREE.LineLoop(geometry, material);
  }
}
