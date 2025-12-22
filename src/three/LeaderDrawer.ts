import * as THREE from 'three';
import { DwgEntity, DwgLeaderEntity } from '../database';
import { BaseDrawer } from './BaseDrawer';

/**
 * 引线绘制器
 * 绘制 LEADER 类型的实体
 */
export class LeaderDrawer extends BaseDrawer<DwgLeaderEntity> {
  
  canDraw(entity: DwgEntity): entity is DwgLeaderEntity {
    return entity.type === 'LEADER';
  }

  draw(entity: DwgLeaderEntity): THREE.Group {
    const group = new THREE.Group();
    
    const vertices = entity.vertices || [];
    if (vertices.length < 2) {
      return group;
    }
    
    // 将顶点转换为 Three.js 向量
    const points = vertices.map(v => this.scalePoint(v));
    
    // 获取颜色和线宽
    const color = this.getEntityColor(entity);
    const lineWidth = this.getEntityLineWidth(entity);
    
    if (entity.isSpline) {
      // 样条曲线引线
      const curve = new THREE.CatmullRomCurve3(points);
      const curvePoints = curve.getPoints(points.length * 10);
      // 使用 MeshLine 绘制带线宽的线
      const line = this.createMeshLineFromPoints(curvePoints, color, lineWidth);
      group.add(line);
    } else {
      // 直线段引线 - 使用 MeshLine 绘制带线宽的线
      const line = this.createMeshLineFromPoints(points, color, lineWidth);
      group.add(line);
    }
    
    // 绘制箭头（如果启用）
    if (entity.isArrowheadEnabled && points.length >= 2) {
      const arrow = this.createArrowhead(points[0], points[1], color);
      if (arrow) {
        group.add(arrow);
      }
    }
    
    return group;
  }

  /**
   * 创建箭头
   */
  private createArrowhead(
    tip: THREE.Vector3, 
    base: THREE.Vector3, 
    color: number
  ): THREE.Mesh | null {
    const direction = new THREE.Vector3().subVectors(tip, base).normalize();
    const arrowLength = 2 * this.scaleFactor;
    const arrowWidth = 0.5 * this.scaleFactor;
    
    // 创建箭头形状
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(-arrowLength, arrowWidth);
    shape.lineTo(-arrowLength, -arrowWidth);
    shape.lineTo(0, 0);
    
    const geometry = new THREE.ShapeGeometry(shape);
    const material = new THREE.MeshBasicMaterial({ 
      color,
      side: THREE.DoubleSide 
    });
    const arrow = new THREE.Mesh(geometry, material);
    
    // 计算旋转角度
    const angle = Math.atan2(direction.y, direction.x);
    arrow.rotation.z = angle;
    arrow.position.copy(tip);
    
    return arrow;
  }
}
