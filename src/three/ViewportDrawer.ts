import * as THREE from 'three';
import { DwgViewportEntity } from '../database/entities/viewport';
import { BaseDrawer } from './BaseDrawer';

/**
 * 视口实体绘制器
 * 处理 DWG 中的 VIEWPORT 实体
 */
export class ViewportDrawer extends BaseDrawer<DwgViewportEntity> {
  /**
   * 检查实体类型是否匹配
   */
  canDraw(entity: import("../database/entities/entity").DwgEntity): entity is DwgViewportEntity {
    return entity.type === 'VIEWPORT';
  }

  /**
   * 绘制视口实体
   */
  draw(entity: DwgViewportEntity): THREE.Object3D | null {
    try {
      const group = new THREE.Group();
      
      // 创建视口边框
      const width = (entity.width || 1) * this.scaleFactor;
      const height = (entity.height || 1) * this.scaleFactor;
      
      // 创建矩形边框
      const borderGeometry = new THREE.BoxGeometry(width, height, 0.1 * this.scaleFactor);
      const borderColor = this.getEntityColor(entity, 0x0000FF); // 默认蓝色
      const borderMaterial = new THREE.MeshBasicMaterial({
        color: borderColor,
        wireframe: true
      });
      const border = new THREE.Mesh(borderGeometry, borderMaterial);
      group.add(border);
      
      // 设置视口位置
      if (entity.viewportCenter) {
        const center = this.scalePoint(entity.viewportCenter);
        group.position.set(center.x, center.y, center.z || 0);
      }
      
      // 如果视口处于关闭状态，添加特殊标记
      if (entity.statusBitFlags && (entity.statusBitFlags & 131072)) { // VIEWPORT_OFF
        this.addDisabledMarker(group);
      }
      
      // 添加视口信息标签
      this.addViewInfo(group, entity);
      
      return group;
    } catch (error) {
      console.error('Error drawing viewport entity:', error);
      return null;
    }
  }
  
  /**
   * 添加禁用标记
   */
  private addDisabledMarker(parent: THREE.Group): void {
    try {
      // 创建一个X标记表示视口已禁用
      const size = 0.3 * this.scaleFactor;
      const geometry = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        -size, -size, 0,
        size, size, 0,
        -size, size, 0,
        size, -size, 0
      ]);
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      
      const material = new THREE.LineBasicMaterial({ color: 0xFF0000 }); // 红色
      const cross = new THREE.LineSegments(geometry, material);
      
      parent.add(cross);
    } catch (error) {
      console.warn('Failed to add disabled marker:', error);
    }
  }
  
  /**
   * 添加视口信息
   */
  private addViewInfo(parent: THREE.Group, entity: DwgViewportEntity): void {
    try {
      // 创建包含视口信息的标签
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 64;
      
      const context = canvas.getContext('2d');
      if (context) {
        context.fillStyle = '#0000FF';
        context.fillRect(0, 0, 128, 64);
        
        context.fillStyle = '#FFFFFF';
        context.font = '10px Arial';
        context.textAlign = 'left';
        context.textBaseline = 'top';
        
        // 显示视口基本信息
        context.fillText(`ID: ${entity.viewportId || 'N/A'}`, 4, 4);
        context.fillText(`Size: ${entity.width?.toFixed(1)}×${entity.height?.toFixed(1)}`, 4, 18);
        context.fillText(`Sheet: ${entity.sheetName || 'N/A'}`, 4, 32);
        
        // 显示状态信息
        if (entity.statusBitFlags) {
          const statusText = this.getStatusText(entity.statusBitFlags);
          context.fillText(statusText, 4, 46);
        }
      }
      
      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.MeshBasicMaterial({ 
        map: texture,
        transparent: true,
        side: THREE.DoubleSide
      });
      
      const geometry = new THREE.PlaneGeometry(0.8 * this.scaleFactor, 0.4 * this.scaleFactor);
      const label = new THREE.Mesh(geometry, material);
      label.position.y = (entity.height || 1) * this.scaleFactor / 2 + 0.3 * this.scaleFactor; // 放在视口上方
      
      parent.add(label);
    } catch (error) {
      console.warn('Failed to add view info:', error);
    }
  }
  
  /**
   * 获取状态文本
   */
  private getStatusText(flags: number): string {
    const statuses: string[] = [];
    
    if (flags & 1) statuses.push('Perspective');
    if (flags & 2) statuses.push('Front Clip');
    if (flags & 4) statuses.push('Back Clip');
    if (flags & 32) statuses.push('Icon');
    if (flags & 256) statuses.push('Snap');
    if (flags & 512) statuses.push('Grid');
    if (flags & 131072) statuses.push('OFF');
    
    return statuses.length > 0 ? statuses.join(',') : 'Normal';
  }
}