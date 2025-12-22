import * as THREE from 'three';
import { DwgEntity, DwgTextEntity } from '../database';
import { BaseDrawer } from './BaseDrawer';

/**
 * 文本绘制器（已弃用）
 * 使用简单的方式绘制TEXT实体
 * 注意：这是一个简化版本，已被 TextMeshDrawer 替代
 */
export class TextDrawer extends BaseDrawer<DwgTextEntity> {
  canDraw(entity: DwgEntity): entity is DwgTextEntity {
    // 支持 TEXT 和 MTEXT 类型
    return entity.type === 'TEXT' || entity.type === 'MTEXT';
  }

  draw(entity: DwgTextEntity): THREE.Object3D | null {
    // 文本实体的基础绘制
    // 由于Three.js文本渲染较复杂，这里返回一个占位符
    // 已弃用，请使用 TextMeshDrawer
    
    if (!entity.text || !entity.text.trim()) {
      return null;
    }

    // 创建一个简单的点标记作为文本位置
    const position = this.scalePoint(entity.startPoint);
    const color = this.getEntityColor(entity);
    
    const geometry = new THREE.SphereGeometry(0.1 * this.scaleFactor);
    const material = new THREE.MeshBasicMaterial({ color });
    const marker = new THREE.Mesh(geometry, material);
    
    marker.position.copy(position);
    marker.userData = {
      type: 'TEXT',
      text: entity.text,
      height: entity.textHeight
    };
    return marker;
  }
}
