import * as THREE from 'three';
import { DwgImageEntity } from '../database/entities/image';
import { BaseDrawer } from './BaseDrawer';

/**
 * 图像实体绘制器
 * 处理 DWG 中的 IMAGE 实体
 */
export class ImageDrawer extends BaseDrawer<DwgImageEntity> {
  /**
   * 检查实体类型是否匹配
   */
  canDraw(entity: import("../database/entities/entity").DwgEntity): entity is DwgImageEntity {
    return entity.type === 'IMAGE';
  }

  /**
   * 绘制图像实体
   */
  draw(entity: DwgImageEntity): THREE.Object3D | null {
    try {
      // 图像实体需要特殊的处理，这里创建一个占位符
      // 实际的图像处理可能需要额外的资源加载
      
      // 获取图像尺寸信息
      let width = entity.imageSize?.x || 1;
      let height = entity.imageSize?.y || 1;
      
      // 如果有图像定义引用，尝试获取更准确的尺寸信息
      if (entity.imageDefHandle) {
        console.log('Image entity references image def:', entity.imageDefHandle);
        // 这里可以访问 ViewportDraw 中存储的图像定义数据
        // 但由于当前架构限制，暂时无法直接访问
      }
      
      // 应用缩放因子
      const scaledWidth = width * this.scaleFactor;
      const scaledHeight = height * this.scaleFactor;
      
      const geometry = new THREE.PlaneGeometry(scaledWidth, scaledHeight);
      
      // 创建基础材质（如果没有图像数据，则使用颜色材质）
      let material: THREE.Material;
      
      if (entity.binaryData) {
        // 如果有图像数据，尝试创建纹理
        try {
          // 这里需要根据实际的图像数据创建纹理
          // 由于图像数据可能是二进制格式，需要特殊处理
          const texture = this.createPlaceholderTexture();
          material = new THREE.MeshBasicMaterial({ 
            map: texture,
            side: THREE.DoubleSide,
            transparent: true
          });
        } catch (e) {
          // 如果无法创建纹理，使用颜色材质
          material = new THREE.MeshBasicMaterial({ 
            color: 0xADD8E6, // 浅蓝色作为图像占位符
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.7
          });
        }
      } else {
        // 没有图像数据时使用颜色材质
        material = new THREE.MeshBasicMaterial({ 
          color: 0xADD8E6, // 浅蓝色作为图像占位符
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.7
        });
      }
      
      const mesh = new THREE.Mesh(geometry, material);
      
      // 设置位置
      if (entity.position) {
        const position = this.scalePoint(entity.position);
        mesh.position.set(position.x, position.y, position.z || 0);
      }
      
      // 应用旋转（如果存在）
      if (entity.uPixel && entity.vPixel) {
        // 根据像素向量计算旋转
        this.applyImageRotation(mesh, entity.uPixel, entity.vPixel);
      }
      
      // 应用裁剪边界（如果存在）
      if (entity.clipping && entity.clippingBoundaryPath && entity.clippingBoundaryPath.length > 0) {
        // 这里可以应用裁剪逻辑
        console.log('Image has clipping boundary with', entity.clippingBoundaryPath.length, 'points');
      }
      
      return mesh;
    } catch (error) {
      console.error('Error drawing image entity:', error);
      return null;
    }
  }
  
  /**
   * 创建占位符纹理
   */
  private createPlaceholderTexture(): THREE.Texture {
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
      
      // 添加文字标识
      context.fillStyle = '#FFFFFF';
      context.font = '12px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('IMAGE', 32, 32);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    
    return texture;
  }
  
  /**
   * 应用图像旋转
   */
  private applyImageRotation(mesh: THREE.Mesh, uPixel: import("../database/common").DwgPoint3D, vPixel: import("../database/common").DwgPoint3D): void {
    try {
      // 计算u和v向量
      const uVec = new THREE.Vector3(uPixel.x, uPixel.y, uPixel.z || 0);
      const vVec = new THREE.Vector3(vPixel.x, vPixel.y, vPixel.z || 0);
      
      // 计算法向量
      const normal = new THREE.Vector3();
      normal.crossVectors(uVec, vVec).normalize();
      
      // 创建变换矩阵
      const matrix = new THREE.Matrix4();
      matrix.makeBasis(uVec.normalize(), vVec.normalize(), normal);
      
      // 应用变换
      mesh.setRotationFromMatrix(matrix);
    } catch (error) {
      console.warn('Failed to apply image rotation:', error);
    }
  }
}