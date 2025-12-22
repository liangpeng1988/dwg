import * as THREE from 'three';
import { DwgEntity, DwgArcEntity } from '../database';
import { BaseDrawer } from './BaseDrawer';

/**
 * 圆弧绘制器
 * 绘制 DwgArcEntity 类型的实体
 */
export class ArcDrawer extends BaseDrawer<DwgArcEntity> {
  
  canDraw(entity: DwgEntity): entity is DwgArcEntity {
    return entity.type === 'ARC';
  }

  draw(entity: DwgArcEntity): THREE.Line {
    const center = this.scalePoint(entity.center);
    const radius = Math.abs(entity.radius || 1) * this.scaleFactor;
    const startAngle = entity.startAngle || 0;
    const endAngle = entity.endAngle || Math.PI / 2;
    
    const points = this.generateArcPoints(center, radius, startAngle, endAngle);
    // 使用实体颜色
    const color = this.getEntityColor(entity);
    const line = this.createLineFromPoints(points, color);
    
    // 应用 extrusionDirection
    this.applyExtrusionDirection(line, entity.extrusionDirection);
    
    return line;
  }

  /**
   * 生成圆弧上的点
   */
  private generateArcPoints(
    center: THREE.Vector3,
    radius: number,
    startAngle: number,
    endAngle: number,
    segments: number = 64
  ): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    
    // 处理角度差
    let totalAngle = endAngle - startAngle;
    if (totalAngle < 0) {
      totalAngle += Math.PI * 2;
    }
    
    const angleStep = totalAngle / segments;
    
    for (let i = 0; i <= segments; i++) {
      const angle = startAngle + i * angleStep;
      points.push(new THREE.Vector3(
        center.x + radius * Math.cos(angle),
        center.y + radius * Math.sin(angle),
        center.z
      ));
    }
    
    return points;
  }
}
