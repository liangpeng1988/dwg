import * as THREE from 'three';
import { DwgEntity, DwgInsertEntity, DwgPoint3D } from '../database';
import { BaseDrawer } from './BaseDrawer';
import { DrawContext, getEntityColor, createInsertTransformMatrix } from './types';

/**
 * 块实体绘制器接口
 * 用于 InsertDrawer 委托绘制块中的实体
 */
export interface EntityDrawerDelegate {
  /**
   * 创建实体的 Three.js 对象（不添加到场景）
   * 与 drawEntity 不同，此方法只创建对象，不将其添加到主场景
   * @param entity 实体数据
   * @param inheritedColor 继承颜色（BYBLOCK 时使用）
   */
  createEntityObject(entity: DwgEntity, inheritedColor?: number): THREE.Object3D | null;
}

/**
 * 块插入绘制器
 * 绘制 DwgInsertEntity 类型的实体
 */
export class InsertDrawer extends BaseDrawer<DwgInsertEntity> {
  /** 块定义映射 */
  private blocks: Map<string, DwgEntity[]>;
  /** 块基点映射 */
  private blockBasePoints: Map<string, DwgPoint3D> = new Map();
  /** 实体绘制代理 */
  private delegate?: EntityDrawerDelegate;

  constructor(context: DrawContext, blocks: Map<string, DwgEntity[]>, delegate?: EntityDrawerDelegate) {
    super(context);
    this.blocks = blocks;
    this.delegate = delegate;
  }

  /**
   * 设置实体绘制代理
   */
  setDelegate(delegate: EntityDrawerDelegate): void {
    this.delegate = delegate;
  }

  /**
   * 更新块定义
   */
  setBlocks(blocks: Map<string, DwgEntity[]>): void {
    this.blocks = blocks;
  }

  /**
   * 更新块基点
   */
  setBlockBasePoints(basePoints: Map<string, DwgPoint3D>): void {
    this.blockBasePoints = basePoints;
  }

  canDraw(entity: DwgEntity): entity is DwgInsertEntity {
    return entity.type === 'INSERT';
  }

  draw(entity: DwgInsertEntity): THREE.Object3D {
    // INSERT实体需要使用Group来正确处理变换（位置、旋转、缩放）
    const group = new THREE.Group();
    group.name = entity.name;    
    try {
      const blockName = entity.name;
      
      // 获取块定义中的实体 - 支持大小写不敏感匹配
      let blockEntities = this.blocks.get(blockName);
      let matchedBlockName = blockName;
      
      // 如果没找到，尝试大小写不敏感匹配
      if (!blockEntities) {
        const lowerName = blockName.toLowerCase();
        for (const [name, entities] of this.blocks.entries()) {
          if (name.toLowerCase() === lowerName) {
            blockEntities = entities;
            matchedBlockName = name;
            console.warn(`[InsertDrawer] Block found with case-insensitive match: "${blockName}" -> "${name}"`);
            break;
          }
        }
      }
      
      // 获取块基点 - 使用匹配到的块名
      let basePoint = this.blockBasePoints.get(matchedBlockName);
      
      // 如果没找到，尝试大小写不敏感匹配
      if (!basePoint) {
        const lowerName = blockName.toLowerCase();
        for (const [name, point] of this.blockBasePoints.entries()) {
          if (name.toLowerCase() === lowerName) {
            basePoint = point;
            console.warn(`[InsertDrawer] Block basePoint found with case-insensitive match: "${blockName}" -> "${name}"`);
            break;
          }
        }
      }
      
      // 计算当前块的变换矩阵（在绘制块内实体之前）
      const transformMatrix = createInsertTransformMatrix(
        entity.insertionPoint,
        basePoint,
        { x: entity.xScale || 1, y: entity.yScale || 1, z: entity.zScale || 1 },
        entity.rotation || 0,
        entity.extrusionDirection,
        this.scaleFactor
        // 注意：此处不再对 block 基点做偏移，DWG 中块内实体坐标已相对基点，
        // 直接以 insertionPoint 作为最终插入点，与 SVG 转换逻辑保持一致
      );
      
      // 如果有累积变换（嵌套块），组合变换：最终变换 = 累积变换（父块） × 当前块变换
      // 这样嵌套块的变换会正确累积
      let finalTransformMatrix: THREE.Matrix4;
      if (this.context.accumulatedTransform) {
        finalTransformMatrix = new THREE.Matrix4();
        finalTransformMatrix.multiplyMatrices(this.context.accumulatedTransform, transformMatrix);
      } else {
        finalTransformMatrix = transformMatrix;
      }
      
      // 保存之前的累积变换，并设置当前块的变换供嵌套 INSERT 使用
      const prevAccumulatedTransform = this.context.accumulatedTransform;
      this.context.accumulatedTransform = finalTransformMatrix;
      
      try {
        // 绘制块内实体（此时 context.accumulatedTransform 已设置，嵌套的 INSERT 会使用）
        if (blockEntities && blockEntities.length > 0) {
          // 绘制块中的每个实体，直接添加到 group
          this.drawBlockEntities(group, blockEntities, entity, basePoint);
        } else {
          // 如果找不到块定义，创建占位符
          const placeholder = this.createPlaceholder(blockName);
          group.add(placeholder);
        }
      } finally {
        // 恢复之前的累积变换
        this.context.accumulatedTransform = prevAccumulatedTransform;
      }
      
      // 应用变换矩阵到 group（在绘制完块内实体之后）
      group.applyMatrix4(finalTransformMatrix);
      
      // 处理行列阵列
      if ((entity.rowCount > 1 || entity.columnCount > 1) && 
          (entity.rowSpacing || entity.columnSpacing)) {
        return this.createArrayedInsert(entity, group);
      }
      
    } catch (error) {
      console.error('Error drawing insert:', entity.name, error);
    }
    
    return group;
  }

  /**
   * 绘制块中的实体
   * 参考 svg/svgConverter.ts 第 579-590 行的颜色处理方式
   * 注意：使用叠层计算方式，不单独处理基点偏移
   * 支持嵌套块的变换累积：如果块内包含 INSERT，会使用 context.accumulatedTransform
   */
  private drawBlockEntities(
    group: THREE.Object3D,
    blockEntities: DwgEntity[],
    parentEntity: DwgInsertEntity,
    _basePoint?: DwgPoint3D
  ): void {
    // 获取父块的颜色作为 BYBLOCK 继承颜色
    // 参考 svg/svgConverter.ts 第 584-590 行:
    // BYBLOCK 的实体将继承父块的颜色
    // 使用统一的实体取色方法，保持与其他绘制路径一致
    const inheritedColor = getEntityColor(parentEntity, this.context);
    
    // 注意：accumulatedTransform 已经在 draw() 方法中设置到 context
    // 嵌套的 INSERT 在 draw() 时会读取 context.accumulatedTransform
    // 所以这里不需要再次设置
    
    for (const blockEntity of blockEntities) {
      let instance: THREE.Object3D | null = null;
      
      if (this.delegate) {
        // 使用代理创建对象，传递继承颜色
        // accumulatedTransform 通过 context 传递，不需要额外参数
        instance = this.delegate.createEntityObject(blockEntity, inheritedColor);
      }
      
      if (instance) {
        group.add(instance);
      }
    }
  }
  /**
   * 创建阵列插入
   */
  private createArrayedInsert(entity: DwgInsertEntity, baseObject: THREE.Object3D): THREE.Object3D {
    const arrayObject = new THREE.Object3D();
    
    const rowCount = entity.rowCount || 1;
    const columnCount = entity.columnCount || 1;
    const rowSpacing = (entity.rowSpacing || 0) * this.scaleFactor;
    const columnSpacing = (entity.columnSpacing || 0) * this.scaleFactor;
    
    // 考虑 INSERT 的缩放影响间距
    const xScale = entity.xScale || 1;
    const yScale = entity.yScale || 1;
    
    for (let row = 0; row < rowCount; row++) {
      for (let col = 0; col < columnCount; col++) {
        if (row === 0 && col === 0) {
          // 第一个使用原始对象
          arrayObject.add(baseObject);
        } else {
          // 克隆其余的
          const clone = baseObject.clone();
          // 阵列间距也需要考虑缩放
          clone.position.x += col * columnSpacing * xScale;
          clone.position.y += row * rowSpacing * yScale;
          arrayObject.add(clone);
        }
      }
    }
    
    return arrayObject;
  }

  /**
   * 创建块占位符（当块定义未找到时）
   */
  private createPlaceholder(blockName: string): THREE.Object3D {
    const obj = new THREE.Object3D();
    
    // 创建一个小方框表示缺失的块
    const size = 2 * this.scaleFactor;
    const geometry = new THREE.BoxGeometry(size, size, size * 0.1);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0xff6600,
      wireframe: true 
    });
    const mesh = new THREE.Mesh(geometry, material);
    obj.add(mesh);
    
    // 添加一个 X 标记
    const xGeometry = new THREE.BufferGeometry();
    const halfSize = size * 0.4;
    const positions = new Float32Array([
      -halfSize, -halfSize, 0,
       halfSize,  halfSize, 0,
      -halfSize,  halfSize, 0,
       halfSize, -halfSize, 0
    ]);
    xGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const xMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
    const xLine = new THREE.LineSegments(xGeometry, xMaterial);
    obj.add(xLine);
    
    // 设置名称供调试
    obj.name = `MissingBlock_${blockName}`;
    
    return obj;
  }
}
