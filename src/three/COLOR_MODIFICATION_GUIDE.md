# 颜色处理修改指南

## 快速修改指南

### 1. 修改颜色优先级顺序

**文件**: `types.ts`

**位置**: `getEntityColor()` 函数 (第 249-299 行)

**当前优先级**:
1. `trueColor` (真彩色)
2. `color` (BGR → RGB)
3. `colorIndex` (ACI/BYLAYER/BYBLOCK)
4. 图层颜色
5. 默认白色

**修改示例** - 如果想让图层颜色优先于 BGR 颜色:
```typescript
export function getEntityColor(entity: DwgEntity, context?: DrawContext): number {
  // 1. 真彩色（不变）
  if (typeof entity.trueColor === 'number' && isValidRgbColor(entity.trueColor)) {
    return entity.trueColor;
  }

  // 2. 图层颜色（提前）
  if (context?.layers) {
    const layerColor = getLayerColor(entity.layer, context.layers);
    if (layerColor !== 0xffffff) {  // 如果图层有颜色
      return layerColor;
    }
  }

  // 3. BGR 颜色（后移）
  if (typeof entity.color === 'number') {
    return bgrToRgb(entity.color);
  }

  // ... 其余逻辑
}
```

---

### 2. 修改 BYBLOCK 继承逻辑

**文件**: `types.ts`

**位置**: `getEntityColor()` 函数中的 BYBLOCK 处理 (第 275-284 行)

**当前逻辑**: 继承色 → 图层色 → 白色

**修改示例** - 如果想让 BYBLOCK 在没有继承色时使用特定颜色:
```typescript
// 0 = BYBLOCK
if (ci === 0) {
  if (typeof context?.inheritedColor === 'number') {
    return context.inheritedColor;
  }
  // 修改：使用黑色而不是图层色
  return 0x000000;  // 或 return getLayerColor(entity.layer, context.layers);
}
```

---

### 3. 修改默认颜色

**文件**: `types.ts`

**位置**: `getEntityColor()` 函数末尾 (第 298 行)

**当前默认**: `0xffffff` (白色)

**修改示例**:
```typescript
// 5. 最后兜底为黑色
return 0x000000;  // 或 0x888888 (灰色)
```

---

### 4. 修改特定实体的颜色处理

#### 4.1 修改文字颜色

**文件**: `TextMeshDrawer.ts`

**位置**: `drawText()` 和 `drawMText()` 方法

**修改示例** - 强制文字使用特定颜色:
```typescript
private drawText(entity: DwgTextEntity): THREE.Object3D | null {
  // 修改：强制使用黑色
  const color = 0x000000;  // 或 this.getEntityColor(entity);
  const result = this.textMesh.create(
    entity.text, 
    offsetPosition, 
    fontSize, 
    color,
    // ...
  );
  return result;
}
```

#### 4.2 修改填充颜色

**文件**: `HatchDrawer.ts`

**位置**: `getHatchColor()` 方法 (第 76-80 行)

**修改示例**:
```typescript
private getHatchColor(entity: DwgHatchEntity): number {
  // 修改：使用实体颜色，默认白色
  return this.getEntityColor(entity, 0xffffff);  // 原来是 0x888888
}
```

#### 4.3 修改线条颜色

**文件**: `LineDrawer.ts`, `CircleDrawer.ts`, `ArcDrawer.ts` 等

**位置**: `draw()` 方法

**修改示例** - 在 LineDrawer 中强制使用红色:
```typescript
draw(entity: DwgLineEntity): THREE.Line {
  const start = this.scalePoint(entity.startPoint);
  const end = this.scalePoint(entity.endPoint);
  
  // 修改：强制红色
  const color = 0xff0000;  // 或 this.getEntityColor(entity);
  const line = this.createLineFromPoints([start, end], color);
  
  return line;
}
```

---

### 5. 修改块插入的颜色继承

**文件**: `InsertDrawer.ts`

**位置**: `drawBlockEntities()` 方法 (第 145-169 行)

**修改示例** - 如果想让块内实体不继承父块颜色:
```typescript
private drawBlockEntities(
  group: THREE.Object3D,
  blockEntities: DwgEntity[],
  parentEntity: DwgInsertEntity,
  _basePoint?: DwgPoint3D
): void {
  // 修改：不传递继承颜色
  // const inheritedColor = getEntityColor(parentEntity, this.context);
  
  for (const blockEntity of blockEntities) {
    let instance: THREE.Object3D | null = null;
    
    if (this.delegate) {
      // 修改：不传递 inheritedColor
      instance = this.delegate.createEntityObject(blockEntity);  // 移除 inheritedColor
    }
    
    if (instance) {
      group.add(instance);
    }
  }
}
```

---

### 6. 修改标注颜色

**文件**: `DimensionDrawer.ts`

**位置**: `draw()` 方法 (第 35-77 行)

**修改示例** - 强制标注使用特定颜色:
```typescript
draw(entity: DwgEntity): THREE.Group {
  const group = new THREE.Group();
  
  try {
    const blockName = (entity as any).name;
    if (blockName && this.blocks.has(blockName)) {
      // 修改：强制使用红色作为继承色
      const inheritedColor = 0xff0000;  // 或 getEntityColor(entity, this.context);
      
      const blockEntities = this.blocks.get(blockName);
      if (blockEntities && blockEntities.length > 0) {
        for (const blockEntity of blockEntities) {
          const obj = this.createEntityObject(blockEntity, inheritedColor);
          if (obj) group.add(obj);
        }
        return group;
      }
    }
    // ...
  }
}
```

---

### 7. 修改图层颜色处理

**文件**: `types.ts`

**位置**: `getLayerColor()` 函数 (第 217-243 行)

**修改示例** - 如果图层没有颜色时使用实体颜色:
```typescript
export function getLayerColor(layerName: string, layers?: Map<string, LayerInfo>): number {
  if (!layers) return 0xffffff;
  const layer = layers.get(layerName);
  if (!layer) return 0xffffff;

  // ... 现有逻辑 ...

  // 修改：如果没有图层颜色，返回 null 而不是白色
  // 这样调用方可以决定使用什么颜色
  return null;  // 需要修改返回类型为 number | null
}
```

---

### 8. 添加新的颜色处理规则

**文件**: `types.ts`

**位置**: `getEntityColor()` 函数

**修改示例** - 添加基于实体类型的特殊颜色规则:
```typescript
export function getEntityColor(entity: DwgEntity, context?: DrawContext): number {
  // 新增：特定类型实体使用特定颜色
  if (entity.type === 'TEXT' || entity.type === 'MTEXT') {
    // 文字实体强制使用黑色
    return 0x000000;
  }
  
  if (entity.type === 'DIMENSION') {
    // 标注实体强制使用蓝色
    return 0x0000ff;
  }
  
  // ... 原有逻辑 ...
}
```

---

### 9. 修改 ACI 颜色映射

**文件**: `types.ts`

**位置**: `getColorFromIndex()` 函数 (第 158-172 行)

**修改示例** - 添加更多 ACI 颜色:
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
    8: 0x808080, // Gray (新增)
    9: 0xc0c0c0, // Light Gray (新增)
    // ... 添加更多颜色
  };
  return aciColors[colorIndex] || 0xffffff;
}
```

---

### 10. 修改 BGR 转 RGB 逻辑

**文件**: `types.ts`

**位置**: `bgrToRgb()` 函数 (第 148-153 行)

**修改示例** - 如果发现 BGR 转换有问题:
```typescript
export function bgrToRgb(bgr: number): number {
  // 如果发现转换有问题，可以添加调试日志
  const b = (bgr >> 16) & 0xff;
  const g = (bgr >> 8) & 0xff;
  const r = bgr & 0xff;
  const rgb = (r << 16) | (g << 8) | b;
  
  // 调试：打印转换过程
  console.log(`BGR: 0x${bgr.toString(16)} -> RGB: 0x${rgb.toString(16)}`);
  
  return rgb;
}
```

---

## 常见修改场景

### 场景 1: 所有实体使用图层颜色

**修改位置**: `types.ts` - `getEntityColor()`

```typescript
export function getEntityColor(entity: DwgEntity, context?: DrawContext): number {
  // 优先使用图层颜色
  if (context?.layers) {
    const layerColor = getLayerColor(entity.layer, context.layers);
    if (layerColor !== 0xffffff) {
      return layerColor;
    }
  }
  
  // 其余逻辑...
}
```

### 场景 2: 禁用 BYBLOCK 继承

**修改位置**: `types.ts` - `getEntityColor()` 中的 BYBLOCK 处理

```typescript
// 0 = BYBLOCK
if (ci === 0) {
  // 禁用继承，直接使用图层颜色
  if (context?.layers) {
    return getLayerColor(entity.layer, context.layers);
  }
  return 0xffffff;
}
```

### 场景 3: 强制所有实体使用单色

**修改位置**: `BaseDrawer.ts` - `getEntityColor()`

```typescript
protected getEntityColor(entity: DwgEntity, defaultColor: number = 0x000000): number {
  // 强制单色模式
  return 0x000000;  // 黑色
  // 或
  // return 0xffffff;  // 白色
}
```

### 场景 4: 根据背景色调整文字颜色

**修改位置**: `TextMeshDrawer.ts`

```typescript
private drawText(entity: DwgTextEntity): THREE.Object3D | null {
  let color = this.getEntityColor(entity);
  
  // 如果背景是浅色，文字用黑色；否则用白色
  if (this.context.backgroundColor) {
    const isLight = isLightBackground(this.context.backgroundColor);
    color = isLight ? 0x000000 : 0xffffff;
  }
  
  const result = this.textMesh.create(
    entity.text, 
    offsetPosition, 
    fontSize, 
    color,
    // ...
  );
  return result;
}
```

---

## 修改后的测试检查清单

修改颜色处理逻辑后，请检查：

- [ ] 普通实体（LINE、CIRCLE）颜色是否正确
- [ ] BYLAYER 实体是否使用图层颜色
- [ ] BYBLOCK 实体在块中是否正确继承
- [ ] 嵌套块的颜色继承是否正确
- [ ] 标注实体颜色是否正确
- [ ] 文字实体颜色是否正确
- [ ] 真彩色实体是否正确显示
- [ ] 默认颜色是否符合预期

---

## 调试技巧

### 1. 添加颜色调试日志

在 `getEntityColor()` 中添加:
```typescript
export function getEntityColor(entity: DwgEntity, context?: DrawContext): number {
  const color = /* ... 计算逻辑 ... */;
  
  // 调试日志
  if (entity.type === 'LINE' || entity.type === 'TEXT') {
    console.log(`[Color] ${entity.type} colorIndex=${entity.colorIndex}, color=0x${color.toString(16)}`);
  }
  
  return color;
}
```

### 2. 检查继承颜色传递

在 `ViewportDraw.createEntityFromDrawers()` 中添加:
```typescript
private createEntityFromDrawers(entity: any, inheritedColor?: number): THREE.Object3D | null {
  if (inheritedColor !== undefined) {
    console.log(`[Color] Setting inheritedColor=0x${inheritedColor.toString(16)} for ${entity.type}`);
  }
  // ...
}
```

### 3. 验证图层颜色

在 `getLayerColor()` 中添加:
```typescript
export function getLayerColor(layerName: string, layers?: Map<string, LayerInfo>): number {
  const color = /* ... 计算逻辑 ... */;
  console.log(`[Color] Layer "${layerName}" color=0x${color.toString(16)}`);
  return color;
}
```

---

**最后更新**: 2024-12-19  
**版本**: 1.0

