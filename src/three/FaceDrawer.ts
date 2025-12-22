import * as THREE from 'three';
import { DwgEntity, Dwg3dFaceEntity } from '../database';
import { BaseDrawer } from './BaseDrawer';

/**
 * 3D面绘制器
 * 绘制 3DFACE 类型的实体
 */
export class FaceDrawer extends BaseDrawer<Dwg3dFaceEntity> {
  
  canDraw(entity: DwgEntity): entity is Dwg3dFaceEntity {
    return entity.type === '3DFACE';
  }

  draw(entity: Dwg3dFaceEntity): THREE.Line {
    // 获取四个角点
    const c1 = this.scalePoint(entity.corner1);
    const c2 = this.scalePoint(entity.corner2);
    const c3 = this.scalePoint(entity.corner3);
    // corner4 如果不存在，则与 corner3 相同（三角形）
    const c4 = entity.corner4 ? this.scalePoint(entity.corner4) : c3.clone();
    
    // 获取颜色
    const color = this.getEntityColor(entity);
    
    // 获取边的可见性标志
    const invisFlags = entity.flag || 0;
    
    // 创建边线点数组（考虑边的可见性）
    const points: THREE.Vector3[] = [];
    
    // 检查是否是三角形
    const isTriangle = !entity.corner4 || 
      (c4.x === c3.x && c4.y === c3.y && c4.z === c3.z);
    
    if (isTriangle) {
      // 三角形：只有3条边
      // 边1: corner1 -> corner2
      if (!(invisFlags & 1)) {
        points.push(c1.clone(), c2.clone());
      }
      // 边2: corner2 -> corner3
      if (!(invisFlags & 2)) {
        points.push(c2.clone(), c3.clone());
      }
      // 边3: corner3 -> corner1
      if (!(invisFlags & 4)) {
        points.push(c3.clone(), c1.clone());
      }
    } else {
      // 四边形：4条边
      // 边1: corner1 -> corner2
      if (!(invisFlags & 1)) {
        points.push(c1.clone(), c2.clone());
      }
      // 边2: corner2 -> corner3
      if (!(invisFlags & 2)) {
        points.push(c2.clone(), c3.clone());
      }
      // 边3: corner3 -> corner4
      if (!(invisFlags & 4)) {
        points.push(c3.clone(), c4.clone());
      }
      // 边4: corner4 -> corner1
      if (!(invisFlags & 8)) {
        points.push(c4.clone(), c1.clone());
      }
    }
    
    // 如果所有边都不可见，至少显示一个边框
    if (points.length === 0) {
      if (isTriangle) {
        points.push(c1, c2, c3, c1);
      } else {
        points.push(c1, c2, c3, c4, c1);
      }
      return this.createLineFromPoints(points, color);
    }
    
    // 使用 LineSegments 来绘制不连续的边
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(points.length * 3);
    
    points.forEach((point, index) => {
      positions[index * 3] = point.x;
      positions[index * 3 + 1] = point.y;
      positions[index * 3 + 2] = point.z;
    });
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.LineBasicMaterial({ color });
    return new THREE.LineSegments(geometry, material);
  }
}
