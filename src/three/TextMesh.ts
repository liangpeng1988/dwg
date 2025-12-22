import * as THREE from 'three';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { Font } from 'three/examples/jsm/loaders/FontLoader.js';

// 声明可能存在的全局变量 SMART
declare const SMART: { fontJSON?: any } | undefined;

/**
 * TextMesh 类用于创建三维文字网格
 * 提供统一的文字渲染接口，支持多种对齐方式和样式配置
 */
export class TextMesh {
  private scaleFactor: number;
  private font: Font | null = null;
  private fontLoaded: boolean = false;

  constructor(scaleFactor: number = 1) {
    this.scaleFactor = scaleFactor;
    this.loadFont();
  }

  /**
   * 加载字体
   */
  private loadFont(): void {
    try {
      // 首先尝试使用全局定义的字体
      if (typeof SMART !== 'undefined' && SMART.fontJSON) {
        this.font = this.parseFont(SMART.fontJSON);
        if (this.font) {
          this.fontLoaded = true;
          return;
        }
      }
      
      // 尝试使用 window 上的全局字体
      if (typeof window !== 'undefined' && (window as any).fontJSON) {
        this.font = this.parseFont((window as any).fontJSON);
        if (this.font) {
          this.fontLoaded = true;
          return;
        }
      }
      this.fontLoaded = false;
      this.font = null;
    } catch (error) {
      this.fontLoaded = false;
      this.font = null;
    }
  }

  /**
   * 解析字体数据为 Font 对象
   */
  private parseFont(fontData: any): Font | null {
    try {
      // 如果已经是 Font 对象且有有效的 generateShapes 方法
      if (fontData instanceof Font && typeof fontData.generateShapes === 'function') {
        // 验证 Font 对象是否真正可用
        try {
          const testShapes = fontData.generateShapes('T', 1);
          if (Array.isArray(testShapes)) {
            return fontData;
          }
        } catch {
          return null;
        }
      }
      // 如果是 JSON 数据，验证它是否是有效的字体数据
      if (fontData && typeof fontData === 'object') {
        // 检查必须的字体属性
        if (!fontData.glyphs || typeof fontData.glyphs !== 'object') {
          return null;
        }
        if (typeof fontData.resolution !== 'number') {
          return null;
        }
        
        const font = new Font(fontData);
        // 验证创建的 Font 是否可用
        if (typeof font.generateShapes === 'function') {
          try {
            const testShapes = font.generateShapes('T', 1);
            if (Array.isArray(testShapes)) {
              return font;
            }
          } catch {
            return null;
          }
        }
      }
      return null;
    } catch (error) {
      console.warn('Failed to parse font data:', error);
      return null;
    }
  }

  /**
   * 检查是否有有效的字体可用
   */
  private hasValidFont(): boolean {
    if (this.font === null) {
      return false;
    }
    // 双重检查：确保 generateShapes 是函数
    if (typeof this.font.generateShapes !== 'function') {
      return false;
    }
    return true;
  }

  /**
   * 处理文本编码，确保正确显示中文等字符
   * @param text 原始文本
   * @returns 处理后的文本
   */
  private processTextEncoding(text: string): string {
    // 如果文本已经是正确的UTF-8编码，直接返回
    if (this.isUtf8Encoded(text)) {
      return text;
    }
    
    // 尝试不同的编码转换
    try {
      // 尝试解码为UTF-8
      const decoded = decodeURIComponent(escape(text));
      return decoded;
    } catch (e) {
      // 如果解码失败，返回原始文本
      console.warn('Text encoding processing failed, using original text:', e);
      return text;
    }
  }

  /**
   * 检查文本是否为UTF-8编码
   * @param text 文本
   * @returns 是否为UTF-8编码
   */
  private isUtf8Encoded(text: string): boolean {
    try {
      // 尝试编码再解码，看是否相等
      return encodeURIComponent(decodeURIComponent(encodeURIComponent(text))) === encodeURIComponent(text);
    } catch (e) {
      return false;
    }
  }

  /**
   * 创建文字网格
   * @param text 文字内容
   * @param position 位置
   * @param fontSize 字体大小
   * @param color 颜色
   * @param halign 水平对齐 (0=left, 1=center, 2=right)
   * @param valign 垂直对齐 (0=baseline, 1=bottom, 2=middle, 3=top)
   * @param rotation 旋转角度（弧度）
   * @returns THREE.Mesh | THREE.Sprite | null
   */
  create(
    text: string, 
    position: THREE.Vector3, 
    fontSize: number, 
    color?: number,
    halign: number = 0,
    valign: number = 0,
    rotation: number = 0
  ): THREE.Mesh | THREE.Sprite | null {
    // 处理可能的编码问题，确保文本正确显示
    const processedText = this.processTextEncoding(text);
    
    // 如果没有有效字体，使用 Canvas 文字精灵作为备选方案
    if (!this.hasValidFont()) {
      const sprite = this.createTextSprite(processedText, position, fontSize, color, halign, valign, rotation);
      return sprite;
    }

    try {
      // 创建文字几何体
      const geometry = new TextGeometry(processedText, {
        font: this.font!,
        size: fontSize,
        height: 0.01 * fontSize, // 减小文字厚度以减少破面
        curveSegments: 8, // 增加曲线分段数以提高质量
        bevelEnabled: false
      });

      // 计算几何体的边界框以支持对齐
      geometry.computeBoundingBox();
      // 计算法线以改善光照效果和减少破面
      geometry.computeVertexNormals();
      const boundingBox = geometry.boundingBox!;

      // 创建材质
      const material = new THREE.MeshBasicMaterial({ 
        color: color != null ? color : 0x000000,
        side: THREE.DoubleSide,
        // 解决破面问题的配置
        depthTest: true,
        depthWrite: true,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1
      });

      const textMesh = new THREE.Mesh(geometry, material);

      // 计算偏移量，根据对齐方式调整位置
      let offsetX = 0;
      let offsetY = 0;
      
      // 水平对齐
      switch (halign) {
        case 0: // Left
          offsetX = -boundingBox.min.x;
          break;
        case 1: // Center
          offsetX = -(boundingBox.min.x + boundingBox.max.x) / 2;
          break;
        case 2: // Right
          offsetX = -boundingBox.max.x;
          break;
        default:
          offsetX = -boundingBox.min.x; // 默认左对齐
      }
      
      // 垂直对齐
      switch (valign) {
        case 0: // Baseline
          offsetY = 0;
          break;
        case 1: // Bottom
          offsetY = -boundingBox.min.y;
          break;
        case 2: // Middle
          offsetY = -(boundingBox.min.y + boundingBox.max.y) / 2;
          break;
        case 3: // Top
          offsetY = -boundingBox.max.y;
          break;
        default:
          offsetY = -boundingBox.min.y; // 默认底部对齐
      }
      
      // 应用偏移
      textMesh.position.set(
        position.x + offsetX,
        position.y + offsetY,
        position.z
      );
      
      // 应用旋转
      if (rotation) {
        textMesh.rotation.z = rotation;
      }

      return textMesh;
    } catch (error) {
      console.error('Error creating text mesh, falling back to sprite:', error);
      // 使用 Canvas 文字精灵作为备选方案
      return this.createTextSprite(processedText, position, fontSize, color, halign, valign, rotation);
    }
  }

  /**
   * 创建 Canvas 文字精灵（备选方案）
   * 当没有有效的 3D 字体时使用
   */
  private createTextSprite(
    text: string,
    position: THREE.Vector3,
    fontSize: number,
    color?: number,
    halign: number = 0,
    valign: number = 0,
    rotation: number = 0
  ): THREE.Sprite {
    // 确保文本不为空
    const displayText = text || ' ';
    
    // 创建 Canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    
    // 设置字体 - 使用固定的像素大小以获得清晰的文本
    const fontSizePx = 64; // 固定 64px 以获得清晰的纹理
    context.font = `bold ${fontSizePx}px Arial, sans-serif`;
    
    // 测量文本宽度
    const metrics = context.measureText(displayText);
    const textWidth = Math.max(metrics.width, 20);
    const textHeight = fontSizePx * 1.4;
    
    // 设置 Canvas 大小（添加边距）
    const padding = 16;
    canvas.width = Math.ceil(textWidth + padding * 2);
    canvas.height = Math.ceil(textHeight + padding * 2);
    
    // 重新设置字体（因为修改 canvas 大小会重置 context）
    context.font = `bold ${fontSizePx}px Arial, sans-serif`;
    
    // 设置填充颜色 - 确保可见
    const colorHex = color != null ? color : 0x000000;
    // 如果颜色是黑色或非常暗，使用深灰色以确保可见
    let fillColor = `#${colorHex.toString(16).padStart(6, '0')}`;
    if (colorHex === 0x000000 || colorHex < 0x333333) {
      fillColor = '#333333'; // 使用深灰色而不是纯黑色
    }
    context.fillStyle = fillColor;
    context.textBaseline = 'top';
    context.textAlign = 'left';
    
    // 绘制文本
    context.fillText(displayText, padding, padding);
    
    // 创建纹理
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    
    // 创建精灵材质
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      sizeAttenuation: true,
      depthTest: true,
      depthWrite: false
    });
    
    // 创建精灵
    const sprite = new THREE.Sprite(material);
    
    // 计算精灵尺寸 - 确保足够大可见
    const aspect = canvas.width / canvas.height;
    // 使用 fontSize 作为基准，确保最小尺寸
    const spriteHeight = Math.max(fontSize * this.scaleFactor * 2, 5); // 最小高度 5
    const spriteWidth = spriteHeight * aspect;
    sprite.scale.set(spriteWidth, spriteHeight, 1);
    
    // 计算偏移量根据对齐方式
    let offsetX = 0;
    let offsetY = 0;
    
    // 水平对齐
    switch (halign) {
      case 0: // Left
        offsetX = spriteWidth / 2;
        break;
      case 1: // Center
        offsetX = 0;
        break;
      case 2: // Right
        offsetX = -spriteWidth / 2;
        break;
    }
    
    // 垂直对齐
    switch (valign) {
      case 0: // Baseline
      case 1: // Bottom
        offsetY = spriteHeight / 2;
        break;
      case 2: // Middle
        offsetY = 0;
        break;
      case 3: // Top
        offsetY = -spriteHeight / 2;
        break;
    }
    
    // 设置位置
    sprite.position.set(
      position.x + offsetX,
      position.y + offsetY,
      position.z + 0.1 // 稍微提高以避免 Z-fighting
    );
    
    // 精灵不支持 rotation.z，但可以通过 material.rotation 设置
    if (rotation) {
      material.rotation = rotation;
    }
    
    // 标记为文字精灵
    sprite.userData.isTextSprite = false;
    sprite.userData.text = displayText;
    sprite.userData.fontSize = fontSize;
    sprite.userData.color = colorHex;
    sprite.userData.halign = halign;
    sprite.userData.valign = valign;
    sprite.userData.rotation = rotation;
    sprite.userData.type = 'TEXT';
    return sprite;
  }



  /**
   * 创建简单的文字网格（用于占位符等简单场景）
   * @param text 文字内容
   * @param position 位置
   * @returns THREE.Mesh | THREE.Sprite | null
   */
  createSimple(text: string, position: { x?: number; y?: number; z?: number }): THREE.Mesh | THREE.Sprite | null {
    // 使用新的 create 方法创建简单文字
    const vectorPosition = new THREE.Vector3(
      position.x || 0,
      position.y || 0,
      position.z || 0
    );
    
    // 处理可能的编码问题
    const processedText = this.processTextEncoding(text);
    
    return this.create(processedText, vectorPosition, 1, 0x000000, 1, 2); // 居中对齐
  }



  /**
   * 提取 MTEXT 文本行（清理格式代码）
   * 参考 SVG 转换器的 extractMTextLines
   */
  extractMTextLines(mtext: string): string[] {
    // 处理可能的编码问题
    const processedText = this.processTextEncoding(mtext);
    
    return (
      processedText
        // 转换 Unicode 代码
        .replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, hex) =>
          String.fromCharCode(parseInt(hex, 16))
        )
        // 保留换行符
        .replace(/\\P/g, '\n')
        // 移除下划线、上划线
        .replace(/\\[LOlo]/g, '')
        // 移除字体规格
        .replace(/\\[Ff][^;\\]*?(?:\|[^;\\]*)*;/g, '')
        // 移除格式代码
        .replace(/\\[KkCcHhWwTtAa][^;\\]*;?/g, '')
        // 移除通用控制代码
        .replace(/\\[a-zA-Z]+;?/g, '')
        // 移除 AutoCAD %% 控制序列
        .replace(/%%([dp|c%])/gi, '')
        // 替换转义反斜杠
        .replace(/\\\\/g, '\\')
        // 替换不换行空格
        .replace(/\\~/g, '\u00A0')
        // 移除大括号
        .replace(/[{}]/g, '')
        // 按换行符分割
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
    );
  }
}

/**
 * 创建文字几何体的辅助函数
 * @param content 文字内容
 * @param size 字体大小
 * @param height 文字厚度
 * @param curveSegments 曲线上的点数
 * @param bevelEnabled 是否开启斜角
 * @param bevelThickness 斜角的深度
 * @param bevelSize 斜角与原始文本轮廓之间的延伸距离
 * @param bevelSegments 斜角的分段数
 */
export const createTextGeometry = function(
    content = 'text',
    size = 1,
    height = 0,
    curveSegments = 1,
    bevelEnabled = false,
    bevelThickness = 1,
    bevelSize = 1,
    bevelSegments = 1
): TextGeometry | THREE.BufferGeometry {
    // 注意：这里需要确保字体已加载
    // 在实际使用中，应该确保 SMART.fontJSON 已正确定义
    // 如果没有定义全局字体，则返回空几何体
    let font: Font | null = null;
    
    try {
      if (typeof SMART !== 'undefined' && SMART.fontJSON) {
        font = new Font(SMART.fontJSON);
      } else if (typeof window !== 'undefined' && (window as any).fontJSON) {
        font = new Font((window as any).fontJSON);
      }
    } catch (error) {
      console.warn('Failed to parse font data:', error);
    }
    
    // 检查字体是否可用
    if (!font || typeof font.generateShapes !== 'function') {
      console.warn('No valid font available for TextGeometry. Returning empty geometry.');
      // 返回一个空的 BufferGeometry
      return new THREE.BufferGeometry();
    }
    
    return new TextGeometry(content, {
        font: font,
        size: size,
        height: height,
        curveSegments: curveSegments,
        bevelEnabled: bevelEnabled,
        bevelThickness: bevelThickness,
        bevelSize: bevelSize,
        bevelSegments: bevelSegments
    });
}