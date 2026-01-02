import * as THREE from 'three';
import { DwgDatabase, DwgLayerTableEntry, DwgEntity, DwgPoint3D } from '../database';
import { DrawContext, LayerInfo, getColorFromIndex } from './types';
import { Layer2D } from './Layer2D';
// 导入所有绘制器
import { BaseDrawer } from './BaseDrawer';
import { LineDrawer } from './LineDrawer';
import { CircleDrawer } from './CircleDrawer';
import { ArcDrawer } from './ArcDrawer';
import { EllipseDrawer } from './EllipseDrawer';
import { PolylineDrawer } from './PolylineDrawer';
import { PointDrawer } from './PointDrawer';
import { SolidDrawer } from './SolidDrawer';
import { FaceDrawer } from './FaceDrawer';
import { TextMeshDrawer } from './TextMeshDrawer';
import { SplineDrawer } from './SplineDrawer';
import { InsertDrawer } from './InsertDrawer';
import { RayXlineDrawer } from './RayXlineDrawer';
import { LeaderDrawer } from './LeaderDrawer';
import { MlineDrawer } from './MlineDrawer';
import { AttribDrawer } from './AttribDrawer';
import { HatchDrawer } from './HatchDrawer';
import { DimensionDrawer } from './DimensionDrawer';
import { TableDrawer } from './TableDrawer';
import { ImageDrawer } from './ImageDrawer';
import { WipeoutDrawer } from './WipeoutDrawer';
import { OleFrameDrawer } from './OleFrameDrawer';
import { ProxyDrawer } from './ProxyDrawer';
import { SectionDrawer } from './SectionDrawer';
import { ToleranceDrawer } from './ToleranceDrawer';
import { VertexDrawer } from './VertexDrawer';
import { ViewportDrawer } from './ViewportDrawer';
import { RegionDrawer } from './RegionDrawer';
import { ThreeDSolidDrawer } from './3DSolidDrawer';
import { BodyDrawer } from './BodyDrawer';
import { ShapeDrawer } from './ShapeDrawer';
import { TraceDrawer } from './TraceDrawer';

/**
 * ViewportDraw 类
 * 负责将DWG数据渲染
 */
export class ViewportDraw {
  private scene: THREE.Scene;
  private scaleFactor: number;
  private database: DwgDatabase | null = null;
  private entities: THREE.Object3D[] = [];
  // 添加绘制器数组
  private drawers: BaseDrawer[] = [];
  private useXZPlane: boolean = false;
  // 图层管理
  private layerMap: Map<string, Layer2D> = new Map();
  private layerGroup: THREE.Group = new THREE.Group();
  // 图层数据映射
  private layerDataMap: Map<string, DwgLayerTableEntry> = new Map();
  // 当前绘制上下文（供嵌套实体传递继承颜色等信息）
  private drawContext: DrawContext | null = null;

  constructor(scaleFactor: number = 0.01) {
    // 从全局App实例获取scene
    const appInstance = (window as any).appInstance;
    this.scene = appInstance?.scene || new THREE.Scene();
    this.scaleFactor = scaleFactor;
    this.layerGroup.name = 'DWG_Layers';
    this.layerGroup.visible = true;
    this.scene.add(this.layerGroup);
  }

  /**
   * 设置缩放因子
   */
  public setScaleFactor(factor: number): void {
    this.scaleFactor = factor;
  }

  /**
   * 获取缩放因子
   */
  public getScaleFactor(): number {
    return this.scaleFactor;
  }

  /**
   * 切换坐标系统
   * @param useXZ 是否使用XZ平面
   */
  public toggleCoordinateSystem(useXZ: boolean): void {
    this.useXZPlane = useXZ;
    if (useXZ) {
      this.layerGroup.rotation.set(-Math.PI / 2, 0, 0);
    } else {
      this.layerGroup.rotation.set(0, 0, 0);
    }
  }


  /**
   * 加载DWG数据库
   */
  public loadDatabase(database: DwgDatabase): void {
    this.database = database;
    this.initializeLayers();
    this.render();
  }

  /**
   * 初始化图层
   */
  private initializeLayers(): void {
    // 清理旧图层
    this.layerMap.clear();
    this.layerDataMap.clear();
    while (this.layerGroup.children.length > 0) {
      this.layerGroup.remove(this.layerGroup.children[0]);
    }

    if (!this.database?.tables?.LAYER?.entries) {
      // 创建默认图层 "0"
      this.createLayer('0', { visible: true, frozen: false, locked: false, color: 0xffffff });
      return;
    }

    // 从数据库创建图层
    for (const layerEntry of this.database.tables.LAYER.entries) {
      // 存储图层数据
      this.layerDataMap.set(layerEntry.name, layerEntry);
      
      // 确定图层颜色
      let layerColor = 0xffffff;
      if (layerEntry.trueColor && layerEntry.trueColor > 0) {
        layerColor = layerEntry.trueColor;
      } else if (layerEntry.colorIndex && layerEntry.colorIndex > 0 && layerEntry.colorIndex < 256) {
        layerColor = getColorFromIndex(layerEntry.colorIndex);
      } else if (layerEntry.color && layerEntry.color > 0) {
        layerColor = layerEntry.color > 255 ? layerEntry.color : getColorFromIndex(layerEntry.color);
      }


      // 确定图层可见性（frozen 或 off 都会导致不可见）
      const isVisible = !layerEntry.frozen && !layerEntry.off;
      console.log(`[ViewportDraw] Layer ${layerEntry.name} frozen: ${layerEntry.frozen}, off: ${layerEntry.off}, visible: ${isVisible}`);

      this.createLayer(layerEntry.name, {
        visible: isVisible,
        frozen: layerEntry.frozen,
        locked: layerEntry.locked,
        color: layerColor,
        colorIndex: layerEntry.colorIndex,
        trueColor: layerEntry.trueColor
      });
    }

    // 确保存在默认图层 "0"
    if (!this.layerMap.has('0')) {
      this.createLayer('0', { visible: true, frozen: false, locked: false, color: 0xffffff });
    }

    console.log(`[ViewportDraw] 初始化了 ${this.layerMap.size} 个图层`);
  }

  /**
   * 创建图层
   */
  private createLayer(name: string, info: Partial<LayerInfo>): Layer2D {
    const layerInfo: LayerInfo = {
      name,
      visible: info.visible ?? true,
      frozen: info.frozen ?? false,
      locked: info.locked ?? false,
      color: info.color,
      colorIndex: info.colorIndex,
      trueColor: info.trueColor
    };
    const layer = new Layer2D(layerInfo);
    this.layerMap.set(name, layer);
    this.layerGroup.add(layer.getGroup());
    this.layerGroup.visible = true;  // 确保图层组可见
    console.log(`[ViewportDraw] Created layer: ${name}, visible: ${info.visible ?? true}`);
    return layer;
  }

  /**
   * 获取或创建图层
   */
  private getOrCreateLayer(name: string): Layer2D {
    let layer = this.layerMap.get(name);
    if (!layer) {
      layer = this.createLayer(name, { visible: true, frozen: false, locked: false });
    }
    return layer;
  }

  /**
   * 渲染数据库
   */
  private render(): void {
    if (!this.database) {
      console.warn('[ViewportDraw] No database loaded');
      return;
    }

    // 清除现有实体
    this.clearEntities();

    // 创建图层信息映射（从 DwgLayerTableEntry 转换为 LayerInfo）
    const layerInfoMap = new Map<string, LayerInfo>();
    for (const [name, layerEntry] of this.layerDataMap) {
      // 确定图层颜色
      let layerColor = 0xffffff;
      if (layerEntry.trueColor && layerEntry.trueColor > 0) {
        layerColor = layerEntry.trueColor;
      } else if (layerEntry.colorIndex && layerEntry.colorIndex > 0 && layerEntry.colorIndex < 256) {
        layerColor = getColorFromIndex(layerEntry.colorIndex);
      } else if (layerEntry.color && layerEntry.color > 0) {
        layerColor = layerEntry.color > 255 ? layerEntry.color : getColorFromIndex(layerEntry.color);
      }

      
      // 确定图层可见性（frozen 或 off 都会导致不可见）
      const isVisible = !layerEntry.frozen && !layerEntry.off;
      
      layerInfoMap.set(name, {
        name: layerEntry.name,
        visible: isVisible,
        frozen: layerEntry.frozen ?? false,
        locked: layerEntry.locked ?? false,
        color: layerColor,
        colorIndex: layerEntry.colorIndex,
        trueColor: layerEntry.trueColor
      });
    }

    // 创建绘制上下文，包含图层数据和标注样式
    const context: DrawContext = {
      scaleFactor: this.scaleFactor,
      lineTypes: this.database.tables?.LTYPE ? 
        new Map(this.database.tables.LTYPE.entries?.map(e => [e.name, e]) || []) : 
        new Map(),
      layers: layerInfoMap,  // 传入图层信息映射
      dimStyles: this.database.tables?.DIMSTYLE ? 
        new Map(this.database.tables.DIMSTYLE.entries?.map(e => [e.name, e]) || []) : 
        new Map()  // 传入标注样式数据
    };
    // 记录当前绘制上下文，供嵌套实体颜色继承使用
    this.drawContext = context;
    console.log(`[ViewportDraw] Creating drawers with scaleFactor: ${this.scaleFactor}`);

    // 准备blocks数据用于InsertDrawer
    const blocks = this.database.blocks || new Map();
    
    // 从 BLOCK_RECORD 表构建blockBasePoints映射
    const blockBasePoints = new Map<string, DwgPoint3D>();
    if (this.database.tables?.BLOCK_RECORD?.entries) {
      for (const blockRecord of this.database.tables.BLOCK_RECORD.entries) {
        if (blockRecord.name && blockRecord.basePoint) {
          // 确保 z 值存在，如果为 undefined 则设为 0
          blockBasePoints.set(blockRecord.name, {
            x: blockRecord.basePoint.x,
            y: blockRecord.basePoint.y,
            z: blockRecord.basePoint.z ?? 0
          });
        }
      }
    }
    
    console.log(`[ViewportDraw] Loaded ${blocks.size} blocks, ${blockBasePoints.size} base points`);

    // 初始化所有绘制器（按使用频率排序，常用的先检查）
    // 注意：DimensionDrawer需要blocks和entityCreator参数，在这里先传空null，后面再设置
    this.drawers = [
      // 基础几何实体（最常用）
      new LineDrawer(context),           // LINE - 直线
      new PolylineDrawer(context),       // POLYLINE, LWPOLYLINE - 多段线
      new CircleDrawer(context),         // CIRCLE - 圆
      new ArcDrawer(context),            // ARC - 圆弧
      new EllipseDrawer(context),        // ELLIPSE - 椭圆
      
      // 文字和标注
      new TextMeshDrawer(context),       // TEXT, MTEXT - 文字
      new DimensionDrawer(context, blocks, (entity) => this.createEntityFromDrawers(entity)), // DIMENSION - 标注
      new LeaderDrawer(context),         // LEADER - 引线
      new AttribDrawer(context),         // ATTRIB, ATTDEF - 属性
      
      // 块和插入
      new InsertDrawer(context, blocks), // INSERT - 块插入
      
      // 复杂几何实体
      new SplineDrawer(context),         // SPLINE - 样条曲线
      new HatchDrawer(context),          // HATCH - 填充
      new SolidDrawer(context),          // SOLID - 实心体
      new FaceDrawer(context),           // 3DFACE - 三维面
      
      // 三维实体（ACIS数据）
      new RegionDrawer(context),         // REGION - 区域
      new ThreeDSolidDrawer(context),    // 3DSOLID - 三维实体
      new BodyDrawer(context),           // BODY - 体数据
      
      // 特殊实体
      new PointDrawer(context),          // POINT - 点
      new MlineDrawer(context),          // MLINE - 多线
      new RayXlineDrawer(context),       // RAY, XLINE - 射线和构造线
      new ImageDrawer(context),          // IMAGE - 图像
      new WipeoutDrawer(context),        // WIPEOUT - 擦除
      new TableDrawer(context),          // TABLE - 表格
      new ShapeDrawer(context),          // SHAPE - 形状
      new TraceDrawer(context),          // TRACE - 轨迹线
      
      // OLE和代理对象
      new OleFrameDrawer(context),       // OLEFRAME, OLE2FRAME - OLE框架
      new ProxyDrawer(context),          // PROXY - 代理对象
      
      // 其他
      new ToleranceDrawer(context),      // TOLERANCE - 公差
      new SectionDrawer(context),        // SECTION - 剖面
      new VertexDrawer(context),         // VERTEX - 顶点
      new ViewportDrawer(context)        // VIEWPORT - 视口
    ];
    
    // 设置InsertDrawer的blockBasePoints和代理委托
    const insertDrawer = this.drawers.find(d => d instanceof InsertDrawer) as InsertDrawer | undefined;
    if (insertDrawer) {
      if (blockBasePoints.size > 0) {
        insertDrawer.setBlockBasePoints(blockBasePoints);
      }
      // 设置代理委托，用于绘制块内实体
      insertDrawer.setDelegate({
        createEntityObject: (entity: DwgEntity, inheritedColor?: number) => {
          return this.createEntityFromDrawers(entity, inheritedColor);
        }
      });
    }

    // 图层统计
    const layerStats = new Map<string, number>();

    // 绘制所有实体
    const renderStats = {
      total: 0,
      rendered: 0,
      skipped: 0,
      errors: 0,
      skippedTypes: new Map<string, number>()
    };
    
    if (this.database.entities && Array.isArray(this.database.entities)) {
      renderStats.total = this.database.entities.length;
      
      for (const entity of this.database.entities) {
        try {
          // 检查实体可见性
          if (entity.isVisible === false) {
            renderStats.skipped++;
            continue;
          }
          
          // 检查图层可见性
          const layerName = entity.layer || '0';
          const layerData = this.layerDataMap.get(layerName);
          if (layerData && (layerData.frozen || layerData.off)) {
            renderStats.skipped++;
            continue;
          }

          // 尝试用每个绘制器绘制实体
          let drawn = false;
          for (const drawer of this.drawers) {
            if (drawer.canDraw(entity)) {
              console.log(`[ViewportDraw] Trying to draw entity with ${drawer.constructor.name}`);
              const object = drawer.draw(entity);
              console.log(`[ViewportDraw] Drawer returned object:`, object);
              if (object) {
                // 注意：elevation 已在绘制器内部处理，不再重复应用
                // 带 elevation 的实体（如 LWPOLYLINE, HATCH）已在 group.position.z 中设置
                
                // 设置对象的图层信息
                object.userData.layer = layerName;
                object.userData.entityType = entity.type;
                object.userData.handle = entity.handle;
                object.userData.entity = entity; // 保存原始实体数据
                
                // 将对象添加到对应图层
                const layer = this.getOrCreateLayer(layerName);
                layer.addObject(object);
                console.log(`[ViewportDraw] Added object to layer ${layerName}: ${object.constructor.name}`, object);
                
                this.entities.push(object);
                drawn = true;
                renderStats.rendered++;
                
                // 更新图层统计
                layerStats.set(layerName, (layerStats.get(layerName) || 0) + 1);
                break;
              }
            }
          }
          
          if (!drawn) {
            console.log(`[ViewportDraw] Skipped entity type: ${entity.type || 'UNKNOWN'}`);
            renderStats.skipped++;
            const entityType = entity.type || 'UNKNOWN';
            const count = renderStats.skippedTypes.get(entityType) || 0;
            renderStats.skippedTypes.set(entityType, count + 1);
          }
        } catch (error) {
          renderStats.errors++;
          console.error('[ViewportDraw] Error drawing entity:', entity.type, error);
        }
      }
    }

    // 输出详细统计信息
    console.log(`[ViewportDraw] ===== 渲染统计 =====`);
    console.log(`[ViewportDraw] 总实体数: ${renderStats.total}`);
    console.log(`[ViewportDraw] 已渲染: ${renderStats.rendered} (${renderStats.total > 0 ? (renderStats.rendered / renderStats.total * 100).toFixed(1) : 0}%)`);
    console.log(`[ViewportDraw] 跳过: ${renderStats.skipped} (${renderStats.total > 0 ? (renderStats.skipped / renderStats.total * 100).toFixed(1) : 0}%)`);
    console.log(`[ViewportDraw] 错误: ${renderStats.errors}`);
    console.log(`[ViewportDraw] 图层数: ${this.layerMap.size}`);
    
    // 输出图层统计
    if (layerStats.size > 0) {
      console.log(`[ViewportDraw] 图层分布:`);
      const sortedLayers = Array.from(layerStats.entries())
        .sort((a, b) => b[1] - a[1]);
      sortedLayers.slice(0, 10).forEach(([layer, count]) => {
        console.log(`  - ${layer}: ${count} 个`);
      });
      if (sortedLayers.length > 10) {
        console.log(`  ... 及其他 ${sortedLayers.length - 10} 个图层`);
      }
    }
    
    if (renderStats.skippedTypes.size > 0) {
      console.log(`[ViewportDraw] 未支持的实体类型:`);
      const sortedTypes = Array.from(renderStats.skippedTypes.entries())
        .sort((a, b) => b[1] - a[1]); // 按数量降序排列
      sortedTypes.forEach(([type, count]) => {
        console.log(`  - ${type}: ${count} 个`);
      });
    }
    console.log(`[ViewportDraw] ========================`);
    
    // 更新所有图层的矩阵世界，确保从层级到实体的矩阵信息正确
    this.updateAllMatrices();
  }

  /**
   * 更新所有图层和实体的矩阵世界
   * 确保从图层组到子对象的变换链正确
   */
  public updateAllMatrices(): void {
    // 更新图层组的矩阵
    this.layerGroup.updateMatrixWorld(true);
  }

  /**
   * 从绘制器创建实体对象（用于DimensionDrawer等需要创建子实体的场景）
   * @param entity 实体数据
   * @param inheritedColor 继承颜色（可选）
   */
  private createEntityFromDrawers(entity: any, inheritedColor?: number): THREE.Object3D | null {
    // 在调用具体 Drawer 前，将继承颜色写入上下文（用于 BYBLOCK 颜色计算）
    // 注意：accumulatedTransform 已经通过 context 传递，不需要额外参数
    const prevInheritedColor = this.drawContext?.inheritedColor;
    if (this.drawContext && typeof inheritedColor === 'number') {
      this.drawContext.inheritedColor = inheritedColor;
    }

    for (const drawer of this.drawers) {
      if (drawer.canDraw(entity)) {
        try {
          const obj = drawer.draw(entity);
          // 恢复之前的继承颜色
          if (this.drawContext) {
            this.drawContext.inheritedColor = prevInheritedColor;
          }
          return obj;
        } catch (error) {
          console.error('[ViewportDraw] Error creating entity from drawer:', error);
          if (this.drawContext) {
            this.drawContext.inheritedColor = prevInheritedColor;
          }
          return null;
        }
      }
    }

    // 恢复之前的继承颜色
    if (this.drawContext) {
      this.drawContext.inheritedColor = prevInheritedColor;
    }
    return null;
  }

  /**
   * 应用实体的 elevation（标高）
   * 标高是实体在Z轴上的偏移量，常见于2D实体
   * @param object Three.js 对象
   * @param entity DWG 实体数据
   */
  private applyElevation(object: THREE.Object3D, entity: any): void {
    // 获取实体的 elevation 值
    const elevation = entity.elevation;
    
    if (elevation !== undefined && elevation !== 0) {
      // 应用标高偏移（乘以缩放因子）
      object.position.z += elevation * this.scaleFactor;
    }
    
    // 处理 thickness（厚度）- 某些实体有厚度属性
    // 厚度通常用于创建3D拉伸效果，这里暂时不处理
    // 如果需要支持 thickness，需要在绘制器中处理
  }

  /**
   * 清除所有实体
   */
  public clearEntities(): void {
    // 清理图层中的对象
    this.layerMap.forEach(layer => {
      layer.clear();
    });
    
    // 清理实体列表
    for (const entity of this.entities) {
      // 如果实体仍在场景中，移除它
      if (entity.parent) {
        entity.parent.remove(entity);
      }
      // 清理几何体和材质
      this.disposeObject(entity);
    }
    this.entities = [];
  }

  /**
   * 释放对象资源
   */
  private disposeObject(object: THREE.Object3D): void {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
      object.geometry?.dispose();
      if (Array.isArray(object.material)) {
        object.material.forEach(m => m.dispose());
      } else {
        object.material?.dispose();
      }
    }
    // 递归清理子对象
    object.children.forEach(child => this.disposeObject(child));
  }

  /**
   * 获取场景
   */
  public getScene(): THREE.Scene {
    console.log(`[ViewportDraw] Getting scene with ${this.layerGroup.children.length} layer groups`);
    // 确保返回有效的场景对象
    if (!this.scene) {
      const appInstance = (window as any).appInstance;
      this.scene = appInstance?.scene || new THREE.Scene();
    }
    return this.scene;
  }

  /**
   * 获取所有实体
   */
  public getEntities(): THREE.Object3D[] {
    console.log(`[ViewportDraw] Getting ${this.entities.length} entities`);
    return this.entities;
  }

  // ========== 图层管理 API ==========

  /**
   * 获取所有图层名称
   */
  public getLayerNames(): string[] {
    return Array.from(this.layerMap.keys());
  }

  /**
   * 获取图层
   */
  public getLayer(name: string): Layer2D | undefined {
    return this.layerMap.get(name);
  }

  /**
   * 获取所有图层
   */
  public getAllLayers(): Layer2D[] {
    return Array.from(this.layerMap.values());
  }

  /**
   * 设置图层可见性
   */
  public setLayerVisible(layerName: string, visible: boolean): void {
    const layer = this.layerMap.get(layerName);
    if (layer) {
      layer.setVisible(visible);
    }
  }

  /**
   * 设置所有图层可见性
   */
  public setAllLayersVisible(visible: boolean): void {
    this.layerMap.forEach(layer => {
      layer.setVisible(visible);
    });
  }

  /**
   * 设置图层颜色
   */
  public setLayerColor(layerName: string, color: number): void {
    const layer = this.layerMap.get(layerName);
    if (layer) {
      layer.setColor(color);
    }
  }

  /**
   * 获取图层信息列表
   */
  public getLayerInfoList(): LayerInfo[] {
    const result: LayerInfo[] = [];
    this.layerMap.forEach((layer, name) => {
      const layerData = this.layerDataMap.get(name);
      result.push({
        name,
        visible: layer.isVisible(),
        frozen: layer.isFrozen(),
        locked: layer.isLocked(),
        color: layer.getColor(),
        colorIndex: layerData?.colorIndex,
        trueColor: layerData?.trueColor
      });
    });
    return result;
  }

  /**
   * 获取图层对象数量
   */
  public getLayerObjectCount(layerName: string): number {
    const layer = this.layerMap.get(layerName);
    return layer ? layer.getObjectCount() : 0;
  }

  /**
   * 获取图层组（用于添加到场景）
   */
  public getLayerGroup(): THREE.Group {
    console.log(`[ViewportDraw] Getting layer group with ${this.layerGroup.children.length} children`);
    console.log(`[ViewportDraw] Layer group visible: ${this.layerGroup.visible}`);
    return this.layerGroup;
  }

  /**
   * 销毁
   */
  public destroy(): void {
    this.clearEntities();
    this.layerMap.clear();
    this.layerDataMap.clear();
    while (this.layerGroup.children.length > 0) {
      this.layerGroup.remove(this.layerGroup.children[0]);
    }
    this.database = null;
  }
}

/**
 * 从JSON加载并渲染
 * @param jsonString JSON字符串
 * @param scaleFactor 缩放因子
 */
export function loadAndRenderJSON(jsonString: string, scaleFactor: number = 1): ViewportDraw {
  const database = JSON.parse(jsonString) as DwgDatabase;
  return renderDWGDatabase(database, scaleFactor);
}

/**
 * 渲染JSON字符串
 * @param jsonString JSON字符串
 * @param scaleFactor 缩放因子
 */
export function renderJSONString(jsonString: string, scaleFactor: number = 1): ViewportDraw {
  return loadAndRenderJSON(jsonString, scaleFactor);
}

/**
 * 渲染DWG数据库
 * @param database DWG数据库对象
 * @param scaleFactor 缩放因子
 */
interface RenderDWGOptions {
  coordinateSystem?: 'xy' | 'xz';
}

export function renderDWGDatabase(database: DwgDatabase, scaleFactor: number = 1, options?: RenderDWGOptions): ViewportDraw {
  const viewport = new ViewportDraw(scaleFactor);
  viewport.loadDatabase(database);
  if (options?.coordinateSystem) {
    viewport.toggleCoordinateSystem(options.coordinateSystem === 'xz');
  }
  return viewport;
}

