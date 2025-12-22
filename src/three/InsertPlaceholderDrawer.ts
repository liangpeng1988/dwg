import * as THREE from 'three';
import { BaseDrawer } from './BaseDrawer';
import { DwgEntity } from '../database';
import type { DrawContext } from './types';

/**
 * 插入块占位符绘制器
 * 专门处理当块定义不可用时创建占位符显示
 */
export class InsertPlaceholderDrawer extends BaseDrawer<DwgEntity> {
  constructor(drawContext: DrawContext) {
    super(drawContext);
  }

  /**
   * 创建插入块的占位符
   * @param position 占位符位置
   * @param blockName 块名称
   * @param scaleFactor 缩放因子
   * @returns THREE.Group 占位符对象组
   */
  create(position: THREE.Vector3, blockName: string, scaleFactor: number): THREE.Group {
    const group = new THREE.Group();
    
    const width = 2 * scaleFactor;
    const height = 1 * scaleFactor;
    const shape = new THREE.Shape();
    shape.moveTo(-width/2, -height/2);
    shape.lineTo(width/2, -height/2);
    shape.lineTo(width/2, height/2);
    shape.lineTo(-width/2, height/2);
    shape.lineTo(-width/2, -height/2);

    const geometry = new THREE.ShapeGeometry(shape);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0xff0000,
      wireframe: true 
    });
    const frame = new THREE.Mesh(geometry, material);
    group.add(frame);

    // 注意：这里我们不能直接使用 TextMesh.createSimple，
    // 因为它需要实例化。在实际使用中，应该通过依赖注入传递 TextMesh 实例
    // 或者在这个类中接收一个文本创建函数作为参数
    
    group.position.copy(position);
    return group;
  }

  /**
   * 检查是否可以绘制指定实体（此方法主要用于保持接口一致性）
   * @param entity 实体对象
   * @returns boolean 是否可以绘制
   */
  canDraw(entity: DwgEntity): entity is DwgEntity {
    // 这个绘制器不是用来直接绘制实体的，而是作为一个工具类使用
    return false;
  }

  /**
   * 绘制实体（此方法主要用于保持接口一致性）
   * @param entity 实体对象
   * @returns THREE.Object3D | null 绘制的对象
   */
  draw(entity: DwgEntity): THREE.Object3D | null {
    // 这个绘制器不是用来直接绘制实体的，而是作为一个工具类使用
    return null;
  }
}