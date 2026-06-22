<!--
 * @Description: 线路实时客流量图表 - 展示各线路当前小时的客流量
 *
 * 布局：左侧线路编号图标 + 右侧柱状图
 * 标题栏：显示总客流量（小时级别）
 * 数据来源：静态模拟数据（dataSource）
 * 图表类型：ECharts 柱状图（横坐标线路，纵坐标客流量）
 * @Date: 2024-05-08
-->
<template>
  <div class="wrapper">
    <!-- 标题栏 -->
    <div class="title-banner">
      <div>
        <img src="/src/assets/uiResources/网格员.png" alt="" />
        <span class="title">线路实时客流量</span>
      </div>
      <div>
        <!-- 总客流量 -->
        <span class="mount">5634</span>
        <span class="unit">/小时</span>
      </div>
    </div>

    <!-- 图表区域 -->
    <div class="chart-area">
      <!-- 左侧：线路编号图标列表（1-4号线） -->
      <div class="rate-list">
        <i v-for="item in [1, 2, 3, 4]" :class="['iconfont', `metro-NO-${item}`, `rand-${item}`]"></i>
      </div>
      <!-- 右侧：ECharts 图表容器 -->
      <div class="chart-wrapper">
        <div id="guests_chart" width="100%" height="100%" ref="guests_chart"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import * as echarts from "echarts";
import { onMounted } from "vue";
import { guestsRateOpts } from "@/cesiumTools/echartsOpts";  // ECharts 配置生成函数

// 模拟数据：各线路客流量（人次/小时）
const dataSource = [
  { name: "一号线", value: 1300 },
  { name: "二号线", value: 1100 },
  { name: "四号线", value: 1000 },
  { name: "七号线", value: 600 },
];

onMounted(() => {
  // 初始化 ECharts 实例
  const myChart = echarts.init(document.getElementById("guests_chart"));
  // 使用配置生成函数得到完整的 option
  const options = guestsRateOpts(dataSource);
  // 设置图表配置
  myChart.setOption(options);
});
</script>

<style scoped lang="scss">
.wrapper {
  width: 100%; height: 100%;
  display: flex; flex-direction: column; padding: 5px;
}
.title-banner {
  height: 40px; width: 100%;
  display: flex; align-items: center; justify-content: space-between;
  background: url("/assets/uiResources/圆角矩形.png");
  background-size: 100% 100%; padding: 0 20px;
}
.title-banner img { width: 40px; height: 40px; }
.title { color: #fff; font-size: 16px; margin-left: 20px; }
.mount { font-size: 20px; color: #4faccb; font-weight: bold; }     /* 客流量数字 */
.unit { font-size: 12px; color: #90a9c5; }                        /* 单位 "/小时" */
.chart-area { width: 100%; height: 100%; display: flex; }
.chart-wrapper { flex: 1; }
#guests_chart { width: 100%; height: 200px; }
/* 左侧线路图标列表 */
.rate-list {
  width: 50px; display: flex; flex-direction: column;
  align-items: center; justify-content: space-around;
}
.rate-list>i { font-size: 17px; }
/* 4种线路颜色 */
.rand-1 { color: #ffd31a; }   /* 金色 */
.rand-2 { color: #dadada; }   /* 银灰 */
.rand-3 { color: #ffa70b; }   /* 橙色 */
.rand-4 { color: #1b9017; }   /* 绿色 */
</style>
