import { ViewportDraw } from './ViewportDraw';
import { xyToXz, xzToXy, batchXyToXz, batchXzToXy } from './types';

/**
 * 坐标转换功能演示类
 * 展示如何使用XY/XZ坐标系转换功能
 */
export class CoordinateConversionDemo {
  private viewportDraw: ViewportDraw;

  constructor() {
    this.viewportDraw = new ViewportDraw();
  }

  /**
   * 演示单点坐标转换
   */
  public demoSinglePointConversion(): void {
    console.log('=== 单点坐标转换演示 ===');
    
    // 原始XY坐标点
    const xyPoint = { x: 10, y: 20 };
    console.log('原始XY坐标点:', xyPoint);
    
    // 转换为XZ坐标系
    const xzPoint = xyToXz(xyPoint, 5); // Z坐标设为5
    console.log('转换为XZ坐标点:', xzPoint);
    
    // 转换回XY坐标系
    const backToXy = xzToXy(xzPoint);
    console.log('转换回XY坐标点:', backToXy);
    
    console.log('');
  }

  /**
   * 演示批量坐标转换
   */
  public demoBatchConversion(): void {
    console.log('=== 批量坐标转换演示 ===');
    
    // 原始XY坐标点数组
    const xyPoints = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ];
    console.log('原始XY坐标点数组:', xyPoints);
    
    // 批量转换为XZ坐标系
    const xzPoints = batchXyToXz(xyPoints, 0); // Z坐标设为0
    console.log('批量转换为XZ坐标点数组:', xzPoints);
    
    // 批量转换回XY坐标系
    const backToXyPoints = batchXzToXy(xzPoints);
    console.log('批量转换回XY坐标点数组:', backToXyPoints);
    
    console.log('');
  }

  /**
   * 演示坐标系切换功能
   */
  public demoCoordinateSystemToggle(): void {
    console.log('=== 坐标系切换演示 ===');
    
    // 切换到XZ坐标系显示
    console.log('切换到XZ坐标系显示...');
    this.viewportDraw.toggleCoordinateSystem(true);
    
    // 切换回XY坐标系显示
    console.log('切换回XY坐标系显示...');
    this.viewportDraw.toggleCoordinateSystem(false);
    
    console.log('');
  }

  /**
   * 运行所有演示
   */
  public runAllDemos(): void {
    console.log('开始坐标转换功能演示\n');
    
    this.demoSinglePointConversion();
    this.demoBatchConversion();
    this.demoCoordinateSystemToggle();
    
    console.log('坐标转换功能演示完成');
  }
}

// 使用示例
/*
const demo = new CoordinateConversionDemo();
demo.runAllDemos();
*/