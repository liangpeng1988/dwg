import * as THREE from 'three';
import { DwgLayoutObject } from '../database/objects/layout';
import { BaseDrawer } from './BaseDrawer';

/**
 * 布局对象处理类
 * 处理 DWG 中的 LAYOUT 对象
 */
export class LayoutDrawer extends BaseDrawer<DwgLayoutObject> {
  /**
   * 检查对象类型是否匹配
   */
  canDraw(object: any): object is DwgLayoutObject {
    // LAYOUT 对象通常不直接绘制，而是作为布局信息提供者
    // 这里返回 false 表示这些对象不直接绘制
    return false;
  }

  /**
   * 绘制对象（通常不直接调用）
   */
  draw(object: DwgLayoutObject): THREE.Object3D | null {
    // LAYOUT 对象通常不直接绘制，而是作为数据提供者
    // 返回 null 表示不创建可视对象
    return null;
  }

  /**
   * 获取布局信息
   */
  getLayoutInfo(layout: DwgLayoutObject): {
    name: string;
    paperWidth: number;
    paperHeight: number;
    tabOrder: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } {
    return {
      name: layout.layoutName || 'Unnamed Layout',
      paperWidth: layout.maxExtent?.x && layout.minExtent?.x ? 
        Math.abs(layout.maxExtent.x - layout.minExtent.x) : 0,
      paperHeight: layout.maxExtent?.y && layout.minExtent?.y ? 
        Math.abs(layout.maxExtent.y - layout.minExtent.y) : 0,
      tabOrder: layout.tabOrder || 0,
      minX: layout.minLimit?.x || 0,
      minY: layout.minLimit?.y || 0,
      maxX: layout.maxLimit?.x || 0,
      maxY: layout.maxLimit?.y || 0
    };
  }

  /**
   * 创建布局边界框
   */
  createLayoutBoundary(layout: DwgLayoutObject): THREE.Line | null {
    try {
      const info = this.getLayoutInfo(layout);
      
      // 创建边界框的四个角点
      const points = [
        new THREE.Vector3(info.minX * this.scaleFactor, info.minY * this.scaleFactor, 0),
        new THREE.Vector3(info.maxX * this.scaleFactor, info.minY * this.scaleFactor, 0),
        new THREE.Vector3(info.maxX * this.scaleFactor, info.maxY * this.scaleFactor, 0),
        new THREE.Vector3(info.minX * this.scaleFactor, info.maxY * this.scaleFactor, 0),
        new THREE.Vector3(info.minX * this.scaleFactor, info.minY * this.scaleFactor, 0)
      ];
      
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ 
        color: 0x00FF00, // 绿色表示布局边界
        linewidth: 2
      });
      
      const line = new THREE.Line(geometry, material);
      return line;
    } catch (error) {
      console.warn('Failed to create layout boundary:', error);
      return null;
    }
  }

  /**
   * 创建布局信息标签
   */
  createLayoutLabel(layout: DwgLayoutObject): THREE.Mesh | null {
    try {
      const info = this.getLayoutInfo(layout);
      
      // 创建包含布局信息的标签
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 64;
      
      const context = canvas.getContext('2d');
      if (context) {
        context.fillStyle = '#00FF00';
        context.fillRect(0, 0, 128, 64);
        
        context.fillStyle = '#FFFFFF';
        context.font = '10px Arial';
        context.textAlign = 'left';
        context.textBaseline = 'top';
        
        // 显示布局基本信息
        context.fillText(`Layout: ${info.name}`, 4, 4);
        context.fillText(`Size: ${info.paperWidth?.toFixed(1)}×${info.paperHeight?.toFixed(1)}`, 4, 18);
        context.fillText(`Tab: ${info.tabOrder}`, 4, 32);
      }
      
      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.MeshBasicMaterial({ 
        map: texture,
        transparent: true,
        side: THREE.DoubleSide
      });
      
      const geometry = new THREE.PlaneGeometry(1 * this.scaleFactor, 0.5 * this.scaleFactor);
      const label = new THREE.Mesh(geometry, material);
      
      return label;
    } catch (error) {
      console.warn('Failed to create layout label:', error);
      return null;
    }
  }
}