<!--
 * @Description: 运营统计图表 - 展示年度安全运营天数及线路运营统计
 *
 * 布局：
 *   顶部：提示栏 - 显示当天日期 + 累计安全运营天数
 *   下方：ECharts 柱状图 - 展示各线路运营数据
 *
 * 数据来源：静态模拟数据（4条线路的运营指标）
 * @Date: 2024-05-08
-->
<template>
  <div class="operateStatic">
    <!-- 顶部提示栏 -->
    <div class="tip">
      <span>截至{{ nowaday }}，年度安全运营天数 <span class="count">3618</span>天</span>
    </div>
    <!-- 图表区域 -->
    <div class="chart-part">
      <div id="operateChart" :style="{ width: '100%', height: '100%' }"></div>
    </div>
  </div>
</template>

<script setup>
import dayjs from "dayjs";
import * as echarts from "echarts";
import { ref, onMounted } from "vue";
import { operateOpts } from "@/cesiumTools/echartsOpts";  // ECharts 配置生成函数

// 当天日期（YYYY/M/DD 格式）
const nowaday = ref(dayjs().format("YYYY/M/DD"));

onMounted(() => {
  const myChart = echarts.init(document.getElementById("operateChart"));

  // 模拟数据：各线路运营指标
  const data = [
    { name: "一号线", value: 38 },
    { name: "二号线", value: 60 },
    { name: "四号线", value: 50 },
    { name: "七号线", value: 32 },
  ];

  const options = operateOpts(data);
  myChart.setOption(options);
});
</script>

<style scoped>
.operateStatic {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.tip {
  height: 30px; width: 100%;
  font-size: 14px; color: #fff;
  text-align: center; margin-top: 10px;
}
/* 安全运营天数 - 金色大号数字 */
.count {
  font-size: 26px; color: #ef9c00; letter-spacing: 3px;
}
.chart-part {
  flex: 1; display: flex;
  pointer-events: all; padding-left: 10px;
}
#operateChart { pointer-events: all; }
</style>
