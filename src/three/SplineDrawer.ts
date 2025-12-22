import * as THREE from 'three';
import { DwgEntity, DwgSplineEntity } from '../database';
import { BaseDrawer } from './BaseDrawer';

/**
 * 样条曲线绘制器
 * 绘制 DwgSplineEntity 类型的实体
 * 参考 SVG 转换器的 B-spline 插值算法
 */
export class SplineDrawer extends BaseDrawer<DwgSplineEntity> {
  
  canDraw(entity: DwgEntity): entity is DwgSplineEntity {
    return entity.type === 'SPLINE';
  }

  draw(entity: DwgSplineEntity): THREE.Line | null {
    const controlPoints = entity.controlPoints || [];
    
    if (controlPoints.length < 2) {
      return null;
    }
    
    const degree = entity.degree || 3;
    const knotVector = entity.knots || this.generateUniformKnotVector(controlPoints.length, degree);
    const isClosed = !!(entity.flag & 1); // Closed spline flag
    
    // 生成样条曲线上的点
    const points = this.interpolateSpline(controlPoints, knotVector, degree, isClosed);
    
    if (points.length < 2) {
      return null;
    }
    
    // 使用实体颜色
    const color = this.getEntityColor(entity);
    const line = this.createLineFromPoints(points, color);
    
    // 应用 normal 作为 extrusionDirection
    if (entity.normal) {
      this.applyExtrusionDirection(line, entity.normal);
    }
    
    return line;
  }

  /**
   * 生成均匀节点向量
   */
  private generateUniformKnotVector(numControlPoints: number, degree: number): number[] {
    const n = numControlPoints - 1;
    const m = n + degree + 1;
    const knots: number[] = [];
    
    for (let i = 0; i <= m; i++) {
      if (i <= degree) {
        knots.push(0);
      } else if (i >= m - degree) {
        knots.push(1);
      } else {
        knots.push((i - degree) / (m - 2 * degree));
      }
    }
    
    return knots;
  }

  /**
   * 插值样条曲线
   * 使用 De Boor 算法计算 B-spline 曲线上的点
   */
  private interpolateSpline(
    controlPoints: Array<{ x: number; y: number; z?: number }>,
    knotVector: number[],
    degree: number,
    _closed: boolean
  ): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    
    // 采样数量
    const numSamples = Math.max(50, controlPoints.length * 10);
    
    // 有效参数范围
    const tMin = knotVector[degree];
    const tMax = knotVector[knotVector.length - degree - 1];
    
    if (tMax <= tMin) {
      // 如果节点向量无效，使用简单的线性插值
      return this.linearInterpolate(controlPoints);
    }
    
    for (let i = 0; i <= numSamples; i++) {
      const t = tMin + (tMax - tMin) * (i / numSamples);
      const point = this.deBoor(t, controlPoints, knotVector, degree);
      points.push(point);
    }
    
    return points;
  }

  /**
   * De Boor 算法计算 B-spline 曲线上的点
   */
  private deBoor(
    t: number,
    controlPoints: Array<{ x: number; y: number; z?: number }>,
    knotVector: number[],
    degree: number
  ): THREE.Vector3 {
    const n = controlPoints.length - 1;
    
    // 查找 t 所在的节点区间
    let k = degree;
    for (let i = degree; i <= n; i++) {
      if (t >= knotVector[i] && t < knotVector[i + 1]) {
        k = i;
        break;
      }
    }
    
    // 处理边界情况
    if (t >= knotVector[n + 1]) {
      k = n;
    }
    
    // 复制受影响的控制点
    const d: THREE.Vector3[] = [];
    for (let j = 0; j <= degree; j++) {
      const idx = Math.max(0, Math.min(n, k - degree + j));
      const cp = controlPoints[idx];
      d.push(new THREE.Vector3(
        (cp.x || 0) * this.scaleFactor,
        (cp.y || 0) * this.scaleFactor,
        (cp.z || 0) * this.scaleFactor
      ));
    }
    
    // De Boor 递归
    for (let r = 1; r <= degree; r++) {
      for (let j = degree; j >= r; j--) {
        const i = k - degree + j;
        const denom = knotVector[i + degree - r + 1] - knotVector[i];
        
        let alpha = 0;
        if (Math.abs(denom) > 1e-10) {
          alpha = (t - knotVector[i]) / denom;
        }
        
        d[j].x = (1 - alpha) * d[j - 1].x + alpha * d[j].x;
        d[j].y = (1 - alpha) * d[j - 1].y + alpha * d[j].y;
        d[j].z = (1 - alpha) * d[j - 1].z + alpha * d[j].z;
      }
    }
    
    return d[degree];
  }

  /**
   * 线性插值（备选方案）
   */
  private linearInterpolate(
    controlPoints: Array<{ x: number; y: number; z?: number }>
  ): THREE.Vector3[] {
    return controlPoints.map(cp => new THREE.Vector3(
      (cp.x || 0) * this.scaleFactor,
      (cp.y || 0) * this.scaleFactor,
      (cp.z || 0) * this.scaleFactor
    ));
  }
}
