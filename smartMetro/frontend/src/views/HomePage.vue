<!--
 * @Description: 首页布局组件 - 顶部导航栏 + 主体内容区
 * 组合 Header（顶部菜单）和 Content（运营面板 + 路由视图）
 * @Date: 2024-05-08
-->
<template>
    <div id="home">
      <!-- 顶部导航/状态栏（时钟、线路色块等） -->
      <Header/>
      <!--
        主体内容区
        Content.vue 内部包含：
          1. 默认显示：运营统计、线路概览、告警趋势等6个面板（grid 布局）
          2. 路由切换时：显示对应的功能页面（实时轨迹、发展历程等）
      -->
      <Content/>
    </div>
  </template>

  <script setup>
  import Header from '../components/Header.vue';
  import Content from './Content.vue';
  </script>

  <style scoped>
  /* 全屏容器，pointer-events: none 使得点击事件穿透到下方的 Cesium 地图 */
  #home {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;  /* 穿透鼠标事件到地图，子元素需单独开启 pointer-events */
      z-index: 10;           /* 在地图上方 */
  }
  </style>
