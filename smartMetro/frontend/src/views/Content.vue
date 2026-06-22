<!--
 * @Description: 内容布局组件 - 首页运营面板 + 路由功能页面切换
 *
 * 两种显示模式：
 *   1. baseMode = true（首页）：显示6个运营数据面板的 grid 布局
 *      - part1: 运营统计
 *      - part2: (未使用，预留地图区域)
 *      - part3: 线路概览
 *      - part4: 地铁活动
 *      - part5: 告警趋势
 *      - part6: 客流指标
 *      - part7: 实时影像
 *   2. baseMode = false（功能页）：隐藏面板，只显示 <router-view> 中的功能页面
 *
 * 切换逻辑：watch 当前路由路径，匹配到功能页路径时隐藏面板
 * @Date: 2024-05-08
-->
<template>
  <!-- 首页面板：仅在 baseMode 为 true 时显示 -->
  <div id="content" v-if="baseMode">
    <!-- 运营统计面板 -->
    <Panel style="grid-area: part1" title="运营统计">
      <template #content>
        <OperateStatic />
      </template>
    </Panel>

    <!-- 线路概览面板 -->
    <Panel style="grid-area: part3" title="线路概览">
      <template #content>
        <LineScan />
      </template>
    </Panel>

    <!-- 告警趋势面板 -->
    <Panel style="grid-area: part5" title="告警趋势">
      <template #content>
        <HistoryWarnging />
      </template>
    </Panel>

    <!-- 地铁活动面板 -->
    <Panel style="grid-area: part4" title="地铁活动">
      <template #content>
        <SubwayActivity />
      </template>
    </Panel>

    <!-- 客流指标面板 -->
    <Panel style="grid-area: part6" title="客流指标">
      <template #content>
        <GuestsRate />
      </template>
    </Panel>

    <!-- 实时影像面板（HLS 视频流播放） -->
    <Panel style="grid-area: part7" title="实时影像">
      <template #content>
        <HlsLive />
      </template>
    </Panel>
  </div>

  <!-- 路由视图：功能页面通过 router-view 渲染在此处 -->
  <div style="position: absolute; z-index: 100" class="router-wrapper">
    <router-view></router-view>
  </div>
</template>

<script setup>
// 面板容器组件（统一边框、标题样式）
import Panel from "@/components/Panel.vue";
// 运营统计图表
import OperateStatic from "@/components/charts/OperateStatic.vue";
// 地铁活动列表
import SubwayActivity from "@/components/charts/SubwayActivity.vue";
// 客流指标图表
import GuestsRate from "@/components/charts/GuestsRate.vue";
// 历史告警趋势图表
import HistoryWarnging from "@/components/charts/HistoryWarning.vue";
// 线路概览（线路扫描动画）
import LineScan from "@/components/charts/LineScan.vue";
// HLS 视频直播组件
import HlsLive from "../components/charts/HlsLive.vue";

import router from "@/router";
import { ref, watch } from "vue";

/**
 * 控制首页面板显示/隐藏
 * true = 显示首页运营面板
 * false = 显示功能页面（实时轨迹、发展历程等）
 */
const baseMode = ref(true);

// 监听路由变化，根据路径切换显示模式
watch(router.currentRoute, (value) => {
  // 当访问功能页面时，隐藏首页运营面板
  if (value.path === "/station_manage"
    || value.path === "/current_route"
    || value.path === "/key_activity"
    || value.path === "/progress_history"
    || value.path === "/route_design") {
    baseMode.value = false;
  } else {
    // 回到首页或其他路径 → 显示运营面板
    baseMode.value = true;
  }
});
</script>

<style scoped>
/* Grid 布局：3行 × 3列，中间列(part2)为空，预留给地图区域 */
#content {
  width: 100%;
  /* 高度 = 100% - 头部高度(约4.2vw) - 底部高度(约4.5vw) */
  height: calc(100% - 8.698vw);
  padding: 0 0.833vw;
  position: absolute;
  left: 0;
  top: 4.219vw;
  display: grid;
  grid-template-rows: repeat(3, 1fr);      /* 3 行等高 */
  grid-template-columns: 0.8fr 1.4fr 0.8fr; /* 中间列较宽 */
  grid-row-gap: 16px;
  grid-template-areas:
    "part1 part2 part3"    /* 第1行：运营统计 | 空 | 线路概览 */
    "part4 part2 part5"    /* 第2行：地铁活动 | 空 | 告警趋势 */
    "part6 part2 part7";   /* 第3行：客流指标 | 空 | 实时影像 */
  pointer-events: none;   /* 穿透到地图 */
}

.router-wrapper {
  width: 100%;
  height: calc(100% - 90px);
  top: 0;
  left: 0;
  pointer-events: none;   /* 穿透到地图，子组件内部自行开启 */
}
</style>
