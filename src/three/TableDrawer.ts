import * as THREE from 'three';
import { DwgEntity, DwgTableEntity, DwgTableCell } from '../database';
import { BaseDrawer } from './BaseDrawer';
import { DrawContext } from './types';

/**
 * 表格绘制器
 * 绘制 DwgTableEntity 类型的实体（ACAD_TABLE）
 * 支持单元格边框和文本内容
 */
export class TableDrawer extends BaseDrawer<DwgTableEntity> {
  // 默认字体配置
  private fontFamily: string = '"Microsoft YaHei", "SimHei", "Arial", sans-serif';
  private lineHeightMultiplier: number = 1.35;

  constructor(context: DrawContext) {
    super(context);
  }

  canDraw(entity: DwgEntity): entity is DwgTableEntity {
    return entity.type === 'ACAD_TABLE';
  }

  draw(entity: DwgTableEntity): THREE.Group | null {
    const {
      rowCount,
      columnCount,
      rowHeightArr,
      columnWidthArr,
      startPoint,
      cells
    } = entity;

    if (!cells || cells.length === 0) {
      return null;
    }

    const group = new THREE.Group();
    group.name = 'Table';

    const originX = startPoint.x;
    const originY = startPoint.y;
    const originZ = startPoint.z || 0;

    // 获取表格颜色
    const color = this.getEntityColor(entity);
    const lineWidth = this.getEntityLineWidth(entity);

    // 计算单元格矩形
    interface CellRect {
      x: number;
      y: number;
      width: number;
      height: number;
      cell: DwgTableCell;
      row: number;
      col: number;
    }

    const cellRects: CellRect[] = [];

    for (let row = 0, y = originY; row < rowCount; row++) {
      const height = rowHeightArr[row] || 10; // 默认高度
      let x = originX;
      for (let col = 0; col < columnCount; col++) {
        const cellIndex = row * columnCount + col;
        const cell = cells[cellIndex];
        const width = columnWidthArr[col] || 10; // 默认宽度

        if (cell) {
          cellRects.push({ x, y, width, height, cell, row, col });
        }
        x += width;
      }
      y += height;
    }

    // 绘制每个单元格
    cellRects.forEach(({ x, y, width, height, cell }) => {
      // 绘制边框
      const borderGroup = this.drawCellBorders(x, y, width, height, cell, originZ, color, lineWidth);
      if (borderGroup) {
        group.add(borderGroup);
      }

      // 绘制文本
      if (cell.text && cell.text.trim()) {
        const textMesh = this.drawCellText(x, y, width, height, cell, originZ, color);
        if (textMesh) {
          group.add(textMesh);
        }
      }
    });

    // 应用挤出方向
    if (entity.extrusionDirection) {
      this.applyExtrusionDirection(group, entity.extrusionDirection);
    }

    return group;
  }

  /**
   * 绘制单元格边框
   */
  private drawCellBorders(
    x: number,
    y: number,
    width: number,
    height: number,
    cell: DwgTableCell,
    z: number,
    color: number,
    lineWidth: number
  ): THREE.Group | null {
    const group = new THREE.Group();
    group.name = 'CellBorders';

    const scaleFactor = this.scaleFactor;

    // 缩放坐标
    const sx = x * scaleFactor;
    const sy = y * scaleFactor;
    const sw = width * scaleFactor;
    const sh = height * scaleFactor;
    const sz = z * scaleFactor;

    // 顶部边框
    if (cell.topBorderVisibility) {
      const points = [
        new THREE.Vector3(sx, sy, sz),
        new THREE.Vector3(sx + sw, sy, sz)
      ];
      const line = this.createMeshLineFromPoints(points, color, lineWidth);
      line.name = 'TopBorder';
      group.add(line);
    }

    // 底部边框
    if (cell.bottomBorderVisibility) {
      const points = [
        new THREE.Vector3(sx, sy + sh, sz),
        new THREE.Vector3(sx + sw, sy + sh, sz)
      ];
      const line = this.createMeshLineFromPoints(points, color, lineWidth);
      line.name = 'BottomBorder';
      group.add(line);
    }

    // 左侧边框
    if (cell.leftBorderVisibility) {
      const points = [
        new THREE.Vector3(sx, sy, sz),
        new THREE.Vector3(sx, sy + sh, sz)
      ];
      const line = this.createMeshLineFromPoints(points, color, lineWidth);
      line.name = 'LeftBorder';
      group.add(line);
    }

    // 右侧边框
    if (cell.rightBorderVisibility) {
      const points = [
        new THREE.Vector3(sx + sw, sy, sz),
        new THREE.Vector3(sx + sw, sy + sh, sz)
      ];
      const line = this.createMeshLineFromPoints(points, color, lineWidth);
      line.name = 'RightBorder';
      group.add(line);
    }

    return group.children.length > 0 ? group : null;
  }

  /**
   * 绘制单元格文本
   */
  private drawCellText(
    x: number,
    y: number,
    width: number,
    height: number,
    cell: DwgTableCell,
    z: number,
    color: number
  ): THREE.Mesh | null {
    const text = cell.text?.trim();
    if (!text) return null;

    const scaleFactor = this.scaleFactor;
    
    // 计算文本位置（单元格中心）
    const textX = (x + width / 2) * scaleFactor;
    const textY = (y + height / 2) * scaleFactor;
    const textZ = z * scaleFactor;

    // 获取文本高度
    const textHeight = (cell.textHeight || height * 0.5) * scaleFactor;
    const fontSize = Math.max(textHeight, 8);

    // 创建文本网格
    return this.createTextMesh(
      text,
      new THREE.Vector3(textX, textY, textZ),
      fontSize,
      color,
      cell.rotation || 0
    );
  }

  /**
   * 创建文字网格（支持中文）
   */
  private createTextMesh(
    text: string,
    position: THREE.Vector3,
    fontSize: number,
    color: number,
    rotation: number = 0
  ): THREE.Mesh | null {
    if (!text || !text.trim()) {
      return null;
    }

    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return null;

      // 使用高分辨率 Canvas（DPI缩放）
      const dpiScale = 2;
      const scaledFontSize = Math.max(fontSize * dpiScale, 12);
      const fontString = `${Math.round(scaledFontSize)}px ${this.fontFamily}`;

      // 设置字体并精确测量文字尺寸
      context.font = fontString;
      const lines = text.split('\n');
      const lineHeight = scaledFontSize * this.lineHeightMultiplier;

      // 精确测量每行宽度
      const lineWidths = lines.map(line => {
        const metrics = context.measureText(line);
        return metrics.width;
      });
      const maxWidth = Math.max(...lineWidths, 1);

      // 计算文字实际高度
      const totalHeight = lines.length * lineHeight;

      // 设置 Canvas 尺寸，添加适当的边距
      const paddingX = Math.max(4, scaledFontSize * 0.2);
      const paddingY = Math.max(4, scaledFontSize * 0.3);
      canvas.width = Math.ceil(maxWidth + paddingX * 2);
      canvas.height = Math.ceil(totalHeight + paddingY * 2);

      // 清除画布（透明背景）
      context.clearRect(0, 0, canvas.width, canvas.height);

      // 重新设置字体（因为调整 Canvas 尺寸后会重置）
      context.font = fontString;

      // 设置字体颜色
      const textColor = this.colorToHex(color);
      context.fillStyle = textColor;

      // 设置抗锯齿
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';

      // 设置文本对齐（居中）
      context.textAlign = 'center';
      context.textBaseline = 'middle';

      // 绘制每行文字
      const startY = paddingY + lineHeight / 2;
      const centerX = canvas.width / 2;

      lines.forEach((line, index) => {
        const lineY = startY + index * lineHeight;
        context.fillText(line, centerX, lineY);
      });

      // 创建纹理
      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.needsUpdate = true;

      // 创建材质
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.05,
        side: THREE.DoubleSide,
        depthWrite: false
      });


      // 计算网格尺寸
      const meshWidth = (canvas.width / dpiScale);
      const meshHeight = (canvas.height / dpiScale);

      // 创建几何体
      const geometry = new THREE.PlaneGeometry(meshWidth, meshHeight);

      // 创建网格
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = 'TableText';

      // 设置位置（居中对齐）
      mesh.position.copy(position);

      // 设置旋转
      if (rotation !== 0) {
        mesh.rotation.z = rotation;
      }

      return mesh;
    } catch (error) {
      console.warn('TableDrawer: Failed to create text mesh:', error);
      return null;
    }
  }

  /**
   * 将数字颜色值转换为十六进制字符串
   */
  private colorToHex(color: number): string {
    return '#' + color.toString(16).padStart(6, '0');
  }
}
