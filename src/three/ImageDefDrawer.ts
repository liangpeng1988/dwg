import * as THREE from 'three';
import { DwgImageDefObject } from '../database/objects/imageDef';
import { BaseDrawer } from './BaseDrawer';

/**
 * 图像定义对象处理类
 * 处理 DWG 中的 IMAGEDEF 对象
 */
export class ImageDefDrawer extends BaseDrawer<DwgImageDefObject> {
  /**
   * 检查对象类型是否匹配
   */
  canDraw(object: any): object is DwgImageDefObject {
    // IMAGEDEF 对象通常不直接绘制，而是作为 IMAGE 实体的引用
    // 这里返回 false 表示这些对象不直接绘制
    return false;
  }

  /**
   * 绘制对象（通常不直接调用）
   */
  draw(object: DwgImageDefObject): THREE.Object3D | null {
    // IMAGEDEF 对象通常不直接绘制，而是作为数据提供者
    // 返回 null 表示不创建可视对象
    return null;
  }

  /**
   * 获取图像定义信息
   */
  getImageInfo(imageDef: DwgImageDefObject): {
    fileName: string;
    width: number;
    height: number;
    isLoaded: boolean;
    resolutionUnits: number;
  } {
    return {
      fileName: imageDef.fileName || 'unknown',
      width: imageDef.size?.x || 0,
      height: imageDef.size?.y || 0,
      isLoaded: !!imageDef.isLoaded,
      resolutionUnits: imageDef.resolutionUnits || 0
    };
  }

  /**
   * 创建图像预览
   */
  createImagePreview(imageDef: DwgImageDefObject): THREE.Mesh | null {
    try {
      const width = (imageDef.size?.x || 1) * this.scaleFactor;
      const height = (imageDef.size?.y || 1) * this.scaleFactor;
      
      // 创建占位符几何体
      const geometry = new THREE.PlaneGeometry(width, height);
      
      // 创建占位符纹理
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      
      const context = canvas.getContext('2d');
      if (context) {
        // 创建棋盘图案作为占位符
        context.fillStyle = '#ADD8E6';
        context.fillRect(0, 0, 64, 64);
        
        context.fillStyle = '#87CEEB';
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            if ((x + y) % 2 === 0) {
              context.fillRect(x * 8, y * 8, 8, 8);
            }
          }
        }
        
        // 添加文件名标识
        context.fillStyle = '#FFFFFF';
        context.font = '10px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        const fileName = imageDef.fileName ? 
          imageDef.fileName.substring(imageDef.fileName.lastIndexOf('/') + 1) : 
          'IMAGE';
        context.fillText(fileName.substring(0, 8), 32, 32);
      }
      
      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.MeshBasicMaterial({ 
        map: texture,
        side: THREE.DoubleSide,
        transparent: true
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      return mesh;
    } catch (error) {
      console.warn('Failed to create image preview:', error);
      return null;
    }
  }
}