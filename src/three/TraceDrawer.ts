import * as THREE from 'three';
import { BaseDrawer } from './BaseDrawer';
import type { DwgTraceEntity } from '../database/entities/trace';
import { getOcsToWcsMatrix } from './types';
import { DwgEntity, DwgLTypeTableEntry } from '../database';

/**
 * Trace 实体绘制器
 * TRACE 是一个四边形实体，类似于 SOLID 但顶点顺序不同
 * 顶点顺序：point1 -> point2 -> point4 -> point3 -> point1
 * 使用嵌套偏移：Group.position = 几何中心，内部对象偏移到相对位置
 */
export class TraceDrawer extends BaseDrawer<DwgTraceEntity> {
  /**
   * 检查实体类型是否匹配
   */
  canDraw(entity:DwgEntity): entity is DwgTraceEntity {
    return entity.type === 'TRACE';
  }

  /**
   * 绘制 Trace 实体
   */
  draw(entity: DwgTraceEntity): THREE.Group | null {
    try {
      if (!entity.point1 || !entity.point2 || !entity.point3) {
        console.warn('[TraceDrawer] Missing required points');
        return null;
      }
      
      if (!entity.point4) {
        entity.point4 = entity.point3;
      }
      
      const group = new THREE.Group();
      group.name = `TRACE_${entity.handle || 'unknown'}`;
      
      // 缩放点坐标
      const p1 = this.scalePoint(entity.point1);
      const p2 = this.scalePoint(entity.point2);
      const p3 = this.scalePoint(entity.point3);
      const p4 = this.scalePoint(entity.point4);
      
      // 计算几何中心
      const center = new THREE.Vector3(
        (p1.x + p2.x + p3.x + p4.x) / 4,
        (p1.y + p2.y + p3.y + p4.y) / 4,
        ((p1.z || 0) + (p2.z || 0) + (p3.z || 0) + (p4.z || 0)) / 4
      );
      
      // 计算相对于中心的本地坐标
      const lp1 = new THREE.Vector3(p1.x - center.x, p1.y - center.y, (p1.z || 0) - center.z);
      const lp2 = new THREE.Vector3(p2.x - center.x, p2.y - center.y, (p2.z || 0) - center.z);
      const lp3 = new THREE.Vector3(p3.x - center.x, p3.y - center.y, (p3.z || 0) - center.z);
      const lp4 = new THREE.Vector3(p4.x - center.x, p4.y - center.y, (p4.z || 0) - center.z);
      
      // TRACE 的顶点顺序：1 -> 2 -> 4 -> 3
      const vertices = new Float32Array([
        lp1.x, lp1.y, lp1.z,
        lp2.x, lp2.y, lp2.z,
        lp4.x, lp4.y, lp4.z,
        lp3.x, lp3.y, lp3.z,
      ]);
      
      const indices = new Uint16Array([
        0, 1, 2,
        0, 2, 3
      ]);
      
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      geometry.computeVertexNormals();
      
      const material = new THREE.MeshBasicMaterial({
        color: this.getEntityColor(entity, 0x00FFAA),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      group.add(mesh);
      
      // 添加边框线
      const edgePoints: THREE.Vector3[] = [lp1, lp2, lp4, lp3, lp1];
      const edgeGeometry = new THREE.BufferGeometry().setFromPoints(edgePoints);
      const edgeMaterial = new THREE.LineBasicMaterial({
        color: this.getEntityColor(entity, 0x008866),
        linewidth: 2
      });
      const edgeLine = new THREE.Line(edgeGeometry, edgeMaterial);
      group.add(edgeLine);
      
      // 如果有厚度，创建挤出效果
      if (entity.thickness && entity.thickness !== 0) {
        const thickness = entity.thickness * this.scaleFactor;
        const extrusionDir = entity.extrusionDirection || { x: 0, y: 0, z: 1 };
        const normal = new THREE.Vector3(extrusionDir.x, extrusionDir.y, extrusionDir.z).normalize();
        
        // 创建顶部面
        const lp1Top = lp1.clone().add(normal.clone().multiplyScalar(thickness));
        const lp2Top = lp2.clone().add(normal.clone().multiplyScalar(thickness));
        const lp3Top = lp3.clone().add(normal.clone().multiplyScalar(thickness));
        const lp4Top = lp4.clone().add(normal.clone().multiplyScalar(thickness));
        
        const topVertices = new Float32Array([
          lp1Top.x, lp1Top.y, lp1Top.z,
          lp2Top.x, lp2Top.y, lp2Top.z,
          lp4Top.x, lp4Top.y, lp4Top.z,
          lp3Top.x, lp3Top.y, lp3Top.z,
        ]);
        
        const topGeometry = new THREE.BufferGeometry();
        topGeometry.setAttribute('position', new THREE.BufferAttribute(topVertices, 3));
        topGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
        topGeometry.computeVertexNormals();
        
        const topMesh = new THREE.Mesh(topGeometry, material.clone());
        group.add(topMesh);
        
        // 添加侧面边线
        const sideEdges: THREE.Vector3[] = [
          lp1, lp1Top, lp2Top, lp2, lp1,
          lp2, lp2Top, lp4Top, lp4, lp2,
          lp4, lp4Top, lp3Top, lp3, lp4,
          lp3, lp3Top, lp1Top, lp1, lp3
        ];
        const sideGeometry = new THREE.BufferGeometry().setFromPoints(sideEdges);
        const sideLine = new THREE.Line(sideGeometry, edgeMaterial);
        group.add(sideLine);
      }
      
      // 先应用 extrusionDirection（影响旋转）
      if (entity.extrusionDirection && 
          (entity.extrusionDirection.x !== 0 || entity.extrusionDirection.y !== 0 || entity.extrusionDirection.z !== 1)) {
        const ocsMatrix = getOcsToWcsMatrix(entity.extrusionDirection);
        // 将中心点也进行 OCS 变换
        center.applyMatrix4(ocsMatrix);
        // 应用旋转部分到 group
        const rotation = new THREE.Euler().setFromRotationMatrix(ocsMatrix);
        group.rotation.copy(rotation);
      }
      
      // 最后设置 Group 位置为几何中心
      group.position.copy(center);
      
      // 添加用户数据
      group.userData = {
        entityType: 'TRACE',
        handle: entity.handle,
        layer: entity.layer,
        thickness: entity.thickness || 0,
        geometryCenter: center.clone()
      };
      
      return group;
    } catch (error) {
      console.error('Error drawing TRACE entity:', error);
      return null;
    }
  }
}
