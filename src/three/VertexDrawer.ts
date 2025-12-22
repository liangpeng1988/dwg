import * as THREE from 'three';
import { DwgVertex2dEntity, DwgVertex3dEntity } from '../database/entities/vertex';
import { BaseDrawer } from './BaseDrawer';

/**
 * 顶点实体绘制器
 * 处理 DWG 中的 VERTEX 实体
 * 注意：VERTEX 实体通常作为 POLYLINE 的一部分处理，这里提供独立绘制支持
 */
export class VertexDrawer extends BaseDrawer<DwgVertex2dEntity | DwgVertex3dEntity> {
  /**
   * 检查实体类型是否匹配
   */
  canDraw(entity: import("../database/entities/entity").DwgEntity): entity is DwgVertex2dEntity | DwgVertex3dEntity {
    return entity.type === 'VERTEX';
  }

  /**
   * 绘制顶点实体
   */
  draw(entity: DwgVertex2dEntity | DwgVertex3dEntity): THREE.Object3D | null {
    try {
      // 顶点通常作为其他实体的一部分处理，但我们可以绘制一个标记来表示其位置
      const position = this.scalePoint(entity);
      
      // 根据顶点标志确定显示样式
      let color = 0xFF0000; // 默认红色
      let size = 0.1 * this.scaleFactor;
      
      if (entity.flag) {
        // 根据标志设置不同颜色
        if (entity.flag & 1) { // CREATED_BY_CURVE_FIT
          color = 0x00FF00; // 绿色
          size = 0.15 * this.scaleFactor;
        } else if (entity.flag & 8) { // CREATED_BY_SPLINE_FIT
          color = 0x0000FF; // 蓝色
          size = 0.12 * this.scaleFactor;
        } else if (entity.flag & 16) { // SPLINE_CONTROL_POINT
          color = 0xFFFF00; // 黄色
          size = 0.18 * this.scaleFactor;
        }
      }
      
      // 创建顶点标记
      const geometry = new THREE.SphereGeometry(size, 8, 8);
      const material = new THREE.MeshBasicMaterial({ 
        color: color,
        transparent: true,
        opacity: 0.8
      });
      
      const marker = new THREE.Mesh(geometry, material);
      marker.position.set(position.x, position.y, position.z || 0);
      
      // 添加标识文字
      this.addVertexInfo(marker, entity);
      
      return marker;
    } catch (error) {
      console.error('Error drawing vertex entity:', error);
      return null;
    }
  }
  
  /**
   * 添加顶点信息
   */
  private addVertexInfo(marker: THREE.Mesh, entity: DwgVertex2dEntity | DwgVertex3dEntity): void {
    try {
      // 创建包含顶点信息的标签
      const canvas = document.createElement('canvas');
      canvas.width = 96;
      canvas.height = 32;
      
      const context = canvas.getContext('2d');
      if (context) {
        context.fillStyle = '#000000';
        context.fillRect(0, 0, 96, 32);
        
        context.fillStyle = '#FFFFFF';
        context.font = '10px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // 显示坐标信息
        const x = entity.x.toFixed(1);
        const y = entity.y.toFixed(1);
        const z = entity.z ? entity.z.toFixed(1) : '0.0';
        context.fillText(`(${x},${y},${z})`, 48, 16);
      }
      
      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.MeshBasicMaterial({ 
        map: texture,
        transparent: true,
        side: THREE.DoubleSide
      });
      
      const geometry = new THREE.PlaneGeometry(0.5 * this.scaleFactor, 0.17 * this.scaleFactor);
      const label = new THREE.Mesh(geometry, material);
      label.position.y = 0.3 * this.scaleFactor; // 放在标记上方
      
      marker.add(label);
    } catch (error) {
      console.warn('Failed to add vertex info:', error);
    }
  }
}