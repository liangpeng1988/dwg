import * as THREE from 'three';
import { DwgEntity, DwgLineEntity } from '../database';
import { BaseDrawer } from './BaseDrawer';

/**
 * 线段绘制器
 * 绘制 DwgLineEntity 类型的实体
 */
export class LineDrawer extends BaseDrawer<DwgLineEntity> {
  
  canDraw(entity: DwgEntity): entity is DwgLineEntity {
    return entity.type === 'LINE';
  }

  draw(entity: DwgLineEntity): THREE.Line {
    const start = this.scalePoint(entity.startPoint);
    const end = this.scalePoint(entity.endPoint);
    
    // 使用实体颜色
    const color = this.getEntityColor(entity);
    const line = this.createLineFromPoints([start, end], color);
    
    // 应用 extrusionDirection
    this.applyExtrusionDirection(line, entity.extrusionDirection);
    
    return line;
  }
}
