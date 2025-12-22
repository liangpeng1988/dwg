import * as THREE from 'three';
import { DwgEntity, DwgTextEntity, DwgMTextEntity } from '../database';
import { BaseDrawer } from './BaseDrawer';
import { DrawContext } from './types';
import { TextMesh } from './TextMesh';

/**
 * 基于 TextMesh 的文字绘制器
 * 使用 Three.js TextGeometry 渲染文字
 * 绘制 DwgTextEntity 和 DwgMTextEntity 类型的实体
 * Author: LP. <258049898@qq.com>
 */
export class TextMeshDrawer extends BaseDrawer<DwgTextEntity | DwgMTextEntity> {
  // TextMesh 实例
  private textMesh: TextMesh;
  
  constructor(context: DrawContext) {
    super(context);
    this.textMesh = new TextMesh(context.scaleFactor);
  }
  
  canDraw(entity: DwgEntity): entity is DwgTextEntity | DwgMTextEntity {
    return entity.type === 'TEXT' || entity.type === 'MTEXT';
  }

  draw(entity: DwgTextEntity | DwgMTextEntity): THREE.Object3D | null {
    if (entity.type === 'TEXT') {
      const result = this.drawText(entity as DwgTextEntity);
      return result;
    } else {
      const result = this.drawMText(entity as DwgMTextEntity);
      return result;
    }
  }

  /**
   * 绘制单行文字
   */
  private drawText(entity: DwgTextEntity): THREE.Object3D | null {
    // 检查文字是否为空
    if (!entity.text || !entity.text.trim()) {
      return null;
    }
    
    // 根据对齐方式选择使用 startPoint 或 endPoint
    const useEndPoint = (entity.halign !== 0 || entity.valign !== 0) && entity.endPoint;
    const basePoint = useEndPoint ? entity.endPoint : entity.startPoint;
    const position = this.scalePoint(basePoint as any);
    const color = this.getEntityColor(entity);
    const fontSize = entity.textHeight * this.scaleFactor
    // 添加Z轴偏移以避免Z-fighting导致的破面问题
    const offsetPosition = position.clone();
    offsetPosition.z += 0.1 * this.scaleFactor;
    
    const result = this.textMesh.create(
      entity.text, 
      offsetPosition, 
      fontSize, 
      color,
      entity.halign || 0,
      entity.valign || 0,
      entity.rotation || 0
    );
    return result;
  }

  /**
   * 绘制多行文字
   */
  private drawMText(entity: DwgMTextEntity): THREE.Object3D | null {
    if (!entity.text) {
      return null;
    }
    
    // 清理 MTEXT 格式代码
    const cleanLines = this.textMesh.extractMTextLines(entity.text);
    
    // 如果清理后没有文字，不创建
    if (cleanLines.length === 0) {
      return null;
    }
    
    const position = this.scalePoint(entity.insertionPoint);
    const color = this.getEntityColor(entity);
    const fontSize = entity.textHeight * this.scaleFactor;
    // 合并多行文字（TextMesh 的 TextGeometry 不支持多行，所以只取第一行或合并）
    const finalText = cleanLines.join(' ');
    
    // 检查最终文字是否为空
    if (!finalText.trim()) {
      return null;
    }
    
    // 将 attachmentPoint (1-9) 转换为 halign/valign
    const ap = entity.attachmentPoint || 1;
    const halign = ((ap - 1) % 3); // 0=left, 1=center, 2=right
    const valign = 3 - Math.floor((ap - 1) / 3); // 3=top, 2=middle, 1=bottom
    
    // 添加Z轴偏移以避免Z-fighting导致的破面问题
    const offsetPosition = position.clone();
    offsetPosition.z += 0.1 * this.scaleFactor;
    
    const result = this.textMesh.create(
      finalText, 
      offsetPosition, 
      fontSize, 
      color,
      halign,
      valign,
      entity.rotation || 0
    );
    result.userData = {
      type: 'TEXT',
      text: entity.text,
      height: entity.textHeight
    };
    return result;
  }
}