import * as THREE from 'three';
import { DwgEntity, DwgCircleEntity } from '../database';
import { BaseDrawer } from './BaseDrawer';

/**
 * 圆形绘制器
 * 绘制 DwgCircleEntity 类型的实体
 */
export class CircleDrawer extends BaseDrawer<DwgCircleEntity> {
  
  canDraw(entity: DwgEntity): entity is DwgCircleEntity {
    return entity.type === 'CIRCLE';
  }

  draw(entity: DwgCircleEntity): THREE.Line {
    // CAD 中的圆形应该绘制为轮廓线，而不是填充
    return this.drawOutline(entity);
  }

  /**
   * 绘制圆形轮廓线（不填充）
   */
  drawOutline(entity: DwgCircleEntity): THREE.Line {
    const center = this.scalePoint(entity.center);
    const radius = Math.abs(entity.radius || 1) * this.scaleFactor;
    
    const points: THREE.Vector3[] = [];
    const segments = 64;
    
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(
        center.x + radius * Math.cos(angle),
        center.y + radius * Math.sin(angle),
        center.z
      ));
    }
    
    // 使用实体颜色
    const color = this.getEntityColor(entity);
    const line = this.createLineFromPoints(points, color);
    this.applyExtrusionDirection(line, entity.extrusionDirection);
    
    return line;
  }
}
