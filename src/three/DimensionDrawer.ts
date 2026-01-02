import * as THREE from 'three';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';
import { BaseDrawer } from './BaseDrawer';
import { DwgEntity } from '../database';
import { getColorFromIndex, getEntityColor } from './types';
import { TextMesh } from './TextMesh';
import type { DrawContext } from './types';

/**
 * DIMENSION 实体绘制器
 * 专门处理标注实体的绘制
 * Author: LP. <258049898@qq.com>
 */
export class DimensionDrawer extends BaseDrawer<DwgEntity> {
  // 存储块定义的引用
  private blocks: Map<string, DwgEntity[]>;
  // 存储实体创建回调函数
  private entityCreator: (entity: DwgEntity, inheritedColor?: number) => THREE.Object3D | null;
  // 文字渲染器（用于统一处理标注文字）
  private textMesh: TextMesh;
  
  constructor(drawContext: DrawContext, blocks: Map<string, DwgEntity[]>, entityCreator: (entity: DwgEntity, inheritedColor?: number) => THREE.Object3D | null) {
    super(drawContext);
    this.blocks = blocks;
    this.entityCreator = entityCreator;
    // 初始化文字渲染器（用于统一处理标注文字）
    this.textMesh = new TextMesh(drawContext.scaleFactor);
  }
  
  /**
   * 绘制标注实体
   * @param entity 标注实体
   * @returns THREE.Group
   */
  draw(entity: DwgEntity): THREE.Group {
    const group = new THREE.Group();
    
    try {
      // 优先使用 DIMENSION 关联的块来绘制（与 SVG 转换器一致）
      const blockName = (entity as any).name;
      if (blockName && this.blocks.has(blockName)) {
        const blockEntities = this.blocks.get(blockName);
        if (blockEntities && blockEntities.length > 0) {
          // 获取标注实体的颜色作为 BYBLOCK 继承色（使用统一实体取色逻辑）
          const inheritedColor = getEntityColor(entity, this.context);
          
          // 绘制块中的所有实体，传递继承颜色
          for (const blockEntity of blockEntities) {
            const obj = this.createEntityObject(blockEntity, inheritedColor);
            if (obj) {
              group.add(obj);
            }
          }
          
          // 应用 extrusionDirection
          if ((entity as any).extrusionDirection && (entity as any).extrusionDirection.z === -1) {
            group.scale.x *= -1;
          }
          
          return group;
        }
      }
      
      // 回退方案：手动绘制标注
      this.drawDimensionFallback(group, entity);
    } catch (error) {
      console.error('Error drawing dimension:', error);
    }
    
    return group;
  }

  canDraw(entity: DwgEntity): entity is DwgEntity {
    return entity.type === 'DIMENSION';
  }

  /**
   * 创建实体对象的辅助方法
   * @param entity 实体数据
   * @param inheritedColor BYBLOCK 继承颜色
   */
  private createEntityObject(entity: DwgEntity, inheritedColor?: number): THREE.Object3D | null {
    // 使用传入的实体创建函数来创建实体对象，传递继承颜色
    if (this.entityCreator) {
      return this.entityCreator(entity, inheritedColor);
    }
    return null;
  }

  /**
   * 回退绘制标注（当块不可用时）
   */
  private drawDimensionFallback(group: THREE.Group, entity: any): void {
    // 获取标注样式
    const dimStyle = entity.styleName ? this.context.dimStyles?.get(entity.styleName) : undefined;
    
    // 获取实体颜色作为默认色
    const entityColor = this.getEntityColor(entity);
    
    // 标注参数（从 DIMSTYLE 获取，如果没有则使用默认值）
    const dimScale = dimStyle?.DIMSCALE || 1;
    const dimArrowSize = (dimStyle?.DIMASZ || 2.5) * dimScale * this.scaleFactor;
    const dimExtOffset = (dimStyle?.DIMEXO || 0.625) * dimScale * this.scaleFactor;
    const dimExtExtend = (dimStyle?.DIMEXE || 1.25) * dimScale * this.scaleFactor;
    // 文字高度：限制合理范围避免过大
    const rawTextHeight = (dimStyle?.DIMTXT || 2.5) * dimScale * this.scaleFactor;
    const dimTextHeight = Math.min(Math.max(rawTextHeight, 0.1 * this.scaleFactor), 0.5 * this.scaleFactor);
    const dimLineColor = this.getDimColor(dimStyle?.DIMCLRD, entityColor);
    const dimExtColor = this.getDimColor(dimStyle?.DIMCLRE, entityColor);
    const dimTextColor = this.getDimColor(dimStyle?.DIMCLRT, entityColor);
    
    // 获取标注类型（低 3 位）
    const dimType = (entity.dimensionType || 0) & 0x07;
    
    // 根据标注类型绘制
    switch (dimType) {
      case 0: // Rotated / Horizontal / Vertical
      case 1: // Aligned
        this.drawLinearDimension(group, entity, dimLineColor, dimExtColor, dimArrowSize, dimExtOffset, dimExtExtend);
        break;
      case 2: // Angular (2-line)
      case 5: // Angular (3-point)
        this.drawAngularDimension(group, entity, dimLineColor, dimArrowSize);
        break;
      case 3: // Diameter
      case 4: // Radius
        this.drawRadialDimension(group, entity, dimLineColor, dimArrowSize, dimType === 3);
        break;
      case 6: // Ordinate
        this.drawOrdinateDimension(group, entity, dimLineColor);
        break;
    }
    
    // 绘制标注文字
    const textValue = entity.text || (entity.measurement != null ? entity.measurement.toFixed(2) : '');
    if (textValue && entity.textPoint) {
      const textMesh = this.createDimensionText(
        textValue, 
        entity.textPoint, 
        dimTextHeight, 
        dimTextColor,
        entity.textRotation
      );
      if (textMesh) {
        group.add(textMesh);
      }
    }
    
    // 应用 extrusionDirection
    if (entity.extrusionDirection && entity.extrusionDirection.z === -1) {
      group.scale.x *= -1;
    }
  }

  /**
   * 创建带线宽的线条（使用 MeshLine）
   * @param points 点数组
   * @param color 颜色
   * @param lineWidth 线宽（默认 1）
   */
  private createMeshLine(points: THREE.Vector3[], color: number, lineWidth: number = 1): THREE.Mesh {
    const geometry = new MeshLineGeometry();
    geometry.setPoints(points);
    
    const material = new MeshLineMaterial({
      color: new THREE.Color(color),
      lineWidth: lineWidth,
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
    });
    
    return new THREE.Mesh(geometry, material);
  }

  /**
   * 绘制线性/对齐标注
   */
  private drawLinearDimension(
    group: THREE.Group,
    entity: any,
    lineColor: number,
    extColor: number,
    arrowSize: number,
    extOffset: number,
    extExtend: number
  ): void {
    const defPoint = entity.definitionPoint;
    const subDefPoint1 = (entity as any).subDefinitionPoint1;
    const subDefPoint2 = (entity as any).subDefinitionPoint2;
    
    if (!defPoint || !subDefPoint1 || !subDefPoint2) {
      // 回退到简单绘制
      this.drawSimpleDimensionLine(group, entity, lineColor, arrowSize);
      return;
    }
    
    // 转换点坐标
    const p1 = new THREE.Vector3(
      subDefPoint1.x * this.scaleFactor,
      subDefPoint1.y * this.scaleFactor,
      (subDefPoint1.z || 0) * this.scaleFactor
    );
    const p2 = new THREE.Vector3(
      subDefPoint2.x * this.scaleFactor,
      subDefPoint2.y * this.scaleFactor,
      (subDefPoint2.z || 0) * this.scaleFactor
    );
    const dimLinePoint = new THREE.Vector3(
      defPoint.x * this.scaleFactor,
      defPoint.y * this.scaleFactor,
      (defPoint.z || 0) * this.scaleFactor
    );
    
    // 计算标注线的位置（投影到标注线高度）
    // 对于旋转标注，标注线与旋转角度相关
    const rotationAngle = (entity as any).rotationAngle || 0;
    
    // 计算标注线方向
    let dimDir: THREE.Vector3;
    if (Math.abs(rotationAngle) < 1e-6) {
      // 水平标注
      dimDir = new THREE.Vector3(1, 0, 0);
    } else if (Math.abs(rotationAngle - Math.PI / 2) < 1e-6) {
      // 垂直标注
      dimDir = new THREE.Vector3(0, 1, 0);
    } else {
      // 对齐标注
      dimDir = new THREE.Vector3().subVectors(p2, p1).normalize();
    }
    
    // 扩展线方向（垂直于标注线）
    const extDir = new THREE.Vector3(-dimDir.y, dimDir.x, 0);
    
    // 计算标注线端点
    const d1 = p1.clone().add(extDir.clone().multiplyScalar(
      dimLinePoint.clone().sub(p1).dot(extDir)
    ));
    const d2 = p2.clone().add(extDir.clone().multiplyScalar(
      dimLinePoint.clone().sub(p2).dot(extDir)
    ));
    
    // 绘制标注线（使用 MeshLine）
    group.add(this.createMeshLine([d1, d2], lineColor));
    
    // 绘制第一条扩展线
    const ext1Start = p1.clone().add(extDir.clone().multiplyScalar(extOffset * Math.sign(d1.clone().sub(p1).dot(extDir) || 1)));
    const ext1End = d1.clone().add(extDir.clone().multiplyScalar(extExtend * Math.sign(d1.clone().sub(p1).dot(extDir) || 1)));
    group.add(this.createMeshLine([ext1Start, ext1End], extColor));
    
    // 绘制第二条扩展线
    const ext2Start = p2.clone().add(extDir.clone().multiplyScalar(extOffset * Math.sign(d2.clone().sub(p2).dot(extDir) || 1)));
    const ext2End = d2.clone().add(extDir.clone().multiplyScalar(extExtend * Math.sign(d2.clone().sub(p2).dot(extDir) || 1)));
    group.add(this.createMeshLine([ext2Start, ext2End], extColor));
    
    // 绘制箭头
    group.add(this.createArrowHead(d1, dimDir.clone().negate(), arrowSize, lineColor));
    group.add(this.createArrowHead(d2, dimDir, arrowSize, lineColor));
  }

  /**
   * 绘制简单标注线（回退方案）
   */
  private drawSimpleDimensionLine(
    group: THREE.Group,
    entity: any,
    lineColor: number,
    arrowSize: number
  ): void {
    const defPoint = entity.definitionPoint;
    const textPoint = entity.textPoint;
    
    if (!defPoint) return;
    
    const start = new THREE.Vector3(
      defPoint.x * this.scaleFactor,
      defPoint.y * this.scaleFactor,
      (defPoint.z || 0) * this.scaleFactor
    );
    
    const end = textPoint ? new THREE.Vector3(
      textPoint.x * this.scaleFactor,
      textPoint.y * this.scaleFactor,
      0
    ) : start.clone().add(new THREE.Vector3(10 * this.scaleFactor, 0, 0));
    
    // 使用 MeshLine 绘制
    group.add(this.createMeshLine([start, end], lineColor));
  }

  /**
   * 绘制角度标注
   */
  private drawAngularDimension(
    group: THREE.Group,
    entity: any,
    lineColor: number,
    arrowSize: number
  ): void {
    const subDefPoint1 = (entity as any).subDefinitionPoint1;
    const subDefPoint2 = (entity as any).subDefinitionPoint2;
    const centerPoint = (entity as any).centerPoint;
    const arcPoint = (entity as any).arcPoint;
    
    if (!centerPoint) {
      this.drawSimpleDimensionLine(group, entity, lineColor, arrowSize);
      return;
    }
    
    const center = new THREE.Vector3(
      centerPoint.x * this.scaleFactor,
      centerPoint.y * this.scaleFactor,
      (centerPoint.z || 0) * this.scaleFactor
    );
    
    // 计算弧的半径
    let radius = 5 * this.scaleFactor;
    if (arcPoint) {
      const arc = new THREE.Vector3(
        arcPoint.x * this.scaleFactor,
        arcPoint.y * this.scaleFactor,
        (arcPoint.z || 0) * this.scaleFactor
      );
      radius = center.distanceTo(arc);
    }
    
    // 计算起始和结束角度
    let startAngle = 0;
    let endAngle = Math.PI / 2;
    
    if (subDefPoint1 && subDefPoint2) {
      const p1 = new THREE.Vector3(
        subDefPoint1.x * this.scaleFactor,
        subDefPoint1.y * this.scaleFactor,
        0
      );
      const p2 = new THREE.Vector3(
        subDefPoint2.x * this.scaleFactor,
        subDefPoint2.y * this.scaleFactor,
        0
      );
      startAngle = Math.atan2(p1.y - center.y, p1.x - center.x);
      endAngle = Math.atan2(p2.y - center.y, p2.x - center.x);
    }
    
    // 绘制弧线
    const arcCurve = new THREE.ArcCurve(center.x, center.y, radius, startAngle, endAngle, false);
    const arcPoints = arcCurve.getPoints(32);
    const arcPoints3D = arcPoints.map(p => new THREE.Vector3(p.x, p.y, center.z));
    
    // 使用 MeshLine 绘制弧线
    group.add(this.createMeshLine(arcPoints3D, lineColor));
    
    // 绘制箭头
    if (arcPoints3D.length >= 2) {
      const startDir = new THREE.Vector3().subVectors(arcPoints3D[1], arcPoints3D[0]).normalize();
      const endDir = new THREE.Vector3().subVectors(arcPoints3D[arcPoints3D.length - 1], arcPoints3D[arcPoints3D.length - 2]).normalize();
      group.add(this.createArrowHead(arcPoints3D[0], startDir.negate(), arrowSize, lineColor));
      group.add(this.createArrowHead(arcPoints3D[arcPoints3D.length - 1], endDir, arrowSize, lineColor));
    }
  }

  /**
   * 绘制半径/直径标注
   */
  private drawRadialDimension(
    group: THREE.Group,
    entity: any,
    lineColor: number,
    arrowSize: number,
    isDiameter: boolean
  ): void {
    const centerPoint = (entity as any).centerPoint;
    const defPoint = entity.definitionPoint;
    
    if (!centerPoint || !defPoint) {
      this.drawSimpleDimensionLine(group, entity, lineColor, arrowSize);
      return;
    }
    
    const center = new THREE.Vector3(
      centerPoint.x * this.scaleFactor,
      centerPoint.y * this.scaleFactor,
      (centerPoint.z || 0) * this.scaleFactor
    );
    const def = new THREE.Vector3(
      defPoint.x * this.scaleFactor,
      defPoint.y * this.scaleFactor,
      (defPoint.z || 0) * this.scaleFactor
    );
    
    // 绘制从圆心到定义点的线（使用 MeshLine）
    group.add(this.createMeshLine([center, def], lineColor));
    
    // 如果是直径标注，绘制对侧的线
    if (isDiameter) {
      const opposite = center.clone().add(center.clone().sub(def));
      group.add(this.createMeshLine([center, opposite], lineColor));
      
      // 绘制对侧箭头
      const dir2 = new THREE.Vector3().subVectors(opposite, center).normalize();
      group.add(this.createArrowHead(opposite, dir2, arrowSize, lineColor));
    }
    
    // 绘制箭头
    const direction = new THREE.Vector3().subVectors(def, center).normalize();
    group.add(this.createArrowHead(def, direction, arrowSize, lineColor));
  }

  /**
   * 绘制坐标标注
   */
  private drawOrdinateDimension(
    group: THREE.Group,
    entity: any,
    lineColor: number
  ): void {
    const subDefPoint1 = (entity as any).subDefinitionPoint1;
    const subDefPoint2 = (entity as any).subDefinitionPoint2;
    
    if (!subDefPoint1 || !subDefPoint2) {
      return;
    }
    
    const p1 = new THREE.Vector3(
      subDefPoint1.x * this.scaleFactor,
      subDefPoint1.y * this.scaleFactor,
      (subDefPoint1.z || 0) * this.scaleFactor
    );
    const p2 = new THREE.Vector3(
      subDefPoint2.x * this.scaleFactor,
      subDefPoint2.y * this.scaleFactor,
      (subDefPoint2.z || 0) * this.scaleFactor
    );
    
    // 绘制引线（折线）
    const isXType = !!((entity.dimensionType || 0) & 64);
    let midPoint: THREE.Vector3;
    
    if (isXType) {
      midPoint = new THREE.Vector3(p1.x, p2.y, p1.z);
    } else {
      midPoint = new THREE.Vector3(p2.x, p1.y, p1.z);
    }
    
    // 使用 MeshLine 绘制折线
    group.add(this.createMeshLine([p1, midPoint, p2], lineColor));
  }

  /**
   * 获取标注颜色
   * @param colorValue DIMSTYLE 中的颜色值
   * @param defaultColor 默认颜色（实体颜色）
   */
  private getDimColor(colorValue?: number, defaultColor: number = 0x000000): number {
    // BYBLOCK (0) 或未定义 - 使用实体颜色
    if (colorValue == null || colorValue === 0) {
      return defaultColor;
    }
    // BYLAYER (256) - 使用实体颜色
    if (colorValue === 256) {
      return defaultColor;
    }
    // ACI 颜色索引
    if (colorValue > 0 && colorValue < 256) {
      return getColorFromIndex(colorValue);
    }
    return defaultColor;
  }

  /**
   * 创建箭头
   */
  private createArrowHead(
    position: THREE.Vector3,
    direction: THREE.Vector3,
    size: number,
    color: number
  ): THREE.Mesh {
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, 0);
    arrowShape.lineTo(-size, size * 0.3);
    arrowShape.lineTo(-size * 0.8, 0);
    arrowShape.lineTo(-size, -size * 0.3);
    arrowShape.lineTo(0, 0);

    const geometry = new THREE.ShapeGeometry(arrowShape);
    const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    const arrow = new THREE.Mesh(geometry, material);

    arrow.position.copy(position);
    const angle = Math.atan2(direction.y, direction.x);
    arrow.rotation.z = angle;

    return arrow;
  }

  /**
   * 创建标注文字
   * 使用 TextMesh 统一处理文字绘制
   */
  private createDimensionText(
    text: string,
    position: { x: number; y: number },
    height: number,
    color: number,
    rotation?: number
  ): THREE.Mesh | null {
    try {
      // 使用 TextMesh 来创建文字网格
      const pos = new THREE.Vector3(
        position.x * this.scaleFactor,
        position.y * this.scaleFactor,
        0
      );
      
      const mesh = this.textMesh.create(
        text,
        pos,
        height,
        color,
        1, // 水平对齐: 居中
        2, // 垂直对齐: 中间
        rotation || 0
      );
      
      return mesh;
    } catch (error) {
      console.error('Error creating dimension text:', error);
      return null;
    }
  }
}