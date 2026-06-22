<!--
 * @Description: 告警趋势图表 - 展示去年和今年各月的告警数量对比
 *
 * 图表类型：ECharts 柱状图（分组对比）
 * 数据来源：@/store/staticData 中的 historyWarningData（去年+今年各12个月数据）
 * @Date: 2024-05-08
-->
<template>
  <div id="historyChart"></div>
</template>

<script setup>
import { historyWarning } from "@/cesiumTools/echartsOpts";   // ECharts 配置生成函数
import * as echarts from "echarts";
import { onMounted } from "vue";
import { historyWarningData } from "@/store/staticData";      // 历史告警模拟数据

onMounted(() => {
  initChart();
});

// 初始化图表：创建 ECharts 实例并设置配置
const initChart = () => {
  const myChart = echarts.init(document.getElementById("historyChart"));
  const options = historyWarning(historyWarningData);
  myChart.setOption(options);
};
</script>

<style scoped lang="scss">
#historyChart {
  width: 500px;
  height: 230px;
  margin: 0 auto;    /* 水平居中 */
}
</style>
