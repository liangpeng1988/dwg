# DWG 实体颜色处理完整分析

## 概述

本文档详细分析 `src/plugin/dwg/src/three` 目录下所有实体颜色值的处理逻辑，包括颜色优先级、继承机制、以及特殊实体（块、插入、标注、文字）的颜色处理。

---

## 1. 核心颜色处理函数

### 1.1 `getEntityColor(entity, context)` - 实体颜色主入口

**位置**: `types.ts:249-299`

**优先级顺序**:
1. **实体真彩色** (`entity.trueColor`) - 24位 RGB，直接使用
2. **实体 BGR 颜色** (`entity.color`) - libredwg 解析的 BGR，转换为 RGB
3. **颜色索引** (`entity.colorIndex`):
   - `1-255`: ACI 颜色索引，通过 `getColorFromIndex()` 映射
   - `256` (BYLAYER): 使用图层颜色 `getLayerColor(entity.layer, context.layers)`
   - `0` (BYBLOCK): 
     - 优先使用 `context.inheritedColor`（从父块/标注继承）
     - 否则退回图层颜色
4. **图层颜色**: 如果实体没有显式颜色，使用图层颜色
5. **默认白色** (`0xffffff`): 最后兜底

**关键代码**:
```typescript
export function getEntityColor(entity: DwgEntity, context?: DrawContext): number {
  // 1. trueColor (RGB)
  if (typeof entity.trueColor === 'number' && isValidRgbColor(entity.trueColor)) {
    return entity.trueColor;
  }
  
  // 2. color (BGR -> RGB)
  if (typeof entity.color === 'number') {
    return bgrToRgb(entity.color);
  }
  
  // 3. colorIndex
  if (typeof entity.colorIndex === 'number') {
    let ci = entity.colorIndex;
    if (ci < 0) ci = Math.abs(ci);
    
    if (ci === 256) { // BYLAYER
      return getLayerColor(entity.layer, context?.layers);
    }
    
    if (ci === 0) { // BYBLOCK
      return context?.inheritedColor ?? getLayerColor(entity.layer, context?.layers) ?? 0xffffff;
    }
    
    if (ci > 0 && ci < 256) { // ACI
      return getColorFromIndex(ci);
    }
  }
  
  // 4. 图层颜色
  if (context?.layers) {
    return getLayerColor(entity.layer, context.layers);
  }
  
  // 5. 默认
  return 0xffffff;
}
```

### 1.2 `getLayerColor(layerName, layers)` - 图层颜色

**位置**: `types.ts:217-243`

**优先级顺序**:
1. `layer.trueColor` - 图层真彩色（RGB）
2. `layer.colorIndex` (1-255) - ACI 索引映射
3. `layer.color` - 普通 RGB 颜色
4. 默认白色

---

## 2. 颜色继承机制（BYBLOCK）

### 2.1 DrawContext 中的继承颜色

**位置**: `types.ts:7-15`

```typescript
export interface DrawContext {
  scaleFactor: number;
  backgroundColor?: number;
  lineTypes?: Map<string, DwgLTypeTableEntry>;
  layers?: Map<string, LayerInfo>;
  inheritedColor?: number;  // ← BYBLOCK 继承颜色
}
```

### 2.2 ViewportDraw 中的继承颜色传递

**位置**: `ViewportDraw.ts:417-440`

**机制**:
- `createEntityFromDrawers()` 在调用 Drawer 前，临时设置 `context.inheritedColor`
- Drawer 内部所有 `getEntityColor()` 调用都会看到这个值
- 绘制完成后恢复之前的 `inheritedColor`，避免污染其他实体

**关键代码**:
```typescript
private createEntityFromDrawers(entity: any, inheritedColor?: number): THREE.Object3D | null {
  const prevInheritedColor = this.drawContext?.inheritedColor;
  if (this.drawContext && typeof inheritedColor === 'number') {
    this.drawContext.inheritedColor = inheritedColor;  // ← 设置继承色
  }
  
  for (const drawer of this.drawers) {
    if (drawer.canDraw(entity)) {
      try {
        const obj = drawer.draw(entity);
        // 恢复之前的继承颜色
        if (this.drawContext) {
          this.drawContext.inheritedColor = prevInheritedColor;  // ← 恢复
        }
        return obj;
      } catch (error) {
        // ... 错误处理中也恢复
      }
    }
  }
  return null;
}
```

---

## 3. 特殊实体的颜色处理

### 3.1 INSERT（块插入）

**位置**: `InsertDrawer.ts:145-169`

**处理流程**:
1. 计算父 INSERT 实体的颜色作为继承色:
   ```typescript
   const inheritedColor = getEntityColor(parentEntity, this.context);
   ```
2. 通过 `delegate.createEntityObject(blockEntity, inheritedColor)` 传递给块内实体
3. 块内实体如果是 BYBLOCK (`colorIndex === 0`)，会使用这个继承色

**关键代码**:
```typescript
private drawBlockEntities(
  group: THREE.Object3D,
  blockEntities: DwgEntity[],
  parentEntity: DwgInsertEntity,
  _basePoint?: DwgPoint3D
): void {
  const inheritedColor = getEntityColor(parentEntity, this.context);
  
  for (const blockEntity of blockEntities) {
    if (this.delegate) {
      instance = this.delegate.createEntityObject(blockEntity, inheritedColor);
    }
    if (instance) {
      group.add(instance);
    }
  }
}
```

### 3.2 DIMENSION（标注）

**位置**: `DimensionDrawer.ts:35-77`

**处理流程**:
1. 计算标注实体的颜色作为继承色:
   ```typescript
   const inheritedColor = getEntityColor(entity, this.context);
   ```
2. 标注块内的所有实体（包括文字、箭头、尺寸线）都使用这个继承色
3. 标注文字颜色通过 `dimTextColor` 单独处理（从 DIMSTYLE 或实体颜色获取）

**关键代码**:
```typescript
draw(entity: DwgEntity): THREE.Group {
  const blockName = (entity as any).name;
  if (blockName && this.blocks.has(blockName)) {
    const inheritedColor = getEntityColor(entity, this.context);
    
    for (const blockEntity of blockEntities) {
      const obj = this.createEntityObject(blockEntity, inheritedColor);
      if (obj) group.add(obj);
    }
  }
}
```

### 3.3 TEXT / MTEXT（文字）

**位置**: `TextMeshDrawer.ts:39-118`

**处理流程**:
1. 直接使用 `this.getEntityColor(entity)` 获取颜色
2. 传递给 `TextMesh.create()` 用于文字渲染
3. 支持 BYLAYER、BYBLOCK、ACI、真彩色等所有颜色模式

**关键代码**:
```typescript
private drawText(entity: DwgTextEntity): THREE.Object3D | null {
  const color = this.getEntityColor(entity);  // ← 统一颜色处理
  const result = this.textMesh.create(
    entity.text, 
    offsetPosition, 
    fontSize, 
    color,  // ← 传递给文字渲染器
    entity.halign || 0,
    entity.valign || 0,
    entity.rotation || 0
  );
  return result;
}
```

---

## 4. 普通实体的颜色处理

所有普通实体（LINE、CIRCLE、ARC、POLYLINE、SPLINE 等）都通过 `BaseDrawer.getEntityColor()` 获取颜色：

### 4.1 使用模式

**所有 Drawer 继承自 `BaseDrawer`**:
```typescript
export abstract class BaseDrawer<T extends DwgEntity = DwgEntity> {
  protected getEntityColor(entity: DwgEntity, defaultColor: number = 0x000000): number {
    if (BaseDrawer.monochromeModeEnabled) {
      return BaseDrawer.monochromeColor;  // 单色模式
    }
    return getEntityColor(entity, this.context);  // ← 统一调用
  }
}
```

### 4.2 示例：LineDrawer

```typescript
draw(entity: DwgLineEntity): THREE.Line {
  const color = this.getEntityColor(entity);  // ← 获取颜色
  const line = this.createLineFromPoints([start, end], color);
  return line;
}
```

### 4.3 示例：CircleDrawer

```typescript
drawOutline(entity: DwgCircleEntity): THREE.Line {
  const color = this.getEntityColor(entity);  // ← 获取颜色
  const line = this.createLineFromPoints(points, color);
  return line;
}
```

### 4.4 示例：PolylineDrawer

```typescript
draw(entity: SupportedPolylineEntity): THREE.Line | THREE.LineLoop {
  const color = this.getEntityColor(entity);  // ← 获取颜色
  // ... 根据类型分别处理
  return this.drawLWPolyline(entity, color);
}
```

### 4.5 示例：HatchDrawer

```typescript
private getHatchColor(entity: DwgHatchEntity): number {
  return this.getEntityColor(entity, 0x888888);  // ← 默认灰色
}
```

---

## 5. 颜色处理流程图

```
实体绘制请求
    ↓
BaseDrawer.getEntityColor()
    ↓
types.getEntityColor(entity, context)
    ↓
┌─────────────────────────────────────┐
│ 1. trueColor? → 直接返回            │
│ 2. color? → bgrToRgb()             │
│ 3. colorIndex?                     │
│    ├─ 256 (BYLAYER) → 图层颜色      │
│    ├─ 0 (BYBLOCK) → 继承色/图层色   │
│    └─ 1-255 (ACI) → 索引映射        │
│ 4. 图层颜色                         │
│ 5. 默认白色                         │
└─────────────────────────────────────┘
    ↓
返回 RGB 颜色值 (0x000000 - 0xFFFFFF)
    ↓
传递给 Three.js Material
```

---

## 6. BYBLOCK 颜色继承链

```
顶层实体 (colorIndex=256 BYLAYER)
    ↓
INSERT 实体 (colorIndex=0 BYBLOCK)
    ↓
getEntityColor(INSERT) → 计算 INSERT 实际颜色
    ↓
inheritedColor = INSERT 实际颜色
    ↓
块内实体 (colorIndex=0 BYBLOCK)
    ↓
getEntityColor(块内实体) → 使用 inheritedColor
    ↓
块内实体显示 INSERT 的颜色
```

**嵌套块示例**:
```
INSERT_A (红色) 
  └─ Block_A
      └─ INSERT_B (BYBLOCK) → 显示红色
          └─ Block_B
              └─ LINE (BYBLOCK) → 显示红色
```

---

## 7. 颜色值格式转换

### 7.1 BGR → RGB

**位置**: `types.ts:148-153`

```typescript
export function bgrToRgb(bgr: number): number {
  const b = (bgr >> 16) & 0xff;
  const g = (bgr >> 8) & 0xff;
  const r = bgr & 0xff;
  return (r << 16) | (g << 8) | b;
}
```

**原因**: libredwg 解析出的 `entity.color` 是 BGR 格式（Blue-Green-Red），需要转换为 RGB。

### 7.2 ACI 颜色索引映射

**位置**: `types.ts:158-172`

```typescript
export function getColorFromIndex(colorIndex: number): number {
  const aciColors: { [key: number]: number } = {
    0: 0x000000, // ByBlock
    1: 0xff0000, // Red
    2: 0xffff00, // Yellow
    3: 0x00ff00, // Green
    4: 0x00ffff, // Cyan
    5: 0x0000ff, // Blue
    6: 0xff00ff, // Magenta
    7: 0xffffff, // White/Black
    // ... 更多颜色索引
  };
  return aciColors[colorIndex] || 0xffffff;
}
```

---

## 8. 特殊场景处理

### 8.1 单色模式

**位置**: `BaseDrawer.ts:27-59`

全局单色模式会覆盖所有实体颜色：
```typescript
protected getEntityColor(entity: DwgEntity, defaultColor: number = 0x000000): number {
  if (BaseDrawer.monochromeModeEnabled) {
    return BaseDrawer.monochromeColor;  // ← 单色模式优先
  }
  return getEntityColor(entity, this.context);
}
```

### 8.2 图层关闭/冻结

**位置**: `ViewportDraw.ts:304-307`

图层关闭的实体会被跳过，不进行颜色计算：
```typescript
if (entity.isVisible === false) {
  renderStats.skipped++;
  continue;
}
```

### 8.3 负颜色索引

**位置**: `types.ts:264-265`

负值表示图层关闭等状态，取绝对值：
```typescript
if (ci < 0) ci = Math.abs(ci);
```

---

## 9. 总结

### 9.1 颜色处理统一性

✅ **所有实体**都通过 `getEntityColor()` 统一处理颜色  
✅ **所有 Drawer**都继承 `BaseDrawer.getEntityColor()`  
✅ **BYBLOCK 继承**通过 `context.inheritedColor` 传递  
✅ **图层颜色**通过 `context.layers` 传递  

### 9.2 颜色优先级（最终）

1. **单色模式**（如果启用）
2. **实体真彩色** (`trueColor`)
3. **实体 BGR 颜色** (`color` → RGB)
4. **颜色索引**:
   - `256` (BYLAYER) → 图层颜色
   - `0` (BYBLOCK) → 继承色 → 图层颜色
   - `1-255` (ACI) → 索引映射
5. **图层颜色**
6. **默认白色**

### 9.3 关键文件

- `types.ts`: 核心颜色处理函数
- `BaseDrawer.ts`: 所有 Drawer 的基类，提供统一颜色接口
- `ViewportDraw.ts`: 管理 DrawContext 和继承颜色传递
- `InsertDrawer.ts`: 块插入的颜色继承
- `DimensionDrawer.ts`: 标注的颜色继承
- `TextMeshDrawer.ts`: 文字颜色处理

---

## 10. 验证检查清单

- [x] 普通实体（LINE、CIRCLE）颜色正确
- [x] BYLAYER 实体使用图层颜色
- [x] BYBLOCK 实体在块中继承父块颜色
- [x] 嵌套块的颜色继承正确
- [x] 标注实体颜色正确
- [x] 文字实体颜色正确
- [x] ACI 颜色索引映射正确
- [x] BGR → RGB 转换正确
- [x] 真彩色支持
- [x] 图层颜色优先级正确

---

**最后更新**: 2024-12-19  
**作者**: AI Assistant  
**版本**: 1.0

