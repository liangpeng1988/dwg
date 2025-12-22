import * as THREE from 'three';
import { DwgSectionEntity } from '../database/entities/section';
import { BaseDrawer } from './BaseDrawer';
import { DwgEntity } from '../database';

/**
 * 剖面实体绘制器
 * 处理 DWG 中的 SECTION 实体
 */
export class SectionDrawer extends BaseDrawer<DwgSectionEntity> {
  /**
   * 检查实体类型是否匹配
   */
  canDraw(entity:DwgEntity): entity is DwgSectionEntity {
    return entity.type === 'SECTION';
  }

  /**
   * 绘制剖面实体
   */
  draw(entity: DwgSectionEntity): THREE.Object3D | null {
    try {
      const group = new THREE.Group();
      
      // 绘制剖面线
      if (entity.vertices && entity.vertices.length > 1) {
        const points: THREE.Vector3[] = [];
        for (const vertex of entity.vertices) {
          const point = this.scalePoint(vertex);
          points.push(new THREE.Vector3(point.x, point.y, point.z || 0));
        }
        
        // 创建剖面线
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const lineColor = this.getEntityColor(entity, 0x00FF00); // 默认绿色
        const lineMaterial = this.createLineMaterial(lineColor);
        const line = new THREE.Line(lineGeometry, lineMaterial);
        group.add(line);
        
        // 如果是闭合剖面，填充内部
        if (entity.vertices.length > 2) {
          // 检查是否闭合
          const first = entity.vertices[0];
          const last = entity.vertices[entity.vertices.length - 1];
          const isClosed = (
            Math.abs(first.x - last.x) < 0.001 &&
            Math.abs(first.y - last.y) < 0.001 &&
            Math.abs((first.z || 0) - (last.z || 0)) < 0.001
          );
          
          if (!isClosed) {
            points.push(points[0].clone());
          }
          
          try {
            // 创建填充形状
            const shape = new THREE.Shape();
            if (points.length > 0) {
              shape.moveTo(points[0].x, points[0].y);
              for (let i = 1; i < points.length; i++) {
                shape.lineTo(points[i].x, points[i].y);
              }
              shape.closePath();
              
              const shapeGeometry = new THREE.ShapeGeometry(shape);
              const fillColor = this.getEntityColor(entity, 0x00FF00);
              const fillMaterial = new THREE.MeshBasicMaterial({
                color: fillColor,
                transparent: true,
                opacity: 0.3,
                side: THREE.DoubleSide
              });
              
              const fillMesh = new THREE.Mesh(shapeGeometry, fillMaterial);
              group.add(fillMesh);
            }
          } catch (shapeError) {
            console.warn('Failed to create section fill shape:', shapeError);
          }
        }
      }
      
      // 绘制背面线（如果存在）
      if (entity.backLineVertices && entity.backLineVertices.length > 1) {
        const backPoints: THREE.Vector3[] = [];
        for (const vertex of entity.backLineVertices) {
          const point = this.scalePoint(vertex);
          backPoints.push(new THREE.Vector3(point.x, point.y, point.z || 0));
        }
        
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(backPoints);
        const lineColor = this.getEntityColor(entity, 0xFF0000);
        const lineMaterial = this.createLineMaterial(lineColor);
        const line = new THREE.Line(lineGeometry, lineMaterial);
        group.add(line);
      }
      
      // 添加名称标签
      if (entity.name) {
        this.addNameLabel(group, entity.name);
      }
      
      return group;
    } catch (error) {
      console.error('Error drawing section entity:', error);
      return null;
    }
  }
  
  /**
   * 添加名称标签到对象
   */
  private addNameLabelToObject(parent: THREE.Object3D, name: string): void {
    try {
      // 创建名称标签
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 32;
      
      const context = canvas.getContext('2d');
      if (context) {
        context.fillStyle = '#000000';
        context.fillRect(0, 0, 128, 32);
        
        context.fillStyle = '#FFFFFF';
        context.font = '12px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(name, 64, 16);
      }
      
      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.MeshBasicMaterial({ 
        map: texture,
        transparent: true,
        side: THREE.DoubleSide
      });
      
      const geometry = new THREE.PlaneGeometry(1 * this.scaleFactor, 0.25 * this.scaleFactor);
      const label = new THREE.Mesh(geometry, material);
      label.position.y = 1.2 * this.scaleFactor; // 放在剖面上方
      
      parent.add(label);
    } catch (error) {
      console.warn('Failed to add section name label:', error);
    }
  }
}