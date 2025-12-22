import * as THREE from 'three';
import { BaseDrawer } from './BaseDrawer';
import { DwgImageDefObject } from '../database/objects/imageDef';
import { DwgLayoutObject } from '../database/objects/layout';
import { DwgPlotSettingObject } from '../database/objects/plotSetting';
import { DwgCommonObject } from '../database/objects/common';

/**
 * 支持的对象类型联合
 */
export type SupportedObject = 
  | DwgImageDefObject 
  | DwgLayoutObject 
  | DwgPlotSettingObject 
  | DwgCommonObject;

/**
 * DWG 对象绘制器基类
 * 处理 DWG 中的各种对象类型
 */
export class ObjectDrawer extends BaseDrawer<SupportedObject> {
  /**
   * 检查对象类型是否匹配
   */
  canDraw(object: any): object is SupportedObject {
    // 对象通常不直接绘制，而是作为其他实体的引用
    // 这里返回 false 表示这些对象不直接绘制
    return false;
  }

  /**
   * 绘制对象（通常不直接调用）
   */
  draw(object: SupportedObject): THREE.Object3D | null {
    // 对象通常不直接绘制，而是作为数据提供者
    // 返回 null 表示不创建可视对象
    return null;
  }

  /**
   * 获取图像定义信息
   */
  getImageDefInfo(imageDef: DwgImageDefObject): {
    fileName: string;
    width: number;
    height: number;
    isLoaded: boolean;
  } {
    return {
      fileName: imageDef.fileName || 'unknown',
      width: imageDef.size?.x || 0,
      height: imageDef.size?.y || 0,
      isLoaded: !!imageDef.isLoaded
    };
  }

  /**
   * 获取布局信息
   */
  getLayoutInfo(layout: DwgLayoutObject): {
    name: string;
    paperWidth: number;
    paperHeight: number;
    tabOrder: number;
  } {
    return {
      name: layout.layoutName || 'Unnamed Layout',
      paperWidth: layout.maxExtent?.x && layout.minExtent?.x ? 
        Math.abs(layout.maxExtent.x - layout.minExtent.x) : 0,
      paperHeight: layout.maxExtent?.y && layout.minExtent?.y ? 
        Math.abs(layout.maxExtent.y - layout.minExtent.y) : 0,
      tabOrder: layout.tabOrder || 0
    };
  }

  /**
   * 获取打印设置信息
   */
  getPlotSettingInfo(plotSetting: DwgPlotSettingObject): {
    name: string;
    paperSize: string;
    paperWidth: number;
    paperHeight: number;
    scale: number;
  } {
    return {
      name: plotSetting.pageSetupName || 'Default Plot Setting',
      paperSize: plotSetting.paperSize || 'Unknown',
      paperWidth: plotSetting.paperWidth || 0,
      paperHeight: plotSetting.paperHeight || 0,
      scale: plotSetting.printScaleDenominator ? 
        plotSetting.printScaleNominator / plotSetting.printScaleDenominator : 1
    };
  }

  /**
   * 获取通用对象信息
   */
  getCommonObjectInfo(commonObject: DwgCommonObject): {
    handle: number;
    ownerHandle: number;
  } {
    return {
      handle: commonObject.handle || 0,
      ownerHandle: commonObject.ownerHandle || 0
    };
  }
}