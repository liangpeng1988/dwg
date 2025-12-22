# DWG Plugin 坐标转换功能说明

## 功能概述

本插件新增了坐标系转换功能，支持在XY坐标系和XZ坐标系之间进行相互转换。这对于需要在不同视角（如平面图和立面图）之间切换的场景非常有用。

默认情况下，插件使用XY坐标系（平面图视角），但在XZ平面（立面图视角）上进行绘制。用户可以通过配置选项切换坐标系和绘制平面。

## 新增功能

### 1. 单点坐标转换

- `xyToXz(point, zOption)`: 将XY坐标点转换为XZ坐标点
- `xzToXy(point)`: 将XZ坐标点转换为XY坐标点

### 2. 批量坐标转换

- `batchXyToXz(points, zOption)`: 批量将XY坐标点转换为XZ坐标点
- `batchXzToXy(points)`: 批量将XZ坐标点转换为XY坐标点

### 3. ViewportDraw中的坐标系切换

- `toggleCoordinateSystem(useXzCoordinates)`: 在XY和XZ坐标系之间切换显示

## 使用示例

### 单点转换
```typescript
import { xyToXz, xzToXy } from 'dwg-plugin';

// 将XY坐标点(100, 50)转换为XZ坐标点，Z值设为10
const xzPoint = xyToXz({ x: 100, y: 50 }, 10);
console.log(xzPoint); // { x: 100, y: 10, z: 50 }

// 将XZ坐标点转换回XY坐标点
const xyPoint = xzToXy(xzPoint);
console.log(xyPoint); // { x: 100, y: 50 }
```

### 批量转换
```typescript
import { batchXyToXz, batchXzToXy } from 'dwg-plugin';

// 一组XY坐标点
const xyPoints = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 50 },
  { x: 0, y: 50 }
];

// 批量转换为XZ坐标点
const xzPoints = batchXyToXz(xyPoints, 0);
console.log(xzPoints);

// 批量转换回XY坐标点
const backToXyPoints = batchXzToXy(xzPoints);
console.log(backToXyPoints);
```

### 坐标系切换
```typescript
import { ViewportDraw } from 'dwg-plugin';

const viewportDraw = new ViewportDraw();

// 切换到XZ坐标系显示（侧视图）
viewportDraw.toggleCoordinateSystem(true);

// 切换回XY坐标系显示（俯视图）
viewportDraw.toggleCoordinateSystem(false);
```

## 应用场景

1. **建筑图纸转换**：将平面图转换为立面图或剖面图
2. **机械设计**：在不同视角间切换查看零件
3. **工程制图**：支持多视角显示和编辑

## 注意事项

- 转换过程中不会丢失原始数据，只是改变了坐标的表示方式
- XZ坐标系中，Y轴代表高度或深度
- 批量转换功能适用于大量点的高效处理
- 默认坐标系可通过插件配置进行更改