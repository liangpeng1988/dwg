import * as THREE from 'three';
import { DwgProxyEntity } from '../database/entities/proxy';
import { BaseDrawer } from './BaseDrawer';
import { DwgEntity } from '../database';

/**
 * 代理实体绘制器
 * 处理 DWG 中的 PROXY 实体
 */
export class ProxyDrawer extends BaseDrawer<DwgProxyEntity> {
  /**
   * 检查实体类型是否匹配
   */
  canDraw(entity:DwgEntity): entity is DwgProxyEntity {
    return entity.type === 'PROXY';
  }

  /**
   * 绘制代理实体
   */
  draw(entity: DwgProxyEntity): THREE.Object3D | null {
    try {
      // PROXY 实体是无法识别的自定义对象的占位符
      // 我们创建一个简单的占位符几何体来表示其存在
      
      // 使用固定的大小作为占位符
      const size = 1 * this.scaleFactor;
      const geometry = new THREE.BoxGeometry(size, size, size);
      
      // 使用特殊颜色表示这是代理对象
      const material = new THREE.MeshBasicMaterial({ 
        color: 0x808080, // 灰色表示代理对象
        wireframe: true   // 使用线框模式更容易识别
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      
      // 添加标识文字
      this.addProxyIdentifier(mesh, entity.applicationEntityClassId);
      
      return mesh;
    } catch (error) {
      console.error('Error drawing proxy entity:', error);
      return null;
    }
  }
  
  /**
   * 添加代理标识
   */
  private addProxyIdentifier(parent: THREE.Object3D, classId: number): void {
    try {
      // 创建标识文字显示代理对象信息
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 32;
      
      const context = canvas.getContext('2d');
      if (context) {
        context.fillStyle = '#808080';
        context.fillRect(0, 0, 64, 32);
        
        context.fillStyle = '#FFFFFF';
        context.font = '10px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(`PROXY:${classId}`, 32, 16);
      }
      
      const texture = new THREE.CanvasTexture(canvas);
      const textMaterial = new THREE.MeshBasicMaterial({ 
        map: texture,
        transparent: true,
        side: THREE.DoubleSide
      });
      
      const textGeometry = new THREE.PlaneGeometry(0.8 * this.scaleFactor, 0.4 * this.scaleFactor);
      const textMesh = new THREE.Mesh(textGeometry, textMaterial);
      textMesh.position.y = 0.7 * this.scaleFactor; // 放在立方体上方
      
      // 将文字添加为子对象
      parent.add(textMesh);
    } catch (error) {
      console.warn('Failed to add proxy identifier:', error);
    }
  }
}