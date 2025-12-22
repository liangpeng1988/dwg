/**
 * Three.js 绘制器模块
 * 提供将 DWG 实体转换为 Three.js 对象的功能
 */

// 类型定义
export type { LayerInfo, DrawContext, DrawResult, BackgroundColorType } from './types';
export { scalePoint, scalePoint2D, applyExtrusionDirection, createLineMaterial, createMeshMaterial, getColorFromIndex, getColorFromName, bgrToRgb, isValidRgbColor, isValidAciIndex, getLayerColor, getEntityColor, isLightBackground, createLineMaterialForEntity, createMeshMaterialForEntity, getLineWidth, createLineMaterialWithWidth, getOcsToWcsMatrix, ocsPointToWcs, createInsertTransformMatrix, xyToXz, xzToXy, batchXyToXz, batchXzToXy } from './types';

// 基类
export { BaseDrawer } from './BaseDrawer';

// 绘制器类
export { LineDrawer } from './LineDrawer';
export { CircleDrawer } from './CircleDrawer';
export { ArcDrawer } from './ArcDrawer';
export { EllipseDrawer } from './EllipseDrawer';
export { PolylineDrawer } from './PolylineDrawer';
export { PointDrawer } from './PointDrawer';
export { SolidDrawer } from './SolidDrawer';
export { FaceDrawer } from './FaceDrawer';
// export { TextDrawer } from './TextDrawer'; // 已弃用，使用 TextMeshDrawer 替代
export { SplineDrawer } from './SplineDrawer';
export { InsertDrawer } from './InsertDrawer';
export type { EntityDrawerDelegate } from './InsertDrawer';
export { RayXlineDrawer } from './RayXlineDrawer';
export { LeaderDrawer } from './LeaderDrawer';
export { MlineDrawer } from './MlineDrawer';
export { BlockRecordDrawer } from './BlockRecordDrawer';
export type { BlockRecordDrawOptions } from './BlockRecordDrawer';
export { AttribDrawer } from './AttribDrawer';
export { HatchDrawer } from './HatchDrawer';
export { DimensionDrawer } from './DimensionDrawer';
export { InsertPlaceholderDrawer } from './InsertPlaceholderDrawer';
export { TableDrawer } from './TableDrawer';
export { ImageDrawer } from './ImageDrawer';
export { WipeoutDrawer } from './WipeoutDrawer';
export { OleFrameDrawer } from './OleFrameDrawer';
export { ProxyDrawer } from './ProxyDrawer';
export { SectionDrawer } from './SectionDrawer';
export { ToleranceDrawer } from './ToleranceDrawer';
export { VertexDrawer } from './VertexDrawer';
export { ViewportDrawer } from './ViewportDrawer';
export { ObjectDrawer } from './ObjectDrawer';
export { ImageDefDrawer } from './ImageDefDrawer';
export { LayoutDrawer } from './LayoutDrawer';
export { PlotSettingDrawer } from './PlotSettingDrawer';
export { NestedPolygonProcessor } from './NestedPolygonProcessor';
export type { NestedPolygon } from './NestedPolygonProcessor';
export { Layer2D } from './Layer2D';

// 主绘制类
export { ViewportDraw, loadAndRenderJSON, renderJSONString, renderDWGDatabase } from './ViewportDraw';
