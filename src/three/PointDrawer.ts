import * as THREE from 'three';
import { DwgEntity, DwgPointEntity } from '../database';
import { BaseDrawer } from './BaseDrawer';

/**
 * 点绘制器
 * 绘制 DwgPointEntity 类型的实体
 */
export class PointDrawer extends BaseDrawer<DwgPointEntity> {
  
  canDraw(entity: DwgEntity): entity is DwgPointEntity {
    return entity.type === 'POINT';
  }

  draw(entity: DwgPointEntity): THREE.Mesh {
    const position = this.scalePoint(entity.position);
    
    // 使用小球体表示点
    const radius = 0.5 * this.scaleFactor;
    const geometry = new THREE.SphereGeometry(radius, 8, 8);
    const material = this.createMeshMaterialForEntity(entity);
    const point = new THREE.Mesh(geometry, material);
    
    point.position.copy(position);
    
    // 应用 extrusionDirection
    this.applyExtrusionDirection(point, entity.extrusionDirection);
    
    return point;
  }

  /**
   * 绘制点为十字标记
   */
  drawAsCross(entity: DwgPointEntity, size: number = 1): THREE.Group {
    const position = this.scalePoint(entity.position);
    const halfSize = size * this.scaleFactor / 2;
    
    const group = new THREE.Group();
    
    // 水平线
    const hPoints = [
      new THREE.Vector3(position.x - halfSize, position.y, position.z),
      new THREE.Vector3(position.x + halfSize, position.y, position.z)
    ];
    // 使用实体颜色
    const color = this.getEntityColor(entity);
    group.add(this.createLineFromPoints(hPoints, color));
    
    // 垂直线
    const vPoints = [
      new THREE.Vector3(position.x, position.y - halfSize, position.z),
      new THREE.Vector3(position.x, position.y + halfSize, position.z)
    ];
    group.add(this.createLineFromPoints(vPoints, color));
    
    return group;
  }
}
