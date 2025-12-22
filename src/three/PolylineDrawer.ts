import * as THREE from 'three';
import { 
  DwgEntity, 
  DwgLWPolylineEntity, 
  DwgLWPolylineVertex,
  DwgPolyline2dEntity,
  DwgPolyline3dEntity,
  DwgVertex2dEntity,
  DwgVertex3dEntity
} from '../database';
import { BaseDrawer } from './BaseDrawer';

// 支持的多段线类型联合
type SupportedPolylineEntity = DwgLWPolylineEntity | DwgPolyline2dEntity | DwgPolyline3dEntity;

/**
 * 多段线绘制器
 * 绘制 LWPOLYLINE, POLYLINE, POLYLINE2D, POLYLINE3D 类型的实体
 * 参考 SVG 转换器的多段线处理逻辑
 */
export class PolylineDrawer extends BaseDrawer<SupportedPolylineEntity> {
  
  canDraw(entity: DwgEntity): entity is SupportedPolylineEntity {
    return entity.type === 'LWPOLYLINE' || 
           entity.type === 'POLYLINE' ||
           entity.type === 'POLYLINE2D' ||
           entity.type === 'POLYLINE3D';
  }

  draw(entity: SupportedPolylineEntity): THREE.Line | THREE.LineLoop {
    // 使用实体颜色
    const color = this.getEntityColor(entity);
    
    // 根据类型分别处理
    if (entity.type === 'POLYLINE2D') {
      return this.drawPolyline2d(entity as DwgPolyline2dEntity, color);
    } else if (entity.type === 'POLYLINE3D') {
      return this.drawPolyline3d(entity as DwgPolyline3dEntity, color);
    } else {
      // LWPOLYLINE 和 POLYLINE
      return this.drawLWPolyline(entity as DwgLWPolylineEntity, color);
    }
  }

  /**
   * 绘制 LWPOLYLINE
   */
  private drawLWPolyline(entity: DwgLWPolylineEntity, color: number): THREE.Line | THREE.LineLoop {
    const vertices = entity.vertices || [];
    const isClosed = !!(entity.flag & 0x200); // 512 = closed
    const elevation = entity.elevation || 0; // 获取 elevation
    
    // 生成插值后的点（处理 bulge 凸度），传入 elevation
    const points = this.interpolatePolyline(vertices, isClosed, elevation);
    
    if (points.length < 2) {
      // 如果点数不足，返回一条默认线
      const defaultPoints = [
        new THREE.Vector3(0, 0, elevation * this.scaleFactor),
        new THREE.Vector3(this.scaleFactor, this.scaleFactor, elevation * this.scaleFactor)
      ];
      return this.createLineFromPoints(defaultPoints, color);
    }
    
    let line: THREE.Line | THREE.LineLoop;
    if (isClosed) {
      line = this.createLineLoopFromPoints(points, color);
    } else {
      line = this.createLineFromPoints(points, color);
    }
    
    // 应用 extrusionDirection（简化处理：只处理 z=-1 的镜像翻转）
    this.applyExtrusionDirection(line, entity.extrusionDirection);
    
    return line;
  }

  /**
   * 绘制 POLYLINE2D
   */
  private drawPolyline2d(entity: DwgPolyline2dEntity, color: number): THREE.Line | THREE.LineLoop {
    const vertices = entity.vertices || [];
    const isClosed = !!(entity.flag & 1); // 1 = closed
    const elevation = entity.elevation || 0;
    
    // 转换顶点并处理 bulge
    const points = this.interpolatePolyline2d(vertices, isClosed, elevation);
    
    if (points.length < 2) {
      const defaultPoints = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(this.scaleFactor, this.scaleFactor, 0)
      ];
      return this.createLineFromPoints(defaultPoints, color);
    }
    
    let line: THREE.Line | THREE.LineLoop;
    if (isClosed) {
      line = this.createLineLoopFromPoints(points, color);
    } else {
      line = this.createLineFromPoints(points, color);
    }
    
    // 应用 extrusionDirection
    this.applyExtrusionDirection(line, entity.extrusionDirection);
    
    return line;
  }

  /**
   * 绘制 POLYLINE3D
   */
  private drawPolyline3d(entity: DwgPolyline3dEntity, color: number): THREE.Line | THREE.LineLoop {
    const vertices = entity.vertices || [];
    const isClosed = !!(entity.flag & 1); // 1 = closed
    
    // 3D 多段线的顶点有完整的 x, y, z 坐标
    const points = this.convertVertices3d(vertices);
    
    if (points.length < 2) {
      const defaultPoints = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(this.scaleFactor, this.scaleFactor, 0)
      ];
      return this.createLineFromPoints(defaultPoints, color);
    }
    
    let line: THREE.Line | THREE.LineLoop;
    if (isClosed) {
      line = this.createLineLoopFromPoints(points, color);
    } else {
      line = this.createLineFromPoints(points, color);
    }
    
    // 应用 extrusionDirection
    this.applyExtrusionDirection(line, entity.extrusionDirection);
    
    return line;
  }

  /**
   * 转换 POLYLINE2D 顶点并处理 bulge
   */
  private interpolatePolyline2d(vertices: DwgVertex2dEntity[], closed: boolean, elevation: number): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    
    for (let i = 0; i < vertices.length; i++) {
      const current = vertices[i];
      const next = vertices[(i + 1) % vertices.length];
      
      // 添加当前点
      points.push(new THREE.Vector3(
        (current.x || 0) * this.scaleFactor,
        (current.y || 0) * this.scaleFactor,
        elevation * this.scaleFactor
      ));
      
      // 如果有 bulge 值，需要插值弧线
      const bulge = current.bulge || 0;
      if (Math.abs(bulge) > 1e-6 && (i < vertices.length - 1 || closed)) {
        const arcPoints = this.interpolateBulge2d(current, next, bulge, elevation);
        points.push(...arcPoints);
      }
    }
    
    return points;
  }

  /**
   * 转换 POLYLINE3D 顶点
   */
  private convertVertices3d(vertices: DwgVertex3dEntity[]): THREE.Vector3[] {
    return vertices.map(v => new THREE.Vector3(
      (v.x || 0) * this.scaleFactor,
      (v.y || 0) * this.scaleFactor,
      (v.z || 0) * this.scaleFactor
    ));
  }

  /**
   * POLYLINE2D 的 bulge 插值
   */
  private interpolateBulge2d(
    start: DwgVertex2dEntity,
    end: DwgVertex2dEntity,
    bulge: number,
    elevation: number
  ): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    
    const startX = (start.x || 0) * this.scaleFactor;
    const startY = (start.y || 0) * this.scaleFactor;
    const endX = (end.x || 0) * this.scaleFactor;
    const endY = (end.y || 0) * this.scaleFactor;
    const z = elevation * this.scaleFactor;
    
    // 计算弧的参数
    const dx = endX - startX;
    const dy = endY - startY;
    const chordLength = Math.sqrt(dx * dx + dy * dy);
    
    if (chordLength < 1e-6) {
      return points;
    }
    
    // bulge = tan(theta/4)，其中 theta 是弧对应的圆心角
    const theta = 4 * Math.atan(Math.abs(bulge));
    const radius = chordLength / (2 * Math.sin(theta / 2));
    
    // 弦的中点
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    
    // 从弦中点到圆心的距离
    const sagitta = radius * (1 - Math.cos(theta / 2));
    const apothemLength = radius - sagitta;
    
    // 弦的法向量
    const nx = -dy / chordLength;
    const ny = dx / chordLength;
    
    // 圆心位置（根据 bulge 的符号确定方向）
    const sign = bulge > 0 ? 1 : -1;
    const cx = midX + sign * apothemLength * nx;
    const cy = midY + sign * apothemLength * ny;
    
    // 计算起始和结束角度
    const startAngle = Math.atan2(startY - cy, startX - cx);
    
    // 生成弧上的点
    const segments = Math.max(8, Math.ceil(Math.abs(theta) * 10));
    const angleStep = (bulge > 0 ? 1 : -1) * theta / segments;
    
    for (let i = 1; i < segments; i++) {
      const angle = startAngle + i * angleStep;
      points.push(new THREE.Vector3(
        cx + radius * Math.cos(angle),
        cy + radius * Math.sin(angle),
        z
      ));
    }
    
    return points;
  }

  /**
   * 插值多段线顶点（处理 bulge 凸度）
   * 参考 SVG 转换器的 interpolatePolyline
   * @param vertices 顶点数组
   * @param closed 是否闭合
   * @param elevation z 方向高度
   */
  private interpolatePolyline(vertices: DwgLWPolylineVertex[], closed: boolean, elevation: number = 0): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    const z = elevation * this.scaleFactor;
    
    for (let i = 0; i < vertices.length; i++) {
      const current = vertices[i];
      const next = vertices[(i + 1) % vertices.length];
      
      // 添加当前点，使用 elevation 作为 z 坐标
      points.push(new THREE.Vector3(
        (current.x || 0) * this.scaleFactor,
        (current.y || 0) * this.scaleFactor,
        z
      ));
      
      // 如果有 bulge 值，需要插值弧线
      const bulge = current.bulge || 0;
      if (Math.abs(bulge) > 1e-6 && (i < vertices.length - 1 || closed)) {
        const arcPoints = this.interpolateBulge(current, next, bulge, elevation);
        points.push(...arcPoints);
      }
    }
    
    return points;
  }

  /**
   * 插值 bulge 弧线
   * @param start 起点
   * @param end 终点
   * @param bulge 凸度
   * @param elevation z 方向高度
   */
  private interpolateBulge(
    start: DwgLWPolylineVertex,
    end: DwgLWPolylineVertex,
    bulge: number,
    elevation: number = 0
  ): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    const z = elevation * this.scaleFactor;
    
    const startX = (start.x || 0) * this.scaleFactor;
    const startY = (start.y || 0) * this.scaleFactor;
    const endX = (end.x || 0) * this.scaleFactor;
    const endY = (end.y || 0) * this.scaleFactor;
    
    // 计算弧的参数
    const dx = endX - startX;
    const dy = endY - startY;
    const chordLength = Math.sqrt(dx * dx + dy * dy);
    
    if (chordLength < 1e-6) {
      return points;
    }
    
    // bulge = tan(theta/4)，其中 theta 是弧对应的圆心角
    const theta = 4 * Math.atan(Math.abs(bulge));
    const radius = chordLength / (2 * Math.sin(theta / 2));
    
    // 弦的中点
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    
    // 从弦中点到圆心的距离
    const sagitta = radius * (1 - Math.cos(theta / 2));
    const apothemLength = radius - sagitta;
    
    // 弦的法向量
    const nx = -dy / chordLength;
    const ny = dx / chordLength;
    
    // 圆心位置（根据 bulge 的符号确定方向）
    const sign = bulge > 0 ? 1 : -1;
    const cx = midX + sign * apothemLength * nx;
    const cy = midY + sign * apothemLength * ny;
    
    // 计算起始和结束角度
    const startAngle = Math.atan2(startY - cy, startX - cx);
    
    // 生成弧上的点
    const segments = Math.max(8, Math.ceil(Math.abs(theta) * 10));
    const angleStep = (bulge > 0 ? 1 : -1) * theta / segments;
    
    for (let i = 1; i < segments; i++) {
      const angle = startAngle + i * angleStep;
      points.push(new THREE.Vector3(
        cx + radius * Math.cos(angle),
        cy + radius * Math.sin(angle),
        z // 使用 elevation
      ));
    }
    
    return points;
  }
}
