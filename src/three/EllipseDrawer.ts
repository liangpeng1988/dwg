import * as THREE from 'three';
import { DwgEntity, DwgEllipseEntity } from '../database';
import { BaseDrawer } from './BaseDrawer';

/**
 * 椭圆绘制器
 * 绘制 DwgEllipseEntity 类型的实体
 * 参考 SVG 转换器的椭圆绘制逻辑
 */
export class EllipseDrawer extends BaseDrawer<DwgEllipseEntity> {
  
  canDraw(entity: DwgEntity): entity is DwgEllipseEntity {
    return entity.type === 'ELLIPSE';
  }

  draw(entity: DwgEllipseEntity): THREE.Line {
    const center = this.scalePoint(entity.center);
    const majorEndPoint = entity.majorAxisEndPoint;
    
    // 计算长轴和短轴半径
    const rx = Math.sqrt(
      Math.pow(majorEndPoint.x || 0, 2) + 
      Math.pow(majorEndPoint.y || 0, 2)
    ) * this.scaleFactor;
    const ry = rx * (entity.axisRatio || 1);
    
    // 计算旋转角度
    const rotationAngle = Math.atan2(majorEndPoint.y || 0, majorEndPoint.x || 0);
    
    const startAngle = entity.startAngle || 0;
    const endAngle = entity.endAngle || Math.PI * 2;
    
    // CAD 中的椭圆应该绘制为轮廓线，而不是填充
    return this.drawEllipseArc(center, rx, ry, rotationAngle, startAngle, endAngle, entity);
  }

  /**
   * 绘制椭圆/椭圆弧轮廓线
   */
  private drawEllipseArc(
    center: THREE.Vector3,
    rx: number,
    ry: number,
    rotationAngle: number,
    startAngle: number,
    endAngle: number,
    entity: DwgEllipseEntity
  ): THREE.Line {
    const points: THREE.Vector3[] = [];
    const segments = 64;
    
    let totalAngle = endAngle - startAngle;
    if (totalAngle < 0) {
      totalAngle += Math.PI * 2;
    }
    
    const angleStep = totalAngle / segments;
    
    for (let i = 0; i <= segments; i++) {
      const angle = startAngle + i * angleStep;
      // 椭圆参数方程
      const localX = rx * Math.cos(angle);
      const localY = ry * Math.sin(angle);
      
      // 应用旋转
      const rotatedX = localX * Math.cos(rotationAngle) - localY * Math.sin(rotationAngle);
      const rotatedY = localX * Math.sin(rotationAngle) + localY * Math.cos(rotationAngle);
      
      points.push(new THREE.Vector3(
        center.x + rotatedX,
        center.y + rotatedY,
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
