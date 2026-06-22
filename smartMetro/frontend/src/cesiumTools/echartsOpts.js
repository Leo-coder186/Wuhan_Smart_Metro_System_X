/**
 * @Description: ECharts 图表配置生成工具 - 为运营面板提供图表样式配置
 *
 * 包含三种图表配置：
 *   1. operateOpts:    运营统计 - 环形图（饼图变体）
 *   2. guestsRateOpts: 客流指标 - 横向柱状图
 *   3. historyWarning:  告警趋势 - 双线平滑折线图（去年 vs 今年对比）
 *
 * 设计模式：每个函数输入数据 → 输出完整的 ECharts option 对象
 * 样式特点：深色背景透明、霓虹色彩、发光阴影
 *
 * @Date: 2024-05-08
 */
import * as echarts from "echarts";
import { lineColors } from "../store/staticData";

/**
 * 运营统计 - 环形饼图
 *
 * 显示各线路的运营里程占比
 * 视觉：中心空洞圆环 + 图例列表
 *
 * @param {Array<{name: string, value: number}>} dataSource - 各线路运营数据
 * @returns {Object} ECharts option
 */
export const operateOpts = (dataSource) => {
  // 计算总里程
  const sum = dataSource.reduce((cur, pre) => cur + pre.value, 0);
  const data = [];
  const legendData = [];

  dataSource.forEach((item, index) => {
    const { name, value } = item;
    // 图例名称：如 "1号线--38.0公里"
    let legendName = name.slice(-3) + "--" + value.toFixed(1) + "公里";
    legendData.push(legendName);

    // 每个数据项后面加一个间隔项（值 = 总里程/25，透明不显示）
    // 作用：在环形图中形成视觉间隔
    data.push(
      {
        value: value.toFixed(0),
        name: legendName,
        itemStyle: {
          borderWidth: 5,
          shadowBlur: 20,
          borderColor: lineColors[index],       // 边框颜色 = 线路色
          shadowColor: lineColors[index],       // 发光阴影色 = 线路色
        },
      },
      {
        // 间隔项（透明占位）
        value: sum / 25,
        name: "",
        itemStyle: {
          label: { show: false },
          labelLine: { show: false },
          color: "rgba(0, 0, 0, 0)",
          borderColor: "rgba(0, 0, 0, 0)",
          borderWidth: 0,
        },
      }
    );
  });

  const seriesOption = [
    {
      name: "",
      type: "pie",
      radius: [55, 59],           // 内外半径（空心圆环）
      center: ["18.4%", "center"], // 圆心偏左
      emphasis: { scale: false },  // 悬停不放大
      label: { show: false },      // 不显示标签
      data: data,
    },
  ];

  return {
    backgroundColor: "rgba(0,0,0,0)",
    color: lineColors,
    tooltip: { trigger: "item" },
    legend: {
      icon: "roundRect",
      orient: "horizontal",
      data: legendData,
      right: 50,
      top: 50,
      align: "right",
      textStyle: { color: "#fff" },
      itemGap: 19,
      itemWidth: 20,
      itemHeight: 10,
      width: 380,
      itemStyle: {
        shadowColor: "rgba(0, 0, 0, 0.5)",
        shadowBlur: 12,
      },
    },
    series: seriesOption,
  };
};

/**
 * 客流指标 - 横向柱状图
 *
 * 显示各线路的实时客流量对比
 * 视觉：蓝色渐变柱 + 半透明背景柱（最大值参考线）
 *
 * @param {Array<{name: string, value: number}>} dataSource
 * @returns {Object} ECharts option
 */
export const guestsRateOpts = (dataSource) => {
  let salvProName = dataSource.map((item) => item.name);
  let salvProValue = dataSource.map((item) => item.value);
  // 背景柱的最大值（等于1400，作为满刻度参考线）
  let salvProMax = salvProValue.map(() => 1400);

  return {
    backgroundColor: "rgba(0, 0, 0, 0)",
    grid: {
      left: "18%", right: "0%", bottom: "-2%", top: "0%",
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "none" },
      formatter: function (params) {
        return params[0].name + " : " + params[0].value;
      },
    },
    xAxis: { show: false, type: "value" },
    yAxis: [
      {
        // 左侧 Y 轴：线路名称
        type: "category",
        inverse: true,
        axisLabel: { show: true, textStyle: { color: "#C4F1FF" } },
        splitLine: { show: false },
        axisTick: { show: false },
        axisLine: { show: false },
        data: salvProName,
      },
      {
        // 右侧 Y 轴：客流量数值
        type: "category",
        inverse: true,
        axisTick: "none",
        axisLine: "none",
        show: true,
        axisLabel: { textStyle: { color: "#C4F1FF", fontWeight: "800" } },
        data: salvProValue,
      },
    ],
    series: [
      {
        // 前景柱：蓝绿渐变
        name: "值",
        type: "bar",
        zlevel: 1,
        itemStyle: {
          normal: {
            barBorderRadius: 30,
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: "rgb(10, 116, 255,1)" },        // 深蓝
              { offset: 1, color: "rgb(127,237,241,1)" },         // 浅蓝绿
            ]),
          },
        },
        z: 2,
        barWidth: 6,
        data: salvProValue,
      },
      {
        // 背景柱：半透明参考线
        name: "背景",
        type: "bar",
        barWidth: 6,
        barGap: "-100%",   // 与前柱重叠
        data: salvProMax,
        itemStyle: {
          normal: {
            color: "rgba(127,237,241,.4)",
            barBorderRadius: 30,
          },
        },
        z: 1,             // 在下方层级
      },
    ],
  };
};

/**
 * 历史告警趋势 - 双线平滑折线图
 *
 * 显示去年和今年的告警趋势对比
 * 视觉：两条平滑曲线 + 渐变面积填充 + 发光阴影
 *
 * @param {Object} dataSource - { 去年: [{name, value}], 今年: [{name, value}] }
 * @returns {Object} ECharts option
 */
export const historyWarning = (dataSource) => {
  const color = ["#1890FF", "#42d7b3"];  // 去年蓝色 / 今年绿色
  const legendData = Object.keys(dataSource);
  const seriesData = [];
  let index = 0;

  for (let key in dataSource) {
    const data = dataSource[key].map((item) => item.value);
    seriesData.push({
      name: key,
      type: "line",
      smooth: true,     // 平滑曲线
      symbol: "none",   // 不显示数据点符号
      lineStyle: {
        width: 3,
        shadowColor: color[index],
        shadowBlur: 20,  // 发光效果
      },
      areaStyle: {
        opacity: 1,
        // 渐变面积填充：上方不透明 → 下方透明
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0,   color: index === 0 ? "rgba(24, 144, 255, .5)" : "rgba(71, 176, 138, .5)" },
          { offset: 0.3, color: index === 0 ? "rgba(24, 144, 255, .2)" : "rgba(71, 176, 138, .2)" },
          { offset: 1,   color: index === 0 ? "rgba(24, 144, 255, 0)"  : "rgba(71, 176, 138, 0)" },
        ]),
      },
      data: data,
    });
    index++;
  }

  return {
    backgroundColor: "rgba(0,0,0,0)",
    color: color,
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
    },
    grid: {
      left: "7%", right: "7%", bottom: "6%", top: "17%",
      containLabel: true,
    },
    legend: {
      icon: "rect",
      orient: "horizontal",
      left: "right",
      itemWidth: 12,
      itemHeight: 12,
      textStyle: { color: "#fff", fontSize: "12px" },
      data: legendData,
    },
    xAxis: [{
      type: "category",
      data: ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"],
      boundaryGap: false,
      axisTick: { show: false },
      splitLine: { show: false },
      axisLine: { show: false },
      axisLabel: { color: "rgba(230, 247, 255, 0.50)", fontSize: 12 },
    }],
    yAxis: [{
      name: '(次数)',
      type: "value",
      nameTextStyle: { align: 'right', color: 'rgba(230, 247, 255, 0.50)' },
      axisLabel: { color: "rgba(230, 247, 255, 0.50)", fontSize: 12 },
      splitLine: {
        show: true,
        lineStyle: { type: "dashed", color: "rgba(230, 247, 255, 0.20)" },  // 虚线网格
      },
    }],
    series: seriesData,
  };
};
