import * as THREE from 'three';
import { DwgEntity, DwgRayEntity, DwgXlineEntity } from '../database';
import { BaseDrawer } from './BaseDrawer';

/**
 * 射线/构造线绘制器
 * 绘制 RAY (射线) 和 XLINE (构造线) 类型的实体
 * - RAY: 从起点向一个方向无限延伸
 * - XLINE: 双向无限延伸
 */
export class RayXlineDrawer extends BaseDrawer<DwgRayEntity | DwgXlineEntity> {
  
  /** 默认延伸长度（模拟无限长） */
  private static readonly EXTEND_LENGTH = 10000;

  canDraw(entity: DwgEntity): entity is DwgRayEntity | DwgXlineEntity {
    return entity.type === 'RAY' || entity.type === 'XLINE';
  }

  draw(entity: DwgRayEntity | DwgXlineEntity): THREE.Line {
    const firstPoint = this.scalePoint(entity.firstPoint);
    const direction = new THREE.Vector3(
      entity.unitDirection.x || 0,
      entity.unitDirection.y || 0,
      entity.unitDirection.z || 0
    ).normalize();
    
    const points: THREE.Vector3[] = [];
    const extendLength = RayXlineDrawer.EXTEND_LENGTH * this.scaleFactor;
    
    if (entity.type === 'RAY') {
      // RAY: 从起点向方向延伸
      points.push(firstPoint);
      points.push(new THREE.Vector3(
        firstPoint.x + direction.x * extendLength,
        firstPoint.y + direction.y * extendLength,
        firstPoint.z + direction.z * extendLength
      ));
    } else {
      // XLINE: 双向延伸
      points.push(new THREE.Vector3(
        firstPoint.x - direction.x * extendLength,
        firstPoint.y - direction.y * extendLength,
        firstPoint.z - direction.z * extendLength
      ));
      points.push(new THREE.Vector3(
        firstPoint.x + direction.x * extendLength,
        firstPoint.y + direction.y * extendLength,
        firstPoint.z + direction.z * extendLength
      ));
    }
    
    // 使用实体的线型创建线条
    return this.createLineForEntity(entity, points);
  }
}
