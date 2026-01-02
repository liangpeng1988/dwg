import * as THREE from 'three';
import { DwgWipeoutEntity } from '../database/entities/wipeout';
import { BaseDrawer } from './BaseDrawer';

/**
 * 擦除实体绘制器
 * 处理 DWG 中的 WIPEOUT 实体
 */
export class WipeoutDrawer extends BaseDrawer<DwgWipeoutEntity> {
  /**
   * 检查实体类型是否匹配
   */
  canDraw(entity: import("../database/entities/entity").DwgEntity): entity is DwgWipeoutEntity {
    return entity.type === 'WIPEOUT';
  }

  /**
   * 绘制擦除实体
   */
  draw(entity: DwgWipeoutEntity): THREE.Object3D | null {
    try {
      // WIPEOUT 实体类似于 IMAGE 实体，但用于遮盖其他图形
      // 创建一个简单的平面几何体作为擦除占位符
      
      const width = entity.imageSize.x || 1;
      const height = entity.imageSize.y || 1;
      
      // 应用缩放因子
      const scaledWidth = width * this.scaleFactor;
      const scaledHeight = height * this.scaleFactor;
      
      const geometry = new THREE.PlaneGeometry(scaledWidth, scaledHeight);
      
      // 使用纯白色材质表示擦除区域
      const material = new THREE.MeshBasicMaterial({ 
        color: 0xFFFFFF,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
        polygonOffset: true,
        polygonOffsetFactor: -2, // 负值表示更靠近相机，确保遮盖
        polygonOffsetUnits: -2,
        depthWrite: true
      });

      
      const mesh = new THREE.Mesh(geometry, material);
      
      // 设置位置
      if (entity.position) {
        const position = this.scalePoint(entity.position);
        mesh.position.set(position.x, position.y, position.z || 0);
      }
      
      // 应用旋转（如果存在）
      if (entity.uPixel && entity.vPixel) {
        this.applyWipeoutRotation(mesh, entity.uPixel, entity.vPixel);
      }
      
      // 应用裁剪边界（如果存在）
      if (entity.clipping && entity.clippingBoundaryPath && entity.clippingBoundaryPath.length > 0) {
        // 对于擦除实体，裁剪边界定义了擦除的形状
        if (entity.clippingBoundaryPath.length > 2) {
          // 使用多边形裁剪边界
          const shape = this.createClippingShape(entity.clippingBoundaryPath);
          const shapeGeometry = new THREE.ShapeGeometry(shape);
          mesh.geometry = shapeGeometry;
        }
      }
      
      return mesh;
    } catch (error) {
      console.error('Error drawing wipeout entity:', error);
      return null;
    }
  }
  
  /**
   * 应用擦除实体旋转
   */
  private applyWipeoutRotation(mesh: THREE.Mesh, uPixel: import("../database/common").DwgPoint3D, vPixel: import("../database/common").DwgPoint3D): void {
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
      console.warn('Failed to apply wipeout rotation:', error);
    }
  }
  
  /**
   * 创建裁剪形状
   */
  private createClippingShape(boundaryPoints: import("../database/common").DwgPoint2D[]): THREE.Shape {
    const shape = new THREE.Shape();
    
    if (boundaryPoints.length > 0) {
      // 移动到第一个点
      const firstPoint = boundaryPoints[0];
      shape.moveTo(firstPoint.x, firstPoint.y);
      
      // 连接到后续点
      for (let i = 1; i < boundaryPoints.length; i++) {
        const point = boundaryPoints[i];
        shape.lineTo(point.x, point.y);
      }
      
      // 闭合形状
      shape.closePath();
    }
    
    return shape;
  }
}