import * as THREE from 'three';
import { DwgEntity, DwgBlockRecordTableEntry, DwgPoint3D } from '../database';
import { DrawContext, createInsertTransformMatrix } from './types';
import { EntityDrawerDelegate } from './InsertDrawer';

/**
 * 块记录绘制器
 * 用于将 DwgBlockRecordTableEntry 直接绘制为 Three.js 对象
 */
export class BlockRecordDrawer {
  private context: DrawContext;
  private delegate?: EntityDrawerDelegate;

  constructor(context: DrawContext, delegate?: EntityDrawerDelegate) {
    this.context = context;
    this.delegate = delegate;
  }

  /**
   * 获取缩放因子
   */
  protected get scaleFactor(): number {
    return this.context.scaleFactor;
  }

  /**
   * 设置实体绘制代理
   */
  setDelegate(delegate: EntityDrawerDelegate): void {
    this.delegate = delegate;
  }

  /**
   * 检查是否可以绘制该块记录
   * @param blockRecord 块记录表项
   */
  canDraw(blockRecord: DwgBlockRecordTableEntry): boolean {
    // 过滤特殊块（模型空间和图纸空间）
    if (!blockRecord.name) {
      return false;
    }
    if (blockRecord.name.startsWith('*Model_Space') || 
        blockRecord.name.startsWith('*Paper_Space')) {
      return false;
    }
    // 必须有实体
    return blockRecord.entities && blockRecord.entities.length > 0;
  }

  /**
   * 绘制块记录
   * @param blockRecord 块记录表项
   * @param options 绘制选项
   * @returns Three.js Object3D 对象（不使用组）
   */
  draw(blockRecord: DwgBlockRecordTableEntry, options?: BlockRecordDrawOptions): THREE.Object3D {
    // 创建一个空的Object3D作为根对象
    const root = new THREE.Object3D();
    root.name = `BlockRecord_${blockRecord.name}`;

    if (!blockRecord.entities || blockRecord.entities.length === 0) {
      return root;
    }

    try {
      // 绘制块中的所有实体，直接添加到根对象
      this.drawBlockEntities(root, blockRecord.entities);

      // 应用可选的变换
      if (options) {
        this.applyTransformOptions(root, options);
      }

    } catch (error) {
      console.error(`Error drawing block record: ${blockRecord.name}`, error);
    }

    return root;
  }
  /**
   * 批量绘制多个块记录
   * @param blockRecords 块记录数组
   * @returns Map<块名称, Three.js Object3D>
   */
  drawMultiple(blockRecords: DwgBlockRecordTableEntry[]): Map<string, THREE.Object3D> {
    const result = new Map<string, THREE.Object3D>();

    for (const blockRecord of blockRecords) {
      if (this.canDraw(blockRecord)) {
        const obj = this.draw(blockRecord);
        result.set(blockRecord.name, obj);
      }
    }

    return result;
  }
  /**
   * 绘制块中的所有实体
   */
  private drawBlockEntities(root: THREE.Object3D, entities: DwgEntity[]): void {
    for (const entity of entities) {
      let instance: THREE.Object3D | null = null;

      if (this.delegate) {
        // 使用代理创建对象
        instance = this.delegate.createEntityObject(entity);
      }

      if (instance) {
        root.add(instance);
      }
    }
  }
  /**
   * 应用变换选项
   */
  private applyTransformOptions(root: THREE.Object3D, options: BlockRecordDrawOptions): void {
    // 使用与 InsertDrawer 相同的矩阵变换，确保基点、旋转、缩放顺序一致
    const position = options.position ?? { x: 0, y: 0, z: 0 };
    const scale =
      typeof options.scale === 'number'
        ? { x: options.scale, y: options.scale, z: options.scale }
        : {
            x: options.scale?.x ?? 1,
            y: options.scale?.y ?? 1,
            z: options.scale?.z ?? 1,
          };

    const transformMatrix = createInsertTransformMatrix(
      position,
      options.basePoint,
      scale,
      options.rotation ?? 0,
      undefined,
      this.scaleFactor
    );


    root.applyMatrix4(transformMatrix);
  }

  /**
   * 创建块记录的预览（缩略图）
   * @param blockRecord 块记录
   * @param size 预览大小
   * @returns Three.js Object3D
   */
  createPreview(blockRecord: DwgBlockRecordTableEntry, size: number = 100): THREE.Object3D {
    const obj = this.draw(blockRecord);
    
    // 计算边界盒并居中缩放
    const box = new THREE.Box3().setFromObject(obj);
    if (!box.isEmpty()) {
      const boxSize = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(boxSize.x, boxSize.y, boxSize.z);
      
      if (maxDim > 0) {
        const scale = size / maxDim;
        obj.scale.multiplyScalar(scale);
      }
      
      // 居中
      const center = box.getCenter(new THREE.Vector3());
      obj.position.sub(center);
    }
    
    return obj;
  }
}

/**
 * 块记录绘制选项
 */
export interface BlockRecordDrawOptions {
  /** 插入位置 */
  position?: { x: number; y: number; z?: number };
  /** 基点（用于保持与 INSERT 一致的旋转/平移中心） */
  basePoint?: DwgPoint3D;
  /** 缩放比例 */
  scale?: number | { x?: number; y?: number; z?: number };
  /** Z轴旋转角度（弧度） */
  rotation?: number;
}
