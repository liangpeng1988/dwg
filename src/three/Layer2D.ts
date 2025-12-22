import * as THREE from 'three';
import type { LayerInfo } from './types';

/**
 * 2D 图层类
 * 管理图层的属性和行为，包括可见性、锁定状态、颜色等
 */
export class Layer2D {
  private name: string;
  private visible: boolean;
  private frozen: boolean;
  private locked: boolean;
  private color: number;
  private opacity: number;
  private lineWidth: number;
  private lineType: string;
  private objects: Set<THREE.Object3D>;
  private group: THREE.Group;

  constructor(layerInfo: LayerInfo) {
    this.name = layerInfo.name;
    this.visible = layerInfo.visible;
    this.frozen = layerInfo.frozen;
    this.locked = layerInfo.locked;
    // 优先使用TrueColor，其次使用color，最后使用默认黑色
    this.color = layerInfo.trueColor ?? layerInfo.color ?? 0x000000;
    this.opacity = 1.0;
    this.lineWidth = 1.0;
    this.lineType = 'CONTINUOUS';
    this.objects = new Set<THREE.Object3D>();
    
    // 创建一个 THREE.Group 来管理该图层的所有对象
    this.group = new THREE.Group();
    this.group.name = `layer_${this.name}`;
    this.group.visible = this.visible;
    console.log(`[Layer2D] Created layer ${this.name}, visible: ${this.visible}, group visible: ${this.group.visible}`);
  }

  /**
   * 获取图层名称
   */
  getName(): string {
    return this.name;
  }

  /**
   * 设置图层可见性
   */
  setVisible(visible: boolean): void {
    this.visible = visible;
    this.group.visible = visible;
    console.log(`[Layer2D] Set layer ${this.name} visible: ${visible}, group visible: ${this.group.visible}`);
    
    // 同时更新所有对象的可见性
    this.objects.forEach(obj => {
      obj.visible = visible;
    });
  }

  /**
   * 获取图层可见性
   */
  isVisible(): boolean {
    return this.visible;
  }

  /**
   * 设置图层冻结状态
   */
  setFrozen(frozen: boolean): void {
    this.frozen = frozen;
  }

  /**
   * 获取图层冻结状态
   */
  isFrozen(): boolean {
    return this.frozen;
  }

  /**
   * 设置图层锁定状态
   */
  setLocked(locked: boolean): void {
    this.locked = locked;
  }

  /**
   * 获取图层锁定状态
   */
  isLocked(): boolean {
    return this.locked;
  }

  /**
   * 设置图层颜色
   */
  setColor(color: number): void {
    this.color = color;
    
    // 更新所有对象的颜色
    this.objects.forEach(obj => {
      this.applyColorToObject(obj, color);
    });
  }

  /**
   * 获取图层颜色
   */
  getColor(): number {
    return this.color;
  }

  /**
   * 设置图层透明度
   */
  setOpacity(opacity: number): void {
    this.opacity = Math.max(0, Math.min(1, opacity)); // 限制在 0-1 范围内
    
    // 更新所有对象的透明度
    this.objects.forEach(obj => {
      this.applyOpacityToObject(obj, this.opacity);
    });
  }

  /**
   * 获取图层透明度
   */
  getOpacity(): number {
    return this.opacity;
  }

  /**
   * 设置图层线宽
   */
  setLineWidth(width: number): void {
    this.lineWidth = Math.max(0.1, width); // 限制最小线宽
    
    // 更新所有线条对象的线宽
    this.objects.forEach(obj => {
      this.applyLineWidthToObject(obj, this.lineWidth);
    });
  }

  /**
   * 获取图层线宽
   */
  getLineWidth(): number {
    return this.lineWidth;
  }

  /**
   * 设置图层线型
   */
  setLineType(type: string): void {
    this.lineType = type;
    
    // 更新所有线条对象的线型
    this.objects.forEach(obj => {
      this.applyLineTypeToObject(obj, type);
    });
  }

  /**
   * 获取图层线型
   */
  getLineType(): string {
    return this.lineType;
  }

  /**
   * 向图层添加对象
   */
  addObject(object: THREE.Object3D): void {
    if (!this.objects.has(object)) {
      this.objects.add(object);
      this.group.add(object);
      console.log(`[Layer2D] Added object to layer ${this.name}: ${object.constructor.name}, group children: ${this.group.children.length}`);
      
      // 应用图层的属性
      this.applyColorToObject(object, this.color);
      this.applyOpacityToObject(object, this.opacity);
      this.applyLineWidthToObject(object, this.lineWidth);
    }
  }

  /**
   * 从图层移除对象
   */
  removeObject(object: THREE.Object3D): boolean {
    if (this.objects.has(object)) {
      this.objects.delete(object);
      this.group.remove(object);
      return true;
    }
    return false;
  }

  /**
   * 获取图层中的所有对象
   */
  getObjects(): THREE.Object3D[] {
    return Array.from(this.objects);
  }

  /**
   * 获取图层对象数量
   */
  getObjectCount(): number {
    return this.objects.size;
  }

  /**
   * 获取图层的 THREE.Group 对象
   */
  getGroup(): THREE.Group {
    return this.group;
  }

  /**
   * 清空图层中的所有对象
   */
  clear(): void {
    // 释放所有对象的资源
    this.objects.forEach(obj => {
      this.disposeObject(obj);
      this.group.remove(obj);
    });
    this.objects.clear();
  }

  /**
   * 应用颜色到对象
   */
  private applyColorToObject(object: THREE.Object3D, color: number): void {
    let r = 0, g = 0, b = 0;
    if (typeof color === 'number') {
      b = color & 0xFF;
      g = (color >> 8) & 0xFF;
      r = (color >> 16) & 0xFF;
    }
    
    const threeColor = new THREE.Color(r / 255, g / 255, b / 255);
    
    if (object instanceof THREE.Mesh && object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach(mat => {
          if (mat instanceof THREE.MeshBasicMaterial || mat instanceof THREE.MeshStandardMaterial) {
            mat.color = threeColor;
          }
        });
      } else if (object.material instanceof THREE.MeshBasicMaterial || object.material instanceof THREE.MeshStandardMaterial) {
        object.material.color = threeColor;
      }
    } else if (object instanceof THREE.Line && object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach(mat => {
          if (mat instanceof THREE.LineBasicMaterial) {
            mat.color = threeColor;
          }
        });
      } else if (object.material instanceof THREE.LineBasicMaterial) {
        object.material.color = threeColor;
      }
    }
  }

  /**
   * 应用透明度到对象
   */
  private applyOpacityToObject(object: THREE.Object3D, opacity: number): void {
    if (object instanceof THREE.Mesh && object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach(mat => {
          if (mat instanceof THREE.MeshBasicMaterial || mat instanceof THREE.MeshStandardMaterial) {
            mat.opacity = opacity;
            mat.transparent = opacity < 1.0;
          }
        });
      } else if (object.material instanceof THREE.MeshBasicMaterial || object.material instanceof THREE.MeshStandardMaterial) {
        object.material.opacity = opacity;
        object.material.transparent = opacity < 1.0;
      }
    } else if (object instanceof THREE.Line && object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach(mat => {
          if (mat instanceof THREE.LineBasicMaterial) {
            mat.opacity = opacity;
            mat.transparent = opacity < 1.0;
          }
        });
      } else if (object.material instanceof THREE.LineBasicMaterial) {
        object.material.opacity = opacity;
        object.material.transparent = opacity < 1.0;
      }
    }
  }

  /**
   * 应用线宽到对象
   */
  private applyLineWidthToObject(object: THREE.Object3D, width: number): void {
    if (object instanceof THREE.Line && object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach(mat => {
          if (mat instanceof THREE.LineBasicMaterial) {
            mat.linewidth = width;
          }
        });
      } else if (object.material instanceof THREE.LineBasicMaterial) {
        object.material.linewidth = width;
      }
    }
  }

  /**
   * 应用线型到对象
   */
  private applyLineTypeToObject(object: THREE.Object3D, type: string): void {
    // 线型应用通常需要更复杂的处理，这里只是一个占位符
    // 在实际应用中，可能需要根据线型创建不同的材质
    if (object instanceof THREE.Line) {
      // 可以在这里添加线型处理逻辑
      (object as any).lineType = type;
    }
  }

  /**
   * 释放对象资源
   */
  private disposeObject(object: THREE.Object3D): void {
    if (object instanceof THREE.Mesh) {
      if (object.geometry) {
        object.geometry.dispose();
      }
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(material => {
            if (material instanceof THREE.Material) {
              material.dispose();
            }
          });
        } else if (object.material instanceof THREE.Material) {
          object.material.dispose();
        }
      }
    } else if (object instanceof THREE.Line) {
      if (object.geometry) {
        object.geometry.dispose();
      }
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(material => {
            if (material instanceof THREE.Material) {
              material.dispose();
            }
          });
        } else if (object.material instanceof THREE.Material) {
          object.material.dispose();
        }
      }
    }
  }

  /**
   * 克隆图层（创建具有相同属性的新图层）
   */
  clone(): Layer2D {
    const layerInfo: LayerInfo = {
      name: this.name,
      visible: this.visible,
      frozen: this.frozen,
      locked: this.locked,
      color: this.color
    };
    
    const clonedLayer = new Layer2D(layerInfo);
    clonedLayer.opacity = this.opacity;
    clonedLayer.lineWidth = this.lineWidth;
    clonedLayer.lineType = this.lineType;
    
    return clonedLayer;
  }

  /**
   * 输出层级信息（格式化显示）
   */
  toString(): string {
    return `Layer2D {
  name: "${this.name}",
  visible: ${this.visible},
  frozen: ${this.frozen},
  locked: ${this.locked},
  color: #${this.color.toString(16).padStart(6, '0').toUpperCase()},
  opacity: ${this.opacity},
  lineWidth: ${this.lineWidth},
  lineType: "${this.lineType}",
  objectCount: ${this.objects.size}
}`;
  }

  /**
   * 输出详细层级信息（包括所有对象信息）
   */
  toDetailedString(): string {
    const objectsInfo = Array.from(this.objects).map((obj, index) => {
      return `    [${index}] ${obj.constructor.name} "${obj.name}"`;
    }).join('\n');

    return `Layer2D {
  name: "${this.name}",
  visible: ${this.visible},
  frozen: ${this.frozen},
  locked: ${this.locked},
  color: #${this.color.toString(16).padStart(6, '0').toUpperCase()},
  opacity: ${this.opacity},
  lineWidth: ${this.lineWidth},
  lineType: "${this.lineType}",
  objectCount: ${this.objects.size},
  objects: [
${objectsInfo}
  ]
}`;
  }

  /**
   * 序列化图层信息
   */
  toJSON(): any {
    return {
      name: this.name,
      visible: this.visible,
      frozen: this.frozen,
      locked: this.locked,
      color: this.color,
      opacity: this.opacity,
      lineWidth: this.lineWidth,
      lineType: this.lineType
    };
  }

  /**
   * 从 JSON 数据反序列化图层
   */
  static fromJSON(data: any): Layer2D {
    const layerInfo: LayerInfo = {
      name: data.name,
      visible: data.visible,
      frozen: data.frozen,
      locked: data.locked,
      color: data.color
    };
    
    const layer = new Layer2D(layerInfo);
    if (data.opacity !== undefined) layer.opacity = data.opacity;
    if (data.lineWidth !== undefined) layer.lineWidth = data.lineWidth;
    if (data.lineType !== undefined) layer.lineType = data.lineType;
    
    return layer;
  }
}