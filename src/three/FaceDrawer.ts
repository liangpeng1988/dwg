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

  draw(entity: Dwg3dFaceEntity): THREE.Object3D {
    // 获取四个角点
    const c1 = this.scalePoint(entity.corner1);
    const c2 = this.scalePoint(entity.corner2);
    const c3 = this.scalePoint(entity.corner3);
    // corner4 如果不存在，则与 corner3 相同（三角形）
    const c4 = entity.corner4 ? this.scalePoint(entity.corner4) : c3.clone();
    
    // 获取颜色
    const color = this.getEntityColor(entity);
    
    // 创建组以包含面和可选的边线
    const group = new THREE.Group();

    // 1. 创建面网格 (Mesh)
    const geometry = new THREE.BufferGeometry();
    const isTriangle = !entity.corner4 || 
      (c4.x === c3.x && c4.y === c3.y && c4.z === c3.z);

    if (isTriangle) {
      const vertices = new Float32Array([
        c1.x, c1.y, c1.z,
        c2.x, c2.y, c2.z,
        c3.x, c3.y, c3.z
      ]);
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geometry.setIndex([0, 1, 2]);
    } else {
      const vertices = new Float32Array([
        c1.x, c1.y, c1.z,
        c2.x, c2.y, c2.z,
        c3.x, c3.y, c3.z,
        c4.x, c4.y, c4.z
      ]);
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      // 四边形索引: 1-2-3 和 1-3-4
      geometry.setIndex([0, 1, 2, 0, 2, 3]);
    }
    
    geometry.computeVertexNormals();
    const material = new THREE.MeshBasicMaterial({ 
      color, 
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
      depthWrite: true
    });


    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);

    // 2. 创建边线 (Line)
    // 获取边的可见性标志
    const invisFlags = entity.flag || 0;
    const linePoints: THREE.Vector3[] = [];
    
    if (isTriangle) {
      if (!(invisFlags & 1)) linePoints.push(c1.clone(), c2.clone());
      if (!(invisFlags & 2)) linePoints.push(c2.clone(), c3.clone());
      if (!(invisFlags & 4)) linePoints.push(c3.clone(), c1.clone());
    } else {
      if (!(invisFlags & 1)) linePoints.push(c1.clone(), c2.clone());
      if (!(invisFlags & 2)) linePoints.push(c2.clone(), c3.clone());
      if (!(invisFlags & 4)) linePoints.push(c3.clone(), c4.clone());
      if (!(invisFlags & 8)) linePoints.push(c4.clone(), c1.clone());
    }

    if (linePoints.length > 0) {
      const lineGeom = new THREE.BufferGeometry();
      const linePositions = new Float32Array(linePoints.length * 3);
      linePoints.forEach((p, i) => {
        linePositions[i * 3] = p.x;
        linePositions[i * 3 + 1] = p.y;
        linePositions[i * 3 + 2] = p.z;
      });
      lineGeom.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
      const lineMat = new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.5, transparent: true }); // 黑色边框
      const lines = new THREE.LineSegments(lineGeom, lineMat);
      group.add(lines);
    }
    
    return group;
  }

}
