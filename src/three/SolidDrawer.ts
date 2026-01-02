import * as THREE from 'three';
import { DwgEntity, DwgSolidEntity } from '../database';
import { BaseDrawer } from './BaseDrawer';
import { getOcsToWcsMatrix } from './types';

/**
 * 实体填充绘制器
 * 绘制 DwgSolidEntity 类型的实体
 */
export class SolidDrawer extends BaseDrawer<DwgSolidEntity> {
  
  canDraw(entity: DwgEntity): entity is DwgSolidEntity {
    return entity.type === 'SOLID';
  }

  draw(entity: DwgSolidEntity): THREE.Group | THREE.Mesh {
    const group = new THREE.Group();

    // DWG SOLID 的顶点顺序是特殊的：corner1 → corner2 → corner4 → corner3
    // 这是一个“蝴蝶结”形状的排布
    const c1 = entity.corner1 ? new THREE.Vector3(
      (entity.corner1.x || 0) * this.scaleFactor,
      (entity.corner1.y || 0) * this.scaleFactor,
      0
    ) : null;
    
    const c2 = entity.corner2 ? new THREE.Vector3(
      (entity.corner2.x || 0) * this.scaleFactor,
      (entity.corner2.y || 0) * this.scaleFactor,
      0
    ) : null;
    
    const c3 = entity.corner3 ? new THREE.Vector3(
      (entity.corner3.x || 0) * this.scaleFactor,
      (entity.corner3.y || 0) * this.scaleFactor,
      0
    ) : null;
    
    // corner4 可能不存在，此时等于 corner3
    const c4 = entity.corner4 ? new THREE.Vector3(
      (entity.corner4.x || 0) * this.scaleFactor,
      (entity.corner4.y || 0) * this.scaleFactor,
      0
    ) : c3;
    
    // 检查必要的点
    if (!c1 || !c2 || !c3 || !c4) {
      // 返回默认三角形
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array([
        0, 0, 0,
        this.scaleFactor, 0, 0,
        0, this.scaleFactor, 0
      ]);
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setIndex([0, 1, 2]);
      const material = this.createMeshMaterialForEntity(entity);
      return new THREE.Mesh(geometry, material);
    }
    
    // 正确的顶点顺序：1 → 2 → 4 → 3 形成四边形
    const positions = new Float32Array([
      c1.x, c1.y, c1.z,
      c2.x, c2.y, c2.z,
      c4.x, c4.y, c4.z,
      c3.x, c3.y, c3.z
    ]);
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    // 三角剖分：(0,1,2) 和 (0,2,3) — 即 (c1,c2,c4) 和 (c1,c4,c3)
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.computeVertexNormals();

    // 使用实体颜色
    const material = this.createMeshMaterialForEntity(entity);
    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);
    
    // 应用 OCS 变换
    if (entity.extrusionDirection) {
      const ocsMatrix = getOcsToWcsMatrix(entity.extrusionDirection);
      group.applyMatrix4(ocsMatrix);
    }

    // 应用 elevation (如果有的话，SOLID 也可以有 elevation)
    if (entity.elevation != null) {
      group.translateZ(entity.elevation * this.scaleFactor);
    }

    // Z-fighting jitter
    const jitter = (parseInt(entity.handle || '0', 16) % 100) * 0.0001;
    group.translateZ(jitter);
    
    return group;
  }
}
