// @ts-ignore - aether3d库的类型声明可能不完整
import { Plugin, App } from '../../../aether3d/aether3d.es.js';
import { LibreDwg, LibreDwgEx } from './src/libredwg';
import { Dwg_File_Type } from './src/types';
import { renderDWGDatabase, ViewportDraw } from "./src";

/**
 * DWG插件配置接口
 */
export interface DWGPluginConfig {
    enabled: boolean;
    defaultPrecision: number;
    showThumbnail: boolean;
    scaleFactor: number;
    autoRender: boolean;
    defaultCoordinateSystem: 'xy' | 'xz';
}

/**
 * DWG转换结果接口
 */
export interface DWGConversionResult {
    json: any;
    svg: string;
    threeDrawing?: ViewportDraw;
    viewportDraw?: ViewportDraw;
}

/**
 * 进度回调函数类型
 */
export type ProgressCallback = (progress: number, message: string) => void;

/**
 * DWG插件类，实现Plugin接口
 * 用于处理DWG文件的读取、转换和显示
 */
export class DWGPlugin implements Plugin {
    // 插件基本信息
    public name: string = 'DWGPlugin';
    public version: number = 1.0;
    public icon: string = '📐';
    public isBuiltin?: boolean = true;

    // 插件内部状态
    public isInstalled: boolean = false;
    private libreDwgInstance?: LibreDwgEx;
    private viewer: any = null;
    
    // 配置
    private config: DWGPluginConfig = {
        enabled: true,
        defaultPrecision: 1,
        showThumbnail: true,
        scaleFactor: 0.1,
        autoRender: true,
        defaultCoordinateSystem: 'xy'
    };
    
    // 缓存
    private databaseCache: Map<string, any> = new Map();
    private threeDrawingInstance: ViewportDraw | null = null;
    
    // 进度回调
    private progressCallback: ProgressCallback | null = null;

    constructor() {
    }

    /**
     * 插件安装方法
     * @param config 插件配置
     */
    async install(config?: Partial<DWGPluginConfig>): Promise<void> {
        try {
            // 合并配置
            if (config) {
                this.config = { ...this.config, ...config };
            }
            
            this.updateProgress(10, '正在初始化 LibreDwg...');
            
            // 初始化LibreDwg实例
            this.libreDwgInstance = await LibreDwg.create();
            console.log('[DWGPlugin] LibreDwg 实例初始化成功');
            
            this.updateProgress(100, '插件安装完成');
            
            this.isInstalled = true;
            if (!this.viewer) {
                // 从全局App实例获取viewer
                const appInstance = (window as any).appInstance;
                this.viewer = appInstance?.viewer || null;
            }
            console.log('[DWGPlugin] 插件安装完成');
        } catch (error) {
            console.error('[DWGPlugin] 初始化失败:', error);
            throw error;
        }
    }
    /**
     * 卸载插件
     */
    uninstall(): void {
        if (!this.isInstalled) {
            console.log('[DWGPlugin] 插件未安装');
            return;
        }
        
        console.log('[DWGPlugin] 卸载中...');
        
        // 清理 ViewportDraw
        if (this.threeDrawingInstance) {
            this.threeDrawingInstance.destroy();
            this.threeDrawingInstance = null;
        }
        
        // 清理缓存
        this.databaseCache.clear();
        
        // 释放资源
        this.libreDwgInstance = undefined;
        this.viewer = null;
        this.progressCallback = null;
        
        this.isInstalled = false;
        console.log('[DWGPlugin] 卸载完成');
    }
    /**
     * 运行插件 - 打开文件选择器导入DWG文件
     */
    run(): void {
        this.openFileDialog();
    }
    
    /**
     * 打开文件选择对话框
     */
    public openFileDialog(): void {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.dwg,.dxf';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                try {
                    const arrayBuffer = await file.arrayBuffer();
                    await this.importDWGFile(arrayBuffer, file.name);
                } catch (error) {
                    console.error('[DWGPlugin] 导入DWG文件失败:', error);
                }
            }
        };
        input.click();
    }
    /**
     * 获取配置UI
     */
    getConfigUI() {
        return {
            title: 'DWG插件配置',
            fields: [
                {
                    name: 'enabled',
                    label: '启用DWG插件',
                    type: 'checkbox',
                    default: this.config.enabled
                },
                {
                    name: 'defaultPrecision',
                    label: '默认精度',
                    type: 'number',
                    min: 1,
                    max: 10,
                    default: this.config.defaultPrecision
                },
                {
                    name: 'showThumbnail',
                    label: '显示缩略图',
                    type: 'checkbox',
                    default: this.config.showThumbnail
                },
                {
                    name: 'scaleFactor',
                    label: '缩放因子',
                    type: 'slider',
                    min: 0.01,
                    max: 1,
                    step: 0.01,
                    default: this.config.scaleFactor
                },
                {
                    name: 'autoRender',
                    label: '自动渲染到3D场景',
                    type: 'checkbox',
                    default: this.config.autoRender
                },
                {
                    name: 'defaultCoordinateSystem',
                    label: '默认坐标系',
                    type: 'select',
                    options: [
                        { label: 'XY坐标系(平面图)', value: 'xy' },
                        { label: 'XZ坐标系(立面图)', value: 'xz' }
                    ],
                    default: this.config.defaultCoordinateSystem
                },
                
            ]
        };
    }
    /**
     * 更新配置
     * @param config 新配置
     */
    updateConfig(config: Partial<DWGPluginConfig>): void {
        this.config = { ...this.config, ...config };
        console.log(`[DWGPlugin] Config updated, scaleFactor: ${this.config.scaleFactor}`);
        
        // 如果 ViewportDraw 实例存在，更新缩放因子
        if (this.threeDrawingInstance && config.scaleFactor !== undefined) {
            this.threeDrawingInstance.setScaleFactor(config.scaleFactor);
            console.log(`[DWGPlugin] Updated ViewportDraw scaleFactor to: ${config.scaleFactor}`);
        }
        
        // 如果 ViewportDraw 实例存在，更新坐标系设置
        if (this.threeDrawingInstance && config.defaultCoordinateSystem !== undefined) {
            const useXz = config.defaultCoordinateSystem === 'xz';
            this.threeDrawingInstance.toggleCoordinateSystem(useXz);
        }
        

        
        console.log('[DWGPlugin] 配置已更新:', this.config);
    }
    
    /**
     * 获取当前配置
     */
    public getConfig(): DWGPluginConfig {
        return { ...this.config };
    }
    
    /**
     * 设置进度回调
     * @param callback 进度回调函数
     */
    public setProgressCallback(callback: ProgressCallback | null): void {
        this.progressCallback = callback;
    }
    
    /**
     * 更新进度
     */
    private updateProgress(progress: number, message: string): void {
        if (this.progressCallback) {
            this.progressCallback(progress, message);
        }
    }
    

    /**
     * 获取LibreDwg实例
     * @returns LibreDwgEx实例或undefined
     */
    public getLibreDwgInstance(): LibreDwgEx | undefined {
        return this.libreDwgInstance;
    }
    
    /**
     * 获取 ViewportDraw 实例
     */
    public getViewportDraw(): ViewportDraw | null {
        return this.threeDrawingInstance;
    }

    /**
     * 检查LibreDwg实例是否可用
     * @returns boolean - 实例是否可用
     */
    private checkLibreDwgInstance(): boolean {
        if (!this.libreDwgInstance) {
            console.error('[DWGPlugin] LibreDwg 实例未初始化');
            return false;
        }
        return true;
    }
    
    /**
     * 导入DWG文件并渲染到场景
     * @param arrayBuffer 文件内容
     * @param fileName 文件名
     * @returns 转换结果
     */
    public async importDWGFile(arrayBuffer: ArrayBuffer, fileName: string): Promise<DWGConversionResult> {
        this.updateProgress(0, '开始导入DWG文件...');
        
        const result = await this.executeDwgToJsonCommand(arrayBuffer, fileName);
        
        // 如果配置为自动渲染，则渲染到3D场景
        if (this.config.autoRender && result.json) {
            this.updateProgress(90, '渲染到3D场景...');
            result.threeDrawing = this.renderToScene(result.json);
        }
        
        this.updateProgress(100, '导入完成');
        return result;
    }
    
    /**
     * 渲染DWG数据到3D场景
     * @param database DWG数据库
     * @returns ViewportDraw实例
     */
    public renderToScene(database: any): ViewportDraw {
        // 清理旧的实例
        if (this.threeDrawingInstance) {
            this.threeDrawingInstance.clearEntities();
        }
        
        // 创建新实例并渲染
        this.threeDrawingInstance = renderDWGDatabase(database);
        this.threeDrawingInstance.setScaleFactor(this.config.scaleFactor);
        
        // 应用默认坐标系设置
        if (this.config.defaultCoordinateSystem === 'xz') {
            this.threeDrawingInstance.toggleCoordinateSystem(true);
        }

        // 触发渲染
        if (this.viewer && this.viewer.render) {
            this.viewer.render();
        }
        
        console.log('[DWGPlugin] DWG已渲染到场景');
        return this.threeDrawingInstance;
    }
    
    /**
     * 将DWG文件直接转换为ViewportDraw实例
     * @param arrayBuffer DWG文件的ArrayBuffer
     * @param fileName 文件名
     * @returns ViewportDraw实例
     */
    public async convertDWGToViewportDraw(arrayBuffer: ArrayBuffer, fileName: string): Promise<ViewportDraw> {
        try {
            this.updateProgress(0, '开始转换DWG为ViewportDraw...');
            
            // 读取DWG文件
            const database = await this.readDWGFile(arrayBuffer, Dwg_File_Type.DWG, fileName);
            if (!database) {
                throw new Error('DWG文件读取失败');
            }
            
            this.updateProgress(50, '渲染到ViewportDraw...');
            
            // 转换为ViewportDraw
            const viewportDraw = renderDWGDatabase(database);
            viewportDraw.setScaleFactor(this.config.scaleFactor);
            
            this.updateProgress(100, 'ViewportDraw转换完成');
            return viewportDraw;
        } catch (error) {
            console.error('[DWGPlugin] DWG转ViewportDraw失败:', error);
            throw error;
        }
    }
    
    /**
     * 清理场景中的DWG实体
     */
    public clearScene(): void {
        if (this.threeDrawingInstance) {
            this.threeDrawingInstance.clearEntities();
            console.log('[DWGPlugin] 场景已清理');
        }
    }

    /**
     * 读取DWG文件
     * @param fileContent 文件内容
     * @param fileType 文件类型
     * @param cacheKey 缓存键（可选）
     * @returns 转换后的DWG数据库或null
     */
    public async readDWGFile(fileContent: ArrayBuffer, fileType: number, cacheKey?: string): Promise<any> {
        if (!this.checkLibreDwgInstance()) {
            console.error('[DWGPlugin] LibreDwg实例未初始化，无法读取DWG文件');
            return null;
        }
        
        // 检查缓存
        if (cacheKey && this.databaseCache.has(cacheKey)) {
            console.log('[DWGPlugin] 使用缓存的数据库');
            return this.databaseCache.get(cacheKey);
        }

        try {
            this.updateProgress(20, '正在读取DWG文件...');
            console.log('[DWGPlugin] 开始读取DWG文件, 大小:', fileContent.byteLength, 'bytes');
            
            // 读取DWG数据
            const dwgData = this.libreDwgInstance!.dwg_read_data(fileContent, fileType);
            if (!dwgData) {
                console.error('[DWGPlugin] dwg_read_data返回null');
                return null;
            }
            
            this.updateProgress(50, '正在转换数据...');
            console.log('[DWGPlugin] DWG数据读取成功');
            
            // 转换为数据库对象
            const database = this.libreDwgInstance!.convert(dwgData);
            if (!database) {
                console.error('[DWGPlugin] convert返回null');
                this.libreDwgInstance!.dwg_free(dwgData);
                return null;
            }
            
            this.updateProgress(70, '数据转换完成');
            console.log('[DWGPlugin] DWG数据转换为数据库对象成功');
            
            // 调试：打印数据库信息
            console.log('[DWGPlugin] 数据库信息:', {
                layersCount: database.tables?.LAYER?.entries?.length || 0,
                entitiesCount: database.entities?.length || 0,
                firstEntity: database.entities?.[0],
                firstLayer: database.tables?.LAYER?.entries?.[0]
            });
            
            // 释放 DWG 数据
            this.libreDwgInstance!.dwg_free(dwgData);
            
            // 缓存结果
            if (cacheKey) {
                this.databaseCache.set(cacheKey, database);
            }
            
            return database;
        } catch (error: any) {
            console.error('[DWGPlugin] 读取DWG文件失败:', error.message);
            return null;
        }
    }

    /**
     * 将DWG转换为JSON
     * @param database DWG数据库
     * @returns JSON对象或null
     */
    public convertToJSON(database: any): any {
        if (!this.checkLibreDwgInstance()) {
            console.error('[DWGPlugin] LibreDwg实例未初始化，无法转换为JSON');
            return null;
        }

        try {
            
            // 检查数据库对象是否有效
            if (!database || typeof database !== 'object') {
                console.error('[DWGPlugin] 无效的数据库对象');
                return null;
            }
            
            // 确保数据库对象结构完整
            if (!database.tables) {
                database.tables = {};
            }
            if (!database.entities) {
                database.entities = [];
            }

            return database;
        } catch (error: any) {
            console.error('[DWGPlugin] 转换DWG为JSON失败:', error.message);
            return null;
        }
    }
    
    /**
     * 将DWG文件直接转换为JSON
     * @param arrayBuffer DWG文件的ArrayBuffer
     * @param fileName 文件名
     * @returns JSON对象
     */
    public async convertDWGToJSON(arrayBuffer: ArrayBuffer, fileName: string): Promise<any> {
        try {
            this.updateProgress(0, '开始转换DWG为JSON...');
            
            // 读取DWG文件
            const database = await this.readDWGFile(arrayBuffer, Dwg_File_Type.DWG, fileName);
            if (!database) {
                throw new Error('DWG文件读取失败');
            }
            
            this.updateProgress(50, '转换为JSON...');
            
            // 转换为JSON
            const jsonResult = this.convertToJSON(database);
            if (!jsonResult) {
                throw new Error('DWG转换为JSON失败');
            }
            
            this.updateProgress(100, 'JSON转换完成');
            return jsonResult;
        } catch (error) {
            console.error('[DWGPlugin] DWG转JSON失败:', error);
            throw error;
        }
    }

    /**
     * 将DWG转换为SVG
     * @param database DWG数据库
     * @returns SVG字符串或null
     */
    public convertToSVG(database: any): string | null {
        if (!this.checkLibreDwgInstance()) {
            console.error('[DWGPlugin] LibreDwg实例未初始化，无法转换为SVG');
            return null;
        }

        try {
            console.log('[DWGPlugin] 开始转换DWG为SVG...');
            
            // 检查数据库对象是否有效
            if (!database || typeof database !== 'object') {
                console.error('[DWGPlugin] 无效的数据库对象');
                return this.createErrorSVG('无效的DWG数据库');
            }
            
            const svg = this.libreDwgInstance!.dwg_to_svg(database);
            if (!svg || svg.trim() === '') {
                console.error('[DWGPlugin] dwg_to_svg返回空字符串');
                return this.createErrorSVG('SVG转换结果为空');
            }
            
            console.log('[DWGPlugin] DWG转换为SVG成功');
            return svg;
        } catch (error: any) {
            console.error('[DWGPlugin] 转换DWG为SVG失败:', error.message);
            return this.createErrorSVG(`转换失败: ${error.message}`);
        }
    }
    
    /**
     * 将DWG文件直接转换为SVG
     * @param arrayBuffer DWG文件的ArrayBuffer
     * @param fileName 文件名
     * @returns SVG字符串
     */
    public async convertDWGToSVG(arrayBuffer: ArrayBuffer, fileName: string): Promise<string> {
        try {
            this.updateProgress(0, '开始转换DWG为SVG...');
            
            // 读取DWG文件
            const database = await this.readDWGFile(arrayBuffer, Dwg_File_Type.DWG, fileName);
            if (!database) {
                throw new Error('DWG文件读取失败');
            }
            
            this.updateProgress(50, '转换为SVG...');
            
            // 转换为SVG
            const svgResult = this.convertToSVG(database);
            if (!svgResult) {
                throw new Error('DWG转换为SVG失败');
            }
            
            this.updateProgress(100, 'SVG转换完成');
            return svgResult;
        } catch (error) {
            console.error('[DWGPlugin] DWG转SVG失败:', error);
            throw error;
        }
    }
    
    /**
     * 创建错误提示SVG
     */
    private createErrorSVG(message: string): string {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">
            <rect width="100%" height="100%" fill="#f8f8f8"/>
            <text x="10" y="50" font-family="Arial" font-size="12" fill="#cc0000">${message}</text>
        </svg>`;
    }

    /**
     * 获取DWG文件版本
     * @param dwgData DWG数据指针
     * @returns 版本信息或null
     */
    public getDWGVersion(dwgData: any): any {
        if (!this.checkLibreDwgInstance()) {
            return null;
        }

        try {
            return this.libreDwgInstance!.dwg_get_version_type(dwgData);
        } catch (error) {
            console.error('[DWGPlugin] 获取DWG版本失败:', error);
            return null;
        }
    }

    /**
     * 提取DWG缩略图
     * @param dwgData DWG数据指针
     * @returns 缩略图数据或null
     */
    public extractThumbnail(dwgData: any): any {
        if (!this.checkLibreDwgInstance()) {
            return null;
        }

        try {
            return this.libreDwgInstance!.dwg_bmp(dwgData);
        } catch (error) {
            console.error('[DWGPlugin] 提取DWG缩略图失败:', error);
            return null;
        }
    }

    /**
     * 执行DWG到JSON转换命令
     * @param arrayBuffer DWG文件的ArrayBuffer
     * @param fileName 文件名
     * @returns 包含JSON和SVG结果的对象
     */
    public async executeDwgToJsonCommand(arrayBuffer: ArrayBuffer, fileName: string): Promise<DWGConversionResult> {
        try {
            this.updateProgress(10, '开始执行DWG转换...');
            console.log('[DWGPlugin] 开始执行DWG到JSON转换命令...');
            
            // 读取DWG文件
            const database = await this.readDWGFile(arrayBuffer, Dwg_File_Type.DWG, fileName);
            if (!database) {
                throw new Error('DWG文件读取失败');
            }
            
            this.updateProgress(60, '转换为JSON...');
            
            // 转换为JSON
            const jsonResult = this.convertToJSON(database);
            if (!jsonResult) {
                throw new Error('DWG转换为JSON失败');
            }
            
            this.updateProgress(80, '转换为SVG...');
            
            // 转换为SVG
            const svgResult = this.convertToSVG(database) || '';
            
            this.updateProgress(95, '转换完成');
            console.log('[DWGPlugin] DWG到JSON转换命令执行完成');
            
            return {
                json: jsonResult,
                svg: svgResult,
            };
        } catch (error) {
            console.error('[DWGPlugin] 执行DWG到JSON转换命令失败:', error);
            throw error;
        }
    }
    
    /**
     * 清理缓存
     */
    public clearCache(): void {
        this.databaseCache.clear();
        console.log('[DWGPlugin] 缓存已清理');
    }
    
    /**
     * 获取缓存统计信息
     */
    public getCacheStats(): { count: number; keys: string[] } {
        return {
            count: this.databaseCache.size,
            keys: Array.from(this.databaseCache.keys())
        };
    }
}

export default DWGPlugin;