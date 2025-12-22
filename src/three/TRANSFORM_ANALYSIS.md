# DWG 变换处理分析：Database vs SVG vs Three.js

## 1. Database 数据结构

### DwgInsertEntity
```typescript
interface DwgInsertEntity {
  insertionPoint: DwgPoint3D  // 插入点（OCS坐标）
  xScale: number              // X缩放
  yScale: number              // Y缩放
  zScale: number              // Z缩放
  rotation: number            // 旋转角度（弧度）
  extrusionDirection: DwgPoint3D  // 挤出方向（OCS）
}
```

### DwgBlockRecordTableEntry
```typescript
interface DwgBlockRecordTableEntry {
  basePoint: DwgPoint3D       // 块基点
  entities: DwgEntity[]       // 块内实体（坐标相对于基点）
}
```

**关键点**：
- 块内实体的坐标是**相对于块基点**的
- INSERT 的 `insertionPoint` 是**世界坐标**（OCS）
- 块基点定义了块内实体的局部坐标系原点

---

## 2. SVG 转换器实现

### 2.1 INSERT 变换（svgConverter.ts:543-564）

```typescript
private insert(entity: DwgInsertEntity): BBoxAndElement | null {
  const block = this.blockMap.get(entity.name)
  if (block) {
    const insertionPoint = entity.insertionPoint
    // const basePoint = block.bbox.min  // ← 被注释掉，不使用基点偏移
    const rotation = entity.rotation * (180 / Math.PI)  // 弧度转角度
    const transform = `translate(${insertionPoint.x},${insertionPoint.y}) rotate(${rotation}) scale(${entity.xScale},${entity.yScale})`
    return {
      bbox: newBBox,
      element: `<use href="#${entity.name}" transform="${transform}" />`
    }
  }
}
```

**SVG 变换顺序**（从右到左应用）：
1. `scale(xScale, yScale)` - 缩放
2. `rotate(rotation)` - 旋转（绕原点）
3. `translate(insertionPoint)` - 平移

**关键发现**：
- ❌ **不使用基点偏移**：`basePoint` 被注释掉
- ✅ 块内实体坐标已经是相对于基点的
- ✅ 变换顺序：scale → rotate → translate

### 2.2 BLOCK 定义（svgConverter.ts:566-607）

```typescript
private block(block: DwgBlockRecordTableEntry, dwg: DwgDatabase): BBoxAndElement | null {
  const entities = block.entities
  const { bbox, elements } = entities.reduce((acc, entity) => {
    // 直接绘制实体，不应用基点偏移
    const boundsAndElement = this.entityToBoundsAndElement(entity)
    // ...
  }, { bbox: new Box2D(), elements: [] })
  
  return {
    bbox,
    element: `<g id="${block.name}">${elements.join('\n')}</g>`
  }
}
```

**关键发现**：
- ✅ 块定义中，实体直接绘制，**不应用基点偏移**
- ✅ 块内实体坐标已经是相对于基点的

---

## 3. Three.js 当前实现问题

### 3.1 createInsertTransformMatrix 的问题

**当前实现**（types.ts:411-473）：
```typescript
export function createInsertTransformMatrix(
  insertionPoint,
  basePoint,
  scale,
  rotation,
  extrusionDirection,
  scaleFactor,
  applyBasePointOffset: boolean = false  // ← 默认 false
): THREE.Matrix4 {
  // 变换顺序：
  // basePointOffset -> scale -> rotate -> OCS -> translate
  
  matrix
    .multiply(translationMatrix)      // translate
    .multiply(ocsMatrix)               // OCS
    .multiply(rotationMatrix)          // rotate
    .multiply(scaleMatrix)             // scale
    .multiply(basePointOffsetMatrix);  // basePoint offset
}
```

**问题**：
1. ✅ `applyBasePointOffset` 默认 false，符合 SVG 逻辑
2. ❌ 变换顺序与 SVG 不完全一致（多了 OCS）
3. ❌ 旋转中心可能不正确（SVG 绕原点，Three.js 绕原点）

### 3.2 InsertDrawer 的问题

**当前实现**（InsertDrawer.ts:112-135）：
```typescript
const transformMatrix = createInsertTransformMatrix(
  entity.insertionPoint,
  basePoint,
  { x: entity.xScale || 1, y: entity.yScale || 1, z: entity.zScale || 1 },
  entity.rotation || 0,
  entity.extrusionDirection,
  this.scaleFactor
  // applyBasePointOffset 未传递，默认 false
);

// 累积变换
if (this.context.accumulatedTransform) {
  finalTransformMatrix = new THREE.Matrix4();
  finalTransformMatrix.multiplyMatrices(this.context.accumulatedTransform, transformMatrix);
}
```

**问题**：
1. ✅ 不使用基点偏移（符合 SVG）
2. ❌ 累积变换的顺序可能有问题
3. ❌ 嵌套块的变换可能不正确

---

## 4. 修复方案

### 4.1 修复变换顺序以匹配 SVG

SVG: `scale → rotate → translate`
Three.js 应该：`scale → rotate → OCS → translate`（如果有 OCS）

**修复后的 createInsertTransformMatrix**：
```typescript
// 变换顺序（从右到左）：
// scale → rotate → OCS → translate
matrix
  .multiply(translationMatrix)      // translate (最后)
  .multiply(ocsMatrix)              // OCS
  .multiply(rotationMatrix)         // rotate
  .multiply(scaleMatrix);          // scale (首先)
// 注意：不应用 basePointOffset（与 SVG 一致）
```

### 4.2 修复嵌套块的变换累积

**问题**：嵌套块的变换需要正确累积

**修复方案**：
- 在 `drawBlockEntities` 中，计算父块的变换矩阵
- 传递给嵌套的 INSERT，使其变换相对于父块
- 最终变换 = 父块变换 × 子块变换

### 4.3 修复旋转中心

**SVG**: `rotate(rotation)` 绕原点旋转
**Three.js**: `makeRotationZ(rotation)` 也绕原点旋转

**问题**：如果块有基点偏移，旋转中心可能不对

**解决方案**：不使用基点偏移（与 SVG 一致），所以旋转中心是正确的

---

## 5. 关键差异总结

| 特性 | Database | SVG | Three.js (当前) | Three.js (应该) |
|------|----------|-----|-----------------|-----------------|
| 基点偏移 | ✅ 有 basePoint | ❌ 不使用 | ❌ 不使用 (✅) | ❌ 不使用 |
| 变换顺序 | - | scale→rotate→translate | scale→rotate→OCS→translate | scale→rotate→OCS→translate (✅) |
| 嵌套块 | - | ✅ 支持 | ⚠️ 部分支持 | ✅ 完全支持 |
| OCS 变换 | ✅ 有 | ❌ 无（2D） | ✅ 有 | ✅ 有 |

---

## 6. 需要修复的问题

1. ✅ **基点偏移**：已正确（不使用）
2. ⚠️ **变换顺序**：需要验证是否正确
3. ⚠️ **嵌套块累积**：需要确保正确累积
4. ⚠️ **旋转中心**：需要确保绕正确中心旋转

---

**最后更新**: 2024-12-19

