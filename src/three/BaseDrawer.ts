import * as THREE from 'three';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';
import { DwgEntity } from '../database';
import { DrawContext, scalePoint, scalePointForPlane, applyExtrusionDirection, createLineMaterial, createMeshMaterial, getEntityColor, createLineMaterialFromLineType, getLineWidth } from './types';

/**
 * 绘制器基类
 * 所有实体绘制器都应继承此类
 */
export abstract class BaseDrawer<T extends DwgEntity = DwgEntity> {
  protected context: DrawContext;
  // 单色模式控制
  private static monochromeModeEnabled: boolean = false;
  private static monochromeColor: number = 0x000000; // 默认黑色
  // 绘制平面控制
  // private static useXZPlane: boolean = false;

  constructor(context: DrawContext) {
    this.context = context;
  }

  /**
   * 设置全局单色模式
   * @param enabled 是否启用单色模式
   * @param color 单色颜色值（0x000000=黑色, 0xFFFFFF=白色）
   */
  public static setGlobalMonochromeMode(enabled: boolean, color: number = 0x000000): void {
    BaseDrawer.monochromeModeEnabled = enabled;
    // 确保颜色值是黑色或白色
    BaseDrawer.monochromeColor = (color === 0xFFFFFF) ? 0xFFFFFF : 0x000000;
    console.log(`Global monochrome mode ${enabled ? 'enabled' : 'disabled'} with color ${color === 0xFFFFFF ? 'white' : 'black'}`);
  }

  /**
   * 获取当前全局单色模式设置
   * @returns { enabled: boolean, color: number }
   */
  public static getGlobalMonochromeMode(): { enabled: boolean, color: number } {
    return {
      enabled: BaseDrawer.monochromeModeEnabled,
      color: BaseDrawer.monochromeColor
    };
  }

  /**
   * 快速设置黑色单色模式
   * @param enabled 是否启用黑色单色模式
   */
  public static setBlackMonochrome(enabled: boolean): void {
    BaseDrawer.setGlobalMonochromeMode(enabled, 0x000000);
  }

  /**
   * 快速设置白色单色模式
   * @param enabled 是否启用白色单色模式
   */
  public static setWhiteMonochrome(enabled: boolean): void {
    BaseDrawer.setGlobalMonochromeMode(enabled, 0xFFFFFF);
  }

  /**
   * 示例用法：
   * // 启用黑色单色模式
   * BaseDrawer.setBlackMonochrome(true);
   * 
   * // 启用白色单色模式
   * BaseDrawer.setWhiteMonochrome(true);
   * 
   * // 关闭单色模式，使用DWG颜色
   * BaseDrawer.setGlobalMonochromeMode(false);
   */

  /**
   * 获取缩放因子
   */
  protected get scaleFactor(): number {
    return this.context.scaleFactor;
  }

  /**
   * 绘制实体
   * @param entity 实体数据
   * @returns Three.js 对象
   */
  abstract draw(entity: T): THREE.Object3D | null;

  /**
   * 检查实体类型是否匹配
   * @param entity 实体数据
   */
  abstract canDraw(entity: DwgEntity): entity is T;

  /**
   * 缩放点坐标的便捷方法
   */
  protected scalePoint(point: { x: number; y: number; z?: number } | undefined): THREE.Vector3 {
    return scalePoint(point as any, this.scaleFactor);
  }

  /**
   * 根据绘制平面缩放点坐标的便捷方法（仅支持XY平面）
   */
  protected scalePointForPlane(point: { x: number; y: number; z?: number } | undefined): THREE.Vector3 {
    return scalePointForPlane(point as any, this.scaleFactor);
  }

  /**
   * 设置全局绘制平面
   * @param useXZPlane 是否使用XZ平面
   */
  public static setGlobalDrawingPlane(useXZPlane: boolean): void {
    // BaseDrawer.useXZPlane = false; // 固定为XY平面
    console.log(`Global drawing plane set to XY (XZ plane disabled)`);
  }

  /**
   * 获取当前全局绘制平面设置
   * @returns 是否使用XZ平面
   */
  public static getGlobalDrawingPlane(): boolean {
    return false; // 固定返回false，表示使用XY平面
  }

  /**
   * 应用 extrusionDirection 变换
   */
  protected applyExtrusionDirection(object: THREE.Object3D, extrusionDirection?: { x: number; y: number; z: number }): void {
    applyExtrusionDirection(object, extrusionDirection);
  }

  /**
   * 创建线条材质
   */
  protected createLineMaterial(color?: number): THREE.LineBasicMaterial {
    return createLineMaterial(color);
  }

  /**
   * 创建网格材质
   */
  protected createMeshMaterial(color?: number): THREE.MeshBasicMaterial {
    return createMeshMaterial(color);
  }

  /**
   * 创建从点数组生成的线条
   */
  protected createLineFromPoints(points: THREE.Vector3[], color?: number): THREE.Line {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = this.createLineMaterial(color);
    return new THREE.Line(geometry, material);
  }

  /**
   * 创建闭合的线条
   */
  protected createLineLoopFromPoints(points: THREE.Vector3[], color?: number): THREE.LineLoop {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = this.createLineMaterial(color);
    return new THREE.LineLoop(geometry, material);
  }
  
  /**
   * 为实体创建线条（支持虚线）
   * @param entity 实体
   * @param points 点数组
   * @returns Line 对象（如果是虚线需要调用 computeLineDistances）
   */
  protected createLineForEntity(entity: DwgEntity, points: THREE.Vector3[]): THREE.Line {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const color = this.getEntityColor(entity);
    const material = createLineMaterialFromLineType(
      color,
      entity.lineType,
      entity.lineTypeScale || 1,
      this.context.lineTypes
    );
    const line = new THREE.Line(geometry, material);
    
    // 如果是虚线材质，需要计算线段距离
    if (material instanceof THREE.LineDashedMaterial) {
      line.computeLineDistances();
    }
    
    return line;
  }

  /**
   * 为实体创建闭合线条（支持虚线）
   */
  protected createLineLoopForEntity(entity: DwgEntity, points: THREE.Vector3[]): THREE.LineLoop {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const color = this.getEntityColor(entity);
    const material = createLineMaterialFromLineType(
      color,
      entity.lineType,
      entity.lineTypeScale || 1,
      this.context.lineTypes
    );
    const line = new THREE.LineLoop(geometry, material);
    
    // 如果是虚线材质，需要计算线段距离
    if (material instanceof THREE.LineDashedMaterial) {
      line.computeLineDistances();
    }
    
    return line;
  }
  
  /**
   * 获取实体的颜色
   * 优先使用 color (RGB)，其次使用 colorIndex (ACI)，最后尝试图层颜色
   * 支持 BYBLOCK 颜色继承
   * 支持背景色感知，参考 svg/svgConverter.ts 的颜色处理方式
   * 支持全局单色模式
   */
  protected getEntityColor(entity: DwgEntity, defaultColor: number = 0xffffff): number {
    // 如果启用了全局单色模式，直接返回单色值
    if (BaseDrawer.monochromeModeEnabled) {
      return BaseDrawer.monochromeColor;
    }
    
    // 否则使用原来的颜色获取逻辑
    return getEntityColor(entity, this.context, defaultColor);
  }

  
  /**
   * 获取实体的线宽
   */
  protected getEntityLineWidth(entity: DwgEntity): number {
    return getLineWidth(entity);
  }
  
  /**
   * 为实体创建线条材质（支持线宽）
   */
  protected createLineMaterialForEntity(entity: DwgEntity): THREE.LineBasicMaterial {
    const color = this.getEntityColor(entity);
    const linewidth = this.getEntityLineWidth(entity);
    return new THREE.LineBasicMaterial({ color, linewidth });
  }
  
  /**
   * 为实体创建网格材质
   */
  protected createMeshMaterialForEntity(entity: DwgEntity): THREE.MeshBasicMaterial {
    const color = this.getEntityColor(entity, 0x888888);
    return this.createMeshMaterial(color);
  }
  
  /**
   * 使用 MeshLine 创建带线宽的线条
   * MeshLine 可以在所有浏览器中正确显示线宽
   * @param points 点数组
   * @param color 颜色
   * @param lineWidth 线宽
   * @param resolution 分辨率（用于计算线宽比例）
   * @returns THREE.Mesh
   */
  protected createMeshLineFromPoints(
    points: THREE.Vector3[],
    color: number,
    lineWidth: number = 1,
    resolution?: THREE.Vector2
  ): THREE.Mesh {
    // 创建 MeshLineGeometry
    const geometry = new MeshLineGeometry();
    geometry.setPoints(points);
    
    // 创建 MeshLineMaterial
    const material = new MeshLineMaterial({
      color: new THREE.Color(color),
      lineWidth: lineWidth,
      resolution: resolution || new THREE.Vector2(window.innerWidth, window.innerHeight),
      sizeAttenuation: 0 // 线宽不随距离变化
    });
    
    return new THREE.Mesh(geometry, material);
  }
  
  /**
   * 使用 MeshLine 为实体创建带线宽的线条
   * @param entity 实体
   * @param points 点数组
   * @param resolution 分辨率
   * @returns THREE.Mesh
   */
  protected createMeshLineForEntity(
    entity: DwgEntity,
    points: THREE.Vector3[],
    resolution?: THREE.Vector2
  ): THREE.Mesh {
    const color = this.getEntityColor(entity);
    const lineWidth = this.getEntityLineWidth(entity);
    return this.createMeshLineFromPoints(points, color, lineWidth, resolution);
  }
  
  /**
   * 使用 MeshLine 创建闭合的带线宽线条
   * @param points 点数组
   * @param color 颜色
   * @param lineWidth 线宽
   * @param resolution 分辨率
   * @returns THREE.Mesh
   */
  protected createMeshLineLoopFromPoints(
    points: THREE.Vector3[],
    color: number,
    lineWidth: number = 1,
    resolution?: THREE.Vector2
  ): THREE.Mesh {
    // 闭合线条需要将第一个点添加到末尾
    const closedPoints = [...points];
    if (points.length > 0) {
      closedPoints.push(points[0].clone());
    }
    return this.createMeshLineFromPoints(closedPoints, color, lineWidth, resolution);
  }
  
  /**
   * 使用 MeshLine 为实体创建闭合的带线宽线条
   */
  protected createMeshLineLoopForEntity(
    entity: DwgEntity,
    points: THREE.Vector3[],
    resolution?: THREE.Vector2
  ): THREE.Mesh {
    const color = this.getEntityColor(entity);
    const lineWidth = this.getEntityLineWidth(entity);
    return this.createMeshLineLoopFromPoints(points, color, lineWidth, resolution);
  }
}
