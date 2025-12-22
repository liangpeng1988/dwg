import * as THREE from 'three';
import { DwgEntity, DwgInsertEntity, DwgPoint3D } from '../database';
import { BaseDrawer } from './BaseDrawer';
import { DrawContext, getEntityColor, createInsertTransformMatrix } from './types';

/**
 * 块实体绘制器接口
 * 用于 EnhancedInsertDrawer 委托绘制块中的实体
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
 * 增强的块插入绘制器
 * 绘制 DwgInsertEntity 类型的实体，更好地处理父级位置和矩阵信息
 */
export class EnhancedInsertDrawer extends BaseDrawer<DwgInsertEntity> {
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

  draw(entity: DwgInsertEntity): THREE.Group {
    const group = new THREE.Group();
    
    try {
      const blockName = entity.name;
      
      // 获取块定义中的实体
      const blockEntities = this.blocks.get(blockName);
      
      // 获取块基点
      const basePoint = this.blockBasePoints.get(blockName);
      
      if (blockEntities && blockEntities.length > 0) {
        // 绘制块中的每个实体，直接添加到 group
        this.drawBlockEntities(group, blockEntities, entity, basePoint);
      } else {
        // 如果找不到块定义，创建占位符
        console.warn(`Block not found: ${blockName}`);
        const placeholder = this.createPlaceholder(blockName);
        group.add(placeholder);
      }
      
      // 使用矩阵变换应用所有变换（基点偏移 + 缩放 + 旋转 + OCS + 平移）
      const transformMatrix = createInsertTransformMatrix(
        entity.insertionPoint,
        basePoint,
        { x: entity.xScale || 1, y: entity.yScale || 1, z: entity.zScale || 1 },
        entity.rotation || 0,
        entity.extrusionDirection,
        this.scaleFactor
      );
      
      // 应用变换矩阵到 group
      group.applyMatrix4(transformMatrix);
      
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
   */
  private drawBlockEntities(
    group: THREE.Group,
    blockEntities: DwgEntity[],
    parentEntity: DwgInsertEntity,
    basePoint?: DwgPoint3D
  ): void {
    // 获取父块的颜色作为 BYBLOCK 继承颜色
    // BYBLOCK 的实体将继承父块的颜色
    const inheritedColor = getEntityColor(parentEntity, this.context);
    
    for (const blockEntity of blockEntities) {
      let instance: THREE.Object3D | null = null;
      
      if (this.delegate) {
        // 使用代理创建对象，传递继承颜色
        instance = this.delegate.createEntityObject(blockEntity, inheritedColor);
      }
      
      if (instance) {
        // 应用实体级别的变换
        this.applyEntityTransform(instance, blockEntity, parentEntity);
        group.add(instance);
      }
    }
  }
  
  /**
   * 创建阵列插入
   */
  private createArrayedInsert(entity: DwgInsertEntity, baseGroup: THREE.Group): THREE.Group {
    const arrayGroup = new THREE.Group();
    
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
          // 第一个使用原始组
          arrayGroup.add(baseGroup);
        } else {
          // 克隆其余的
          const clone = baseGroup.clone();
          // 阵列间距也需要考虑缩放
          clone.position.x += col * columnSpacing * xScale;
          clone.position.y += row * rowSpacing * yScale;
          arrayGroup.add(clone);
        }
      }
    }
    
    return arrayGroup;
  }

  /**
   * 创建块占位符（当块定义未找到时）
   */
  private createPlaceholder(blockName: string): THREE.Group {
    const group = new THREE.Group();
    
    // 创建一个小方框表示缺失的块
    const size = 2 * this.scaleFactor;
    const geometry = new THREE.BoxGeometry(size, size, size * 0.1);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0xff6600,
      wireframe: true 
    });
    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);
    
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
    group.add(xLine);
    
    // 设置名称供调试
    group.name = `MissingBlock_${blockName}`;
    
    return group;
  }

  /**
   * 应用实体变换
   * @param instance 实体对象
   * @param _entity 实体数据（预留参数，用于未来扩展）
   * @param _parentEntity 父级实体（预留参数，用于未来扩展）
   */
  private applyEntityTransform(
    instance: THREE.Object3D,
    _entity: DwgEntity,
    _parentEntity: DwgInsertEntity
  ): void {
    // 目前这是一个简化的实现
    // 在实际应用中，可以根据实体类型和属性应用特定的变换
    
    // 对于具有位置信息的实体，可能需要应用相对于父级的偏移
    // 这里我们暂时保持原样，但在未来可以扩展
    
    // 更新实体的世界矩阵以确保变换正确应用
    instance.updateMatrixWorld(true);
  }

  /**
   * 应用父级变换矩阵到子对象（预留方法，用于未来扩展）
   * @param child 子对象
   * @param parentMatrix 父级变换矩阵
   */
  // @ts-expect-error - Reserved for future use
  private _applyParentMatrix(child: THREE.Object3D, parentMatrix: THREE.Matrix4): void {
    // 获取子对象的世界矩阵
    child.updateMatrixWorld();
    
    // 应用父级矩阵
    const worldMatrix = new THREE.Matrix4();
    worldMatrix.multiplyMatrices(parentMatrix, child.matrixWorld);
    
    // 分解矩阵到位置、旋转和缩放
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    worldMatrix.decompose(position, quaternion, scale);
    
    // 应用到子对象
    child.position.copy(position);
    child.quaternion.copy(quaternion);
    child.scale.copy(scale);
  }
}