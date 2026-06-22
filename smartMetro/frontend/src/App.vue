<!--
 * @Description: 根组件 - 智慧地铁大屏可视化系统的顶层布局
 * 职责：
 *   1. 使用 v-scale-screen 实现1920×1080设计稿在任何分辨率下等比缩放
 *   2. 使用 keep-alive 缓存 Cesium 3D 地图实例，避免切换路由时重建
 *   3. 组合地图视图(CesiumView)、首页面板(HomePage)和底部状态栏(Footer)
 * @Date: 2024-05-08
-->
<template>
  <!--
    v-scale-screen: 大屏自适应容器
    width/height: 设计稿基准尺寸 (1920×1080)
    delay: 延迟200ms初始化，等待DOM就绪
    效果：无论屏幕实际分辨率，内部元素始终等比缩放
  -->
  <v-scale-screen width="1920" height="1080" delay="200">
    <!--
      keep-alive: 缓存 CesiumView 组件实例
      目的：Cesium 3D 地图初始化成本很高（加载地形、模型、纹理），
      切换页面时不应销毁重建，使用 keep-alive 保持其存活状态
    -->
    <keep-alive>
        <CesiumView>
          <!-- 工具栏组件（暂时注释掉，后续可能启用） -->
          <!-- <Toolbar/> -->
        </CesiumView>
    </keep-alive>
    <!-- 首页内容面板：包含运营统计、线路概览、告警趋势等图表 -->
    <HomePage/>
    <!-- 页面底部信息栏 -->
    <Footer />
  </v-scale-screen>
</template>

<script setup>
// 3D 地图核心组件 - 初始化 Cesium Viewer 并管理所有地图相关逻辑
import CesiumView from './views/CesiumView.vue';
// 底部状态栏组件
import Footer from './components/Footer.vue';
// 大屏自适应缩放组件
import VScaleScreen from 'v-scale-screen'
// 首页面板组件 - 包含运营统计、线路概览、图表等
import HomePage from './views/HomePage.vue'
// 工具栏组件（暂时注释掉）
// import Toolbar from './Tools/ToolBar.vue'
</script>

<style>
/*
 * 覆盖 Cesium 时间轴控件的位置
 * 将默认在底部的 Cesium 时间轴移到屏幕右上方，
 * 避免与我们的自定义面板重叠
 */
.cesium-viewer-timelineContainer{
    position: absolute;
    width: 200px;
    height: 30px;
    pointer-events: all;        /* 允许用户交互（拖拽时间轴） */
    margin-left: 1420px;        /* 距离左侧 1420px（大约屏幕右方） */
    top: 10px;                  /* 距离顶部 10px */
    z-index: 1000;              /* 确保在大多数面板之上 */
}
</style>
