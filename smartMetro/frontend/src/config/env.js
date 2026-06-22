/**
 * @Description: 环境配置文件
 * 根据 Vite 环境变量和当前运行环境（开发/生产），
 * 统一管理 API 地址、Cesium 静态资源路径、3D 模型路径等配置
 * @Date: 2024-05-08
 */

// ============================================
// 从 Vite 环境变量读取配置（定义在 .env 文件中）
// import.meta.env 是 Vite 注入的环境变量对象
// ============================================

/** API 服务器 IP 地址，默认 127.0.0.1 */
const serverIp = import.meta.env.VITE_SERVER_IP || '127.0.0.1';
/** API 路径前缀，默认 /api/v1 */
const apiPath = import.meta.env.VITE_API_PATH || '/api/v1';
/** Cesium 静态资源基础路径（CSS、Worker、图片等） */
const cesiumBaseURL = import.meta.env.VITE_CESIUM_BASE_URL || 'https://cesium.com/downloads/cesiumjs/releases/1.97/Build/Cesium/';
/** Cesium Ion 访问令牌（用于加载 Ion 平台的 3D 地形、影像等资源） */
const cesiumIonToken = import.meta.env.VITE_CESIUM_ION_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIzYTgzYWYzNS00Zjk0LTQ1MTYtYmUwMi0yZWQwNDdiZDE5ODAiLCJpZCI6MzA4NjQ3LCJpYXQiOjE3NDg5MjA2Mzl9.W14LDt4yTKkBBxFta2-hDGUlaIj4kWPAj0bUdkFJnI8';

// ============================================
// 开发环境配置
// ============================================
const devConfig = {
  /** 后端 API 基础地址 */
  apiBaseURL: `http://${serverIp}${apiPath}`,
  /** Cesium 静态资源路径 */
  cesiumBaseURL: cesiumBaseURL,
  /** Cesium Ion 访问令牌 */
  cesiumIonToken: cesiumIonToken,
  /** 武汉城市建筑白模 3D Tiles 路径（开发环境从本地服务加载） */
  cesiumBuildingURL: import.meta.env.VITE_DEV_BUILDING_URL || 'http://localhost:666/public/wuhan/tileset.json',
  /** 地铁列车 3D 模型路径（glTF 格式） */
  cesiumMetrolModelURL: import.meta.env.VITE_DEV_METRO_MODEL_URL || "/models/gltf/metro.gltf"
};

// ============================================
// 生产环境配置 - 使用部署服务上的路径
// ============================================
const prodConfig = {
  /** 后端 API 基础地址 */
  apiBaseURL: `http://${serverIp}${apiPath}`,
  /** Cesium 静态资源路径 */
  cesiumBaseURL: cesiumBaseURL,
  /** Cesium Ion 访问令牌 */
  cesiumIonToken: cesiumIonToken,
  /** 武汉城市建筑白模路径（生产环境从 Nginx 静态服务加载） */
  cesiumBuildingURL: import.meta.env.VITE_PROD_BUILDING_URL || '/models/b3dm/tileset.json',
  /** 地铁列车 3D 模型路径 */
  cesiumMetrolModelURL: import.meta.env.VITE_PROD_METRO_MODEL_URL || "/models/gltf/metro.gltf"
};

// ============================================
// 根据当前构建环境自动选择配置
// import.meta.env.PROD 是 Vite 内置变量：生产构建时为 true
// ============================================
const config = import.meta.env.PROD ? prodConfig : devConfig;

/** 导出最终配置对象 */
export default config;
