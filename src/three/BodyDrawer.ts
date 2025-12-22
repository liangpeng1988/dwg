import * as THREE from 'three';
import { DwgEntity } from '../database';
import { BaseDrawer } from './BaseDrawer';

/**
 * BODY 实体数据接口
 * BODY 是一个 ACIS 体数据实体
 */
export interface DwgBodyEntity extends DwgEntity {
  type: 'BODY';
  // ACIS 数据（SAT 格式）
  acisData?: string;
  // 边界框
  boundingBox?: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
}

/**
 * BODY 绘制器
 * 用于绘制 DWG 中的 BODY 实体（ACIS 体数据）
 */
export class BodyDrawer extends BaseDrawer<DwgBodyEntity> {
  canDraw(entity: DwgEntity): entity is DwgBodyEntity {
    return entity.type === 'BODY';
  }

  draw(entity: DwgBodyEntity): THREE.Object3D | null {
    try {
      const group = new THREE.Group();
      group.name = `Body_${entity.handle || 'unknown'}`;

      // BODY 实体包含 ACIS 数据
      // 由于 ACIS 数据解析复杂，这里创建一个占位符
      
      if (entity.boundingBox) {
        // 如果有边界框，创建一个线框盒子
        const min = entity.boundingBox.min;
        const max = entity.boundingBox.max;
        
        const width = (max.x - min.x) * this.scaleFactor;
        const height = (max.y - min.y) * this.scaleFactor;
        const depth = (max.z - min.z) * this.scaleFactor;
        
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const color = this.getEntityColor(entity);
        const material = new THREE.MeshBasicMaterial({ 
          color, 
          wireframe: true,
          transparent: true,
          opacity: 0.5
        });
        
        const box = new THREE.Mesh(geometry, material);
        box.position.set(
          (min.x + max.x) / 2 * this.scaleFactor,
          (min.y + max.y) / 2 * this.scaleFactor,
          (min.z + max.z) / 2 * this.scaleFactor
        );
        
        group.add(box);
      } else {
        // 没有边界框数据，创建一个占位符点
        const geometry = new THREE.BufferGeometry();
        // 对于没有边界框的 BODY 实体，使用默认位置 (0, 0, 0)
        const position = { x: 0, y: 0, z: 0 };
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([
          position.x * this.scaleFactor,
          position.y * this.scaleFactor,
          position.z * this.scaleFactor
        ], 3));
        
        const color = this.getEntityColor(entity);
        const material = new THREE.PointsMaterial({ color, size: 5 });
        const point = new THREE.Points(geometry, material);
        group.add(point);
      }

      // 添加标记表示这是一个未完全支持的 BODY
      group.userData.unsupported = true;
      group.userData.reason = 'ACIS data parsing not implemented';

      return group;
    } catch (error) {
      console.error('[BodyDrawer] Error drawing BODY:', error);
      return null;
    }
  }
}
