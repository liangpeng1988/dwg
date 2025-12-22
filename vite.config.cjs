const { resolve } = require('path');
const { defineConfig } = require('vite');

// 所有外部依赖列表
const externalDependencies = [
  'three',
  'three/examples/jsm/Addons.js',
  '3d-tiles-renderer',
  'camera-controls',
  'three-mesh-bvh',
  'three-viewport-gizmo',
  'three-gpu-pathtracer',
  'web-ifc-three',
  'jszip',
  'pako',
  'localforage',
  'signals',
  'js-base64',
  'needle-tools-three-animation-pointer',
  'dxfom-mtext',
  'babel-runtime'
];

module.exports = defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: resolve(__dirname, 'DWGPlugin.ts'), // 直接打包DWGPlugin
      name: 'DWGPlugin',
      formats: ['es'],
      fileName: () => 'dwg-plugin.min.js'
    },
    rollupOptions: {
      external: (id) => {
        // 排除所有外部依赖
        if (externalDependencies.some(dep => id === dep || id.startsWith(dep + '/'))) {
          return true;
        }
        // 排除SDK核心模块
        if (id.startsWith('@/')) {
          return true;
        }
        // 排除Node.js内置模块
        if (id === 'module' || id === 'fs' || id === 'path') {
          return true;
        }
        return false;
      },
      output: {
        globals: {
          'three': 'THREE'
        },
        inlineDynamicImports: true
      }
    },
    minify: false, // 暂时禁用压缩以便调试
    copyPublicDir: false
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '../../sdk/lib')
    }
  }
});
