<!--
 * @Description: Cesium 3D 地图初始化组件 - 整个系统的核心地图容器
 *
 * 职责：
 *   1. 初始化 Cesium Viewer（3D 地球/地图）
 *   2. 加载武汉城市建筑白模（3D Tiles）
 *   3. 加载地铁线路数据并渲染到地图上
 *   4. 设置太阳光晕、水面效果、昼夜切换等视觉效果
 *   5. 提供 <slot> 让其他图层组件（如 Header、底部面板）覆盖在地图上方
 *
 * 数据流：
 *   getLine() API → lineDataStore.setData() → renderAll() 渲染所有线路到地图
 *   getWeather() API → 仅打印天气数据（非阻塞）
 * @Date: 2024-05-08
-->
<template>
    <div id="cesium-viewer">
        <!--
          slot 插槽：允许父组件（App.vue）在此处插入内容
          插入的内容会浮在地图上方（因为 z-index 更高）
        -->
        <slot/>
    </div>
</template>

<script setup>
import * as Cesium from "cesium";                  // CesiumJS 3D 地图库
import { onMounted, markRaw } from "vue";           // markRaw: 标记对象不被 Vue 深度代理（Cesium 对象不需要响应式）
import app from '../main'                           // 全局 Vue 应用实例
import {
    initViewer,          // 初始化 Cesium Viewer 实例
    setScene,            // 设置场景基础属性（相机、光照等）
    loadTilesets,        // 加载 3D Tiles 建筑白模
    handleDefaultModelEffect, // 建筑模型默认效果（颜色、透明度等）
    flyToDefaultView,    // 飞到武汉默认俯瞰视角
    setSelfPostProgress, // 太阳光晕后期处理效果
    renderWater,         // 渲染水面效果
    handleUpdateScene    // 场景更新（昼夜切换）
} from "@/cesiumTools/sceneManager";
import { useLineData } from '@/store'               // 线路数据 Store
import { getWeather, getLine } from '@/api/line.js' // 后端 API：天气 + 线路数据
import { renderAll } from '@/cesiumTools/effectController' // 渲染所有线路到地图

const lineDataStore = useLineData()

// ============================================
// 设置 Cesium Ion 访问令牌
// Cesium Ion 是 Cesium 的云服务平台，提供全球地形、影像等资源
// 此令牌用于访问 Cesium Ion 上的 3D Tiles、地形等服务
// ============================================
Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN;

// ============================================
// onMounted: 组件挂载后，异步初始化 Cesium 场景
// 注意：外层 App.vue 使用了 keep-alive，此钩子只执行一次
// ============================================
onMounted(async () => {
    // 1. 初始化 Cesium Viewer（以 DOM id="cesium-viewer" 为容器）
    const viewer = initViewer("cesium-viewer");

    // 2. 获取天气数据（非阻塞，失败不影响后续流程）
    const data = await getWeather()
    console.log('天气数据:', data);

    // 3. 设置场景基础属性（相机限制、光照参数等）
    setScene(viewer);

    // 4. 添加太阳光晕效果（镜头对着太阳时出现光晕）
    setSelfPostProgress(viewer);

    // 5. 飞到武汉默认视角（俯瞰武汉市中心）
    flyToDefaultView(viewer)

    // 6. 从后端获取线路数据并渲染
    const lineData = await getLine()
    lineDataStore.setData(lineData)          // 存入 Store，供全局使用
    renderAll(viewer, lineDataStore.lineData) // 渲染所有线路到 Cesium 地图

    // 7. 定义要加载的 3D 模型列表
    // url: 武汉城市建筑白模（b3dm 格式 3D Tiles），需要启动本地模型服务
    const modelUrls = [{
      url: "http://localhost:666/public/wuhan/tileset.json",
      options: {}
    }]

    // 8. 缓存 Viewer 实例到 Store
    // markRaw: 告诉 Vue 不要深度代理 Cesium Viewer（Cesium 内部有大量循环引用，代理会出错）
    lineDataStore.setViewer(markRaw(viewer))

    // 9. 加载建筑白模（失败不阻塞页面渲染）
    try {
      await loadTilesets(viewer, modelUrls, (tilesets) => {
        // 设置建筑模型默认样式（颜色、透明度、线框等）
        handleDefaultModelEffect(tilesets[0])
        // 缓存 tileset 到 Store
        lineDataStore.setTileset(markRaw(tilesets[0]));

        // 异步渲染水面效果 + 设置昼夜切换
        (async () => {
          const waterPrimitive = await renderWater(viewer);
          // 根据时间自动切换昼夜效果（同时更新建筑和水面）
          handleUpdateScene(viewer, tilesets[0], waterPrimitive);
        })();
      })
    } catch (err) {
      // 模型加载失败只打印警告，不影响基础地图功能
      console.warn('3D模型加载失败（需要启动模型服务: localhost:666）：', err?.message || err)
    }
});
</script>

<style>
/* Cesium 地图容器 - 全屏覆盖，位于最底层 */
#cesium-viewer {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    z-index: 1;             /* 最底层的 z-index，其他面板都在其上方 */
    pointer-events: all;    /* 允许鼠标拖拽、缩放等交互 */
}

/* 确保 Cesium 内部的 canvas 元素也能正常接收鼠标/滚轮事件 */
#cesium-viewer .cesium-viewer,
#cesium-viewer .cesium-widget,
#cesium-viewer canvas {
    pointer-events: all !important;
}
</style>
