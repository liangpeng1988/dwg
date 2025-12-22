import * as THREE from 'three';
import { DwgEntity, DwgMLineEntity } from '../database';
import { BaseDrawer } from './BaseDrawer';

/**
 * 多线绘制器
 * 绘制 MLINE（多线）类型的实体
 * MLINE 由多条平行线组成，沿着一系列顶点延伸
 */
export class MlineDrawer extends BaseDrawer<DwgMLineEntity> {
  
  canDraw(entity: DwgEntity): entity is DwgMLineEntity {
    return entity.type === 'MLINE';
  }

  draw(entity: DwgMLineEntity): THREE.Group {
    const group = new THREE.Group();
    
    const vertices = entity.vertices || [];
    if (vertices.length < 2) {
      return group;
    }
    
    const numberOfLines = entity.numberOfLines || 1;
    const scale = entity.scale || 1;
    
    // 获取颜色
    const color = this.getEntityColor(entity);
    
    // 绘制每条平行线
    for (let lineIndex = 0; lineIndex < numberOfLines; lineIndex++) {
      const linePoints: THREE.Vector3[] = [];
      
      for (const vertex of vertices) {
        const v = vertex.vertex;
        const dir = vertex.miterDirection;
        
        // 根据线索引计算偏移量
        // 简化处理：假设线均匀分布
        const offset = this.calculateLineOffset(lineIndex, numberOfLines, scale);
        
        // 计算偏移后的点
        const offsetPoint = new THREE.Vector3(
          (v.x + (dir?.x || 0) * offset) * this.scaleFactor,
          (v.y + (dir?.y || 0) * offset) * this.scaleFactor,
          ((v.z || 0) + (dir?.z || 0) * offset) * this.scaleFactor
        );
        
        linePoints.push(offsetPoint);
      }
      
      // 检查是否闭合
      const isClosed = (entity.flags & 2) !== 0;
      if (isClosed && linePoints.length > 1) {
        linePoints.push(linePoints[0].clone());
      }
      
      // 创建线段
      if (linePoints.length >= 2) {
        const line = this.createLineForEntity(entity, linePoints);
        group.add(line);
      }
    }
    
    return group;
  }

  /**
   * 计算多线中单条线的偏移量
   * @param lineIndex 线索引
   * @param totalLines 总线数
   * @param scale 缩放因子
   */
  private calculateLineOffset(lineIndex: number, totalLines: number, scale: number): number {
    if (totalLines <= 1) {
      return 0;
    }
    
    // 线均匀分布在中心两侧
    const spacing = scale * 0.5; // 默认间距
    const centerIndex = (totalLines - 1) / 2;
    const offset = (lineIndex - centerIndex) * spacing;
    
    return offset;
  }
}
