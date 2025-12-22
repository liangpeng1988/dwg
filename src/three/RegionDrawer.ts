import * as THREE from 'three';
import { DwgEntity, DwgPoint3D } from '../database';
import { BaseDrawer } from './BaseDrawer';

/**
 * REGION 实体数据接口
 * Region 是一个由闭合边界定义的二维区域（ACIS 实体）
 */
export interface DwgRegionEntity extends DwgEntity {
  type: 'REGION';
  // 位置信息
  position?: DwgPoint3D;
  // ACIS 数据（SAT 格式）
  acisData?: string;
  // 边界数据
  boundaryData?: {
    points?: Array<{ x: number; y: number; z?: number }>;
  };
  // 挤出方向
  extrusionDirection?: DwgPoint3D;
}

/**
 * Region 绘制器
 * 用于绘制 DWG 中的 REGION 实体（二维区域）
 */
export class RegionDrawer extends BaseDrawer<DwgRegionEntity> {
  canDraw(entity: DwgEntity): entity is DwgRegionEntity {
    return entity.type === 'REGION';
  }

  draw(entity: DwgRegionEntity): THREE.Object3D | null {
    try {
      // REGION 实体通常包含 ACIS 数据
      // 由于 ACIS 数据解析复杂，这里创建一个占位符表示
      
      // 如果有边界点数据，尝试绘制
      if (entity.boundaryData?.points && entity.boundaryData.points.length > 2) {
        const points: THREE.Vector3[] = entity.boundaryData.points.map(p => 
          this.scalePoint(p)
        );
        
        // 创建闭合轮廓并直接返回，无需组包裹
        const lineLoop = this.createLineLoopForEntity(entity, points);
        // 设置CAD类型
        lineLoop.userData.cadType = 'REGION';
        return lineLoop;
      } else {
        // 没有可用数据，创建一个占位符点
        const geometry = new THREE.BufferGeometry();
        const position = entity.position || { x: 0, y: 0, z: 0 };
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([
          position.x * this.scaleFactor,
          position.y * this.scaleFactor,
          (position.z || 0) * this.scaleFactor
        ], 3));
        
        const color = this.getEntityColor(entity);
        const material = new THREE.PointsMaterial({ color, size: 3 });
        const point = new THREE.Points(geometry, material);
        
        // 添加标记表示这是一个未完全支持的 REGION
        point.userData.unsupported = true;
        point.userData.reason = 'ACIS data parsing not implemented';
        // 设置CAD类型
        point.userData.cadType = 'REGION';
        
        // 应用挤出方向
        if (entity.extrusionDirection) {
          this.applyExtrusionDirection(point, entity.extrusionDirection);
        }
        
        return point;
      }
    } catch (error) {
      console.error('[RegionDrawer] Error drawing REGION:', error);
      return null;
    }
  }
}
