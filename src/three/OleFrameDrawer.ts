import * as THREE from 'three';
import { DwgOleFrameEntity, DwgOle2FrameEntity } from '../database/entities/oleframe';
import { BaseDrawer } from './BaseDrawer';

/**
 * OLE框架实体绘制器
 * 处理 DWG 中的 OLEFRAME 和 OLE2FRAME 实体
 */
export class OleFrameDrawer extends BaseDrawer<DwgOleFrameEntity | DwgOle2FrameEntity> {
  /**
   * 检查实体类型是否匹配
   */
  canDraw(entity: import("../database/entities/entity").DwgEntity): entity is DwgOleFrameEntity | DwgOle2FrameEntity {
    return entity.type === 'OLEFRAME' || entity.type === 'OLE2FRAME';
  }

  /**
   * 绘制OLE框架实体
   */
  draw(entity: DwgOleFrameEntity | DwgOle2FrameEntity): THREE.Object3D | null {
    try {
      // OLE框架实体通常包含嵌入的对象数据
      // 由于这些数据可能是专有格式，我们创建一个占位符矩形来表示其位置和大小
      
      let width = 1;
      let height = 1;
      let position: THREE.Vector3 | null = null;
      
      if (entity.type === 'OLE2FRAME' && 'leftUpPoint' in entity && 'rightDownPoint' in entity) {
        // 对于OLE2FRAME，我们可以计算边界框
        const leftUp = entity.leftUpPoint;
        const rightDown = entity.rightDownPoint;
        
        width = Math.abs(rightDown.x - leftUp.x);
        height = Math.abs(rightDown.y - leftUp.y);
        
        // 计算中心点
        const centerX = (leftUp.x + rightDown.x) / 2;
        const centerY = (leftUp.y + rightDown.y) / 2;
        position = this.scalePoint({ x: centerX, y: centerY, z: leftUp.z || 0 });
      } else {
        // 对于OLEFRAME或其他情况，使用默认大小
        position = new THREE.Vector3(0, 0, 0);
      }
      
      // 应用缩放因子
      const scaledWidth = width * this.scaleFactor;
      const scaledHeight = height * this.scaleFactor;
      
      // 创建矩形几何体
      const geometry = new THREE.PlaneGeometry(scaledWidth, scaledHeight);
      
      // 创建材质
      const material = new THREE.MeshBasicMaterial({ 
        color: entity.type === 'OLE2FRAME' ? 0xFFA500 : 0xFF8C00, // 橙色表示OLE对象
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      
      // 设置位置
      if (position) {
        mesh.position.copy(position);
      }
      
      // 添加标识文字
      this.addIdentifierText(mesh, entity.type);
      
      return mesh;
    } catch (error) {
      console.error('Error drawing OLE frame entity:', error);
      return null;
    }
  }
  
  /**
   * 添加标识文字
   */
  private addIdentifierText(parent: THREE.Object3D, entityType: string): void {
    try {
      // 创建一个小的标识文字来显示这是OLE对象
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 32;
      
      const context = canvas.getContext('2d');
      if (context) {
        context.fillStyle = '#000000';
        context.fillRect(0, 0, 64, 32);
        
        context.fillStyle = '#FFFFFF';
        context.font = '12px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(entityType, 32, 16);
      }
      
      const texture = new THREE.CanvasTexture(canvas);
      const textMaterial = new THREE.MeshBasicMaterial({ 
        map: texture,
        transparent: true,
        side: THREE.DoubleSide
      });
      
      const textGeometry = new THREE.PlaneGeometry(0.5 * this.scaleFactor, 0.25 * this.scaleFactor);
      const textMesh = new THREE.Mesh(textGeometry, textMaterial);
      
      // 将文字添加为子对象
      parent.add(textMesh);
    } catch (error) {
      console.warn('Failed to add identifier text for OLE frame:', error);
    }
  }
}