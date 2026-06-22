<!--
 * @Description: 线路概览组件 - 展示地铁线路地图图片，支持缩放和拖拽查看
 *
 * 技术栈：ViewerJS - 图片查看器库
 * 配置：
 *   - inline: 内联模式（直接在容器内显示，非全屏弹窗）
 *   - navbar/toolbar: 隐藏工具栏和导航栏
 *   - zoomTo(0.1): 初始缩放到10%，展示全景
 *
 * 注意：当前使用静态图片展示线路，后续可改为动态渲染
 * @Date: 2024-05-08
-->
<template>
  <!-- 地铁线路图片（ViewerJS 的触发目标） -->
  <img src="/src/assets/uiResources/sub.png" alt="" style="width: 448px; height: 200px" id="imgTools"/>
</template>

<script setup>
import Viewer from "viewerjs";            // 图片查看器库
import "viewerjs/dist/viewer.css";        // ViewerJS 样式
import { nextTick, onMounted } from "vue";

onMounted(() => {
  // 等待 DOM 渲染完成后初始化 ViewerJS
  nextTick(() => {
    const viewer = new Viewer(document.getElementById("imgTools"), {
      inline: true,      // 内联模式：直接在容器内显示，不弹窗
      navbar: false,     // 隐藏底部缩略图导航
      toolbar: false,    // 隐藏顶部工具栏
      // 图片加载完成后自动缩放到10%
      viewed() {
        viewer.zoomTo(0.1);
      },
    });
  });
});
</script>
