import * as THREE from 'three';
import { DwgEntity } from '../database';
import { BaseDrawer } from './BaseDrawer';

/**
 * SHAPE 实体数据接口
 * SHAPE 是一个使用 SHX 形状文件定义的形状实体
 */
export interface DwgShapeEntity extends DwgEntity {
  type: 'SHAPE';
  // 形状名称
  name?: string;
  // 插入点
  insertionPoint?: { x: number; y: number; z?: number };
  // 大小
  size?: number;
  // 旋转角度（弧度）
  rotation?: number;
  // 倾斜角度
  oblique?: number;
  // 宽度因子
  widthFactor?: number;
}

/**
 * SHAPE 绘制器
 * 用于绘制 DWG 中的 SHAPE 实体
 */
export class ShapeDrawer extends BaseDrawer<DwgShapeEntity> {
  canDraw(entity: DwgEntity): entity is DwgShapeEntity {
    return entity.type === 'SHAPE';
  }

  draw(entity: DwgShapeEntity): THREE.Object3D | null {
    try {
      const group = new THREE.Group();
      group.name = `Shape_${entity.handle || 'unknown'}`;

      const insertionPoint = entity.insertionPoint || { x: 0, y: 0, z: 0 };
      const size = (entity.size || 1) * this.scaleFactor;
      const color = this.getEntityColor(entity);

      // SHAPE 实体通常需要 SHX 形状文件来定义
      // 由于没有加载 SHX 文件，这里创建一个简单的菱形占位符
      
      const halfSize = size / 2;
      const points = [
        new THREE.Vector3(0, halfSize, 0),
        new THREE.Vector3(halfSize, 0, 0),
        new THREE.Vector3(0, -halfSize, 0),
        new THREE.Vector3(-halfSize, 0, 0),
        new THREE.Vector3(0, halfSize, 0) // 闭合
      ];
      
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color });
      const shapeLine = new THREE.Line(geometry, material);
      
      // 应用变换
      if (entity.rotation) {
        shapeLine.rotation.z = entity.rotation;
      }
      
      shapeLine.position.set(
        insertionPoint.x * this.scaleFactor,
        insertionPoint.y * this.scaleFactor,
        (insertionPoint.z || 0) * this.scaleFactor
      );
      
      group.add(shapeLine);

      // 添加标记表示这是一个简化的 SHAPE
      group.userData.shapeName = entity.name;
      group.userData.simplified = true;
      group.userData.reason = 'SHX shape file not loaded';

      // 应用挤出方向
      // if (entity.extrusionDirection) {
      //   this.applyExtrusionDirection(group, entity.extrusionDirection);
      // }

      return group;
    } catch (error) {
      console.error('[ShapeDrawer] Error drawing SHAPE:', error);
      return null;
    }
  }
}
