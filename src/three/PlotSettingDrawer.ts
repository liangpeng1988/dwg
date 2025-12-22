import * as THREE from 'three';
import { DwgPlotSettingObject } from '../database/objects/plotSetting';
import { BaseDrawer } from './BaseDrawer';

/**
 * 打印设置对象处理类
 * 处理 DWG 中的 PLOTSETTING 对象
 */
export class PlotSettingDrawer extends BaseDrawer<DwgPlotSettingObject> {
  /**
   * 检查对象类型是否匹配
   */
  canDraw(object: any): object is DwgPlotSettingObject {
    // PLOTSETTING 对象通常不直接绘制，而是作为打印设置信息提供者
    // 这里返回 false 表示这些对象不直接绘制
    return false;
  }

  /**
   * 绘制对象（通常不直接调用）
   */
  draw(object: DwgPlotSettingObject): THREE.Object3D | null {
    // PLOTSETTING 对象通常不直接绘制，而是作为数据提供者
    // 返回 null 表示不创建可视对象
    return null;
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
    marginLeft: number;
    marginBottom: number;
    marginRight: number;
    marginTop: number;
  } {
    return {
      name: plotSetting.pageSetupName || 'Default Plot Setting',
      paperSize: plotSetting.paperSize || 'Unknown',
      paperWidth: plotSetting.paperWidth || 0,
      paperHeight: plotSetting.paperHeight || 0,
      scale: plotSetting.printScaleDenominator ? 
        plotSetting.printScaleNominator / plotSetting.printScaleDenominator : 1,
      marginLeft: plotSetting.marginLeft || 0,
      marginBottom: plotSetting.marginBottom || 0,
      marginRight: plotSetting.marginRight || 0,
      marginTop: plotSetting.marginTop || 0
    };
  }

  /**
   * 创建打印设置信息标签
   */
  createPlotSettingLabel(plotSetting: DwgPlotSettingObject): THREE.Mesh | null {
    try {
      const info = this.getPlotSettingInfo(plotSetting);
      
      // 创建包含打印设置信息的标签
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 96;
      
      const context = canvas.getContext('2d');
      if (context) {
        context.fillStyle = '#FFA500'; // 橙色表示打印设置
        context.fillRect(0, 0, 128, 96);
        
        context.fillStyle = '#FFFFFF';
        context.font = '10px Arial';
        context.textAlign = 'left';
        context.textBaseline = 'top';
        
        // 显示打印设置基本信息
        context.fillText(`Plot: ${info.name}`, 4, 4);
        context.fillText(`Size: ${info.paperSize}`, 4, 18);
        context.fillText(`Dims: ${info.paperWidth?.toFixed(1)}×${info.paperHeight?.toFixed(1)}`, 4, 32);
        context.fillText(`Scale: ${info.scale?.toFixed(2)}`, 4, 46);
        context.fillText(`Margins: ${info.marginLeft?.toFixed(1)},${info.marginBottom?.toFixed(1)}`, 4, 60);
      }
      
      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.MeshBasicMaterial({ 
        map: texture,
        transparent: true,
        side: THREE.DoubleSide
      });
      
      const geometry = new THREE.PlaneGeometry(1.2 * this.scaleFactor, 0.9 * this.scaleFactor);
      const label = new THREE.Mesh(geometry, material);
      
      return label;
    } catch (error) {
      console.warn('Failed to create plot setting label:', error);
      return null;
    }
  }
}