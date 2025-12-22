import * as THREE from 'three';
import { DwgEntity, DwgAttdefEntity, DwgAttribEntity } from '../database';
import { BaseDrawer } from './BaseDrawer';

// 支持的属性实体类型联合
type SupportedAttribEntity = DwgAttdefEntity | DwgAttribEntity;

/**
 * 属性绘制器
 * 绘制 ATTDEF (属性定义) 和 ATTRIB (属性) 实体
 * ATTDEF 是块定义中的属性模板
 * ATTRIB 是块插入中的属性实例
 */
export class AttribDrawer extends BaseDrawer<SupportedAttribEntity> {
  
  canDraw(entity: DwgEntity): entity is SupportedAttribEntity {
    return entity.type === 'ATTDEF' || entity.type === 'ATTRIB';
  }

  draw(entity: SupportedAttribEntity): THREE.Group | null {
    const group = new THREE.Group();
    
    try {
      // 获取文字内容
      const textContent = this.getTextContent(entity);
      if (!textContent) {
        return null;
      }
      
      // 获取文字属性
      const textBase = entity.text;
      if (!textBase) {
        return null;
      }
      
      // 获取颜色
      const color = this.getEntityColor(entity);
      
      // 获取位置（使用 startPoint）
      const position = textBase.startPoint || { x: 0, y: 0 };
      const positionWithZ = { x: position.x, y: position.y, z: 0 };
      
      // 获取高度（使用 textHeight）
      const height = (textBase.textHeight || 2.5) * this.scaleFactor;
      
      // 获取旋转角度
      const rotation = textBase.rotation || 0;
      
      // 检查属性是否可见（flags 的第 1 位表示不可见）
      const isInvisible = !!(entity.flags & 1);
      if (isInvisible) {
        // 对于不可见的属性，可以选择不绘制或用不同样式绘制
        // 这里我们用虚线边框表示
        const textMesh = this.createAttributeText(textContent, positionWithZ, height, color, rotation, true);
        if (textMesh) {
          group.add(textMesh);
        }
      } else {
        const textMesh = this.createAttributeText(textContent, positionWithZ, height, color, rotation, false);
        if (textMesh) {
          group.add(textMesh);
        }
      }
      
      // 如果是 ATTDEF，可以显示标签提示
      if (entity.type === 'ATTDEF') {
        const attdef = entity as DwgAttdefEntity;
        // 可选：绘制标签指示器
        if (attdef.tag) {
          const tagIndicator = this.createTagIndicator(positionWithZ, height, color);
          if (tagIndicator) {
            group.add(tagIndicator);
          }
        }
      }
      
      // 应用 extrusion direction（如果存在）
      if (textBase.extrusionDirection) {
        this.applyExtrusionDirection(group, textBase.extrusionDirection);
      }
      
    } catch (error) {
      console.error('Error drawing attribute:', error);
    }
    
    return group.children.length > 0 ? group : null;
  }
  
  /**
   * 获取文字内容
   */
  private getTextContent(entity: SupportedAttribEntity): string {
    const textBase = entity.text;
    if (!textBase) return '';
    
    // 优先使用 text 属性
    if (textBase.text) {
      return textBase.text;
    }
    
    // 对于 ATTDEF，可能在 defaultValue 中
    if (entity.type === 'ATTDEF') {
      const attdef = entity as DwgAttdefEntity;
      // 使用 tag 作为显示内容（如果没有默认值）
      return attdef.tag || '';
    }
    
    return '';
  }
  
  /**
   * 创建属性文字
   */
  private createAttributeText(
    text: string,
    position: { x: number; y: number; z?: number },
    height: number,
    color: number,
    rotation: number,
    isInvisible: boolean
  ): THREE.Mesh | null {
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return null;

      // 计算画布大小
      canvas.width = 512;
      canvas.height = 128;
      
      // 清除画布
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      // 设置字体样式
      const colorHex = '#' + color.toString(16).padStart(6, '0');
      context.fillStyle = colorHex;
      context.font = '48px Arial';
      context.textAlign = 'left';
      context.textBaseline = 'middle';
      
      // 如果是不可见属性，使用虚线样式
      if (isInvisible) {
        context.globalAlpha = 0.5;
        context.setLineDash([5, 5]);
        context.strokeStyle = colorHex;
        context.lineWidth = 2;
        context.strokeText(text, 10, canvas.height / 2);
      } else {
        context.fillText(text, 10, canvas.height / 2);
      }

      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.MeshBasicMaterial({ 
        map: texture, 
        transparent: true,
        alphaTest: 0.1,
        side: THREE.DoubleSide
      });
      
      // 计算宽高比
      const aspectRatio = canvas.width / canvas.height;
      const geometry = new THREE.PlaneGeometry(height * aspectRatio, height);
      const textMesh = new THREE.Mesh(geometry, material);

      // 设置位置
      textMesh.position.set(
        (position.x || 0) * this.scaleFactor,
        (position.y || 0) * this.scaleFactor,
        (position.z || 0) * this.scaleFactor
      );
      
      // 设置旋转
      if (rotation) {
        textMesh.rotation.z = rotation;
      }

      return textMesh;
    } catch (error) {
      console.error('Error creating attribute text:', error);
      return null;
    }
  }
  
  /**
   * 创建标签指示器（用于 ATTDEF）
   */
  private createTagIndicator(
    position: { x: number; y: number; z?: number },
    height: number,
    color: number
  ): THREE.Line | null {
    try {
      // 创建一个小的菱形标记
      const size = height * 0.2;
      const x = (position.x || 0) * this.scaleFactor - size * 2;
      const y = (position.y || 0) * this.scaleFactor;
      const z = (position.z || 0) * this.scaleFactor;
      
      const points = [
        new THREE.Vector3(x, y + size, z),
        new THREE.Vector3(x + size, y, z),
        new THREE.Vector3(x, y - size, z),
        new THREE.Vector3(x - size, y, z),
        new THREE.Vector3(x, y + size, z)
      ];
      
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color });
      return new THREE.Line(geometry, material);
    } catch (error) {
      return null;
    }
  }
}
