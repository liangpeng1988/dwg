import * as THREE from 'three';
import { DwgEntity } from '../database';
import { BaseDrawer } from './BaseDrawer';

/**
 * 3DSOLID 实体数据接口
 * 3DSOLID 是一个三维实体（ACIS 实体）
 */
export interface Dwg3DSolidEntity extends DwgEntity {
  type: '3DSOLID';
  // ACIS 数据（SAT 格式）
  acisData?: string;
  // 边界框
  boundingBox?: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  // 位置点（可选，用于没有边界框时的占位符定位）
  position?: { x: number; y: number; z?: number };
}

/**
 * 3DSOLID 绘制器
 * 用于绘制 DWG 中的 3DSOLID 实体（三维实体）
 */
export class ThreeDSolidDrawer extends BaseDrawer<Dwg3DSolidEntity> {
  canDraw(entity: DwgEntity): entity is Dwg3DSolidEntity {
    return entity.type === '3DSOLID';
  }

  draw(entity: Dwg3DSolidEntity): THREE.Object3D | null {
    try {
      const group = new THREE.Group();
      group.name = `3DSolid_${entity.handle || 'unknown'}`;

      // 3DSOLID 实体包含 ACIS 数据
      // 由于 ACIS 数据解析复杂，这里创建一个边界框占位符
      
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
        const position = entity.position || { x: 0, y: 0, z: 0 };
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([
          position.x * this.scaleFactor,
          position.y * this.scaleFactor,
          (position.z || 0) * this.scaleFactor
        ], 3));
        
        const color = this.getEntityColor(entity);
        const material = new THREE.PointsMaterial({ color, size: 5 });
        const point = new THREE.Points(geometry, material);
        group.add(point);
      }

      // 添加标记表示这是一个未完全支持的 3DSOLID
      group.userData.unsupported = true;
      group.userData.reason = 'ACIS data parsing not implemented';

      return group;
    } catch (error) {
      console.error('[ThreeDSolidDrawer] Error drawing 3DSOLID:', error);
      return null;
    }
  }
}
