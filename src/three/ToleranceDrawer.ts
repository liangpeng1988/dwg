import * as THREE from 'three';
import { DwgToleranceEntity } from '../database/entities/tolerance';
import { BaseDrawer } from './BaseDrawer';
import { DwgEntity } from '../database';


/**
 * 公差实体绘制器
 * 处理 DWG 中的 TOLERANCE 实体
 */
export class ToleranceDrawer extends BaseDrawer<DwgToleranceEntity> {
  /**
   * 检查实体类型是否匹配
   */
  canDraw(entity:DwgEntity): entity is DwgToleranceEntity {
    return entity.type === 'TOLERANCE';
  }

  /**
   * 绘制公差实体
   */
  draw(entity: DwgToleranceEntity): THREE.Object3D | null {
    try {
      // 公差实体包含文本表示和位置信息
      const group = new THREE.Group();
      
      // 设置位置
      if (entity.insertionPoint) {
        const position = this.scalePoint(entity.insertionPoint);
        group.position.set(position.x, position.y, position.z || 0);
      }
      
      // 创建公差符号框架
      const frameSize = 0.5 * this.scaleFactor;
      const frameGeometry = new THREE.BoxGeometry(frameSize, frameSize, 0.1 * this.scaleFactor);
      const frameMaterial = new THREE.MeshBasicMaterial({
        color: this.getEntityColor(entity, 0x000000),
        wireframe: true
      });
      const frame = new THREE.Mesh(frameGeometry, frameMaterial);
      group.add(frame);
      
      // 添加公差文本
      if (entity.text) {
        this.addToleranceText(group, entity.text);
      }
      
      // 应用旋转（如果存在）
      if (entity.xAxisDirection) {
        this.applyToleranceRotation(group, entity.xAxisDirection, entity.extrusionDirection);
      }
      
      return group;
    } catch (error) {
      console.error('Error drawing tolerance entity:', error);
      return null;
    }
  }
  
  /**
   * 添加公差文本
   */
  private addToleranceText(parent: THREE.Group, text: string): void {
    try {
      // 创建文本画布
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 64;
      
      const context = canvas.getContext('2d');
      if (context) {
        // 设置背景
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, 128, 64);
        
        // 设置文字样式
        context.fillStyle = '#000000';
        context.font = '12px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // 处理多行文本
        const lines = text.split('\\P'); // AutoCAD换行符
        const lineHeight = 16;
        const startY = (64 - (lines.length - 1) * lineHeight) / 2;
        
        for (let i = 0; i < lines.length; i++) {
          context.fillText(lines[i], 64, startY + i * lineHeight);
        }
      }
      
      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.MeshBasicMaterial({ 
        map: texture,
        transparent: true,
        side: THREE.DoubleSide
      });
      
      const geometry = new THREE.PlaneGeometry(1 * this.scaleFactor, 0.5 * this.scaleFactor);
      const textMesh = new THREE.Mesh(geometry, material);
      textMesh.position.y = 0.7 * this.scaleFactor; // 放在框架上方
      
      parent.add(textMesh);
    } catch (error) {
      console.warn('Failed to add tolerance text:', error);
    }
  }
  
  /**
   * 应用公差旋转
   */
  private applyToleranceRotation(
    group: THREE.Group, 
    xAxisDirection: import("../database/common").DwgPoint3D,
    extrusionDirection?: import("../database/common").DwgPoint3D
  ): void {
    try {
      // 创建方向向量
      const xAxis = new THREE.Vector3(xAxisDirection.x, xAxisDirection.y, xAxisDirection.z || 0);
      
      // 默认Z轴
      let zAxis = new THREE.Vector3(0, 0, 1);
      if (extrusionDirection) {
        zAxis = new THREE.Vector3(extrusionDirection.x, extrusionDirection.y, extrusionDirection.z || 0);
      }
      
      // 计算Y轴
      const yAxis = new THREE.Vector3();
      yAxis.crossVectors(zAxis, xAxis).normalize();
      
      // 重新计算Z轴以确保正交
      zAxis.crossVectors(xAxis, yAxis).normalize();
      
      // 创建变换矩阵
      const matrix = new THREE.Matrix4();
      matrix.makeBasis(xAxis.normalize(), yAxis, zAxis);
      
      // 应用变换
      group.setRotationFromMatrix(matrix);
    } catch (error) {
      console.warn('Failed to apply tolerance rotation:', error);
    }
  }
}