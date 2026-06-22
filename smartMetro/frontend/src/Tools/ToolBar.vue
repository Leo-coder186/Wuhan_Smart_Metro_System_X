<!--
 * @Description: 右侧浮动工具栏组件
 *
 * 功能：
 *   1. 鼠标位置：切换显示 Cesium 鼠标经纬度状态栏
 *   2. 图层控制：弹出 Popover 显示线路图层控制器（LineController）
 *   3. 全屏控件：切换页面全屏模式
 *
 * 位置：页面右侧，浮动在 Cesium 地图上方
 * 特殊处理：
 *   - 站点管理页面时位置左移（right: 1% instead of 28%）
 *   - 路径规划模式下图层控制禁用（disabled 状态）
 *   - 使用 lineDataStore.$onAction 监听 disableController action 来切换禁用状态
 * @Date: 2024-05-10
-->
<template>
  <!--
    动态调整右侧位置：
    - 站点管理页面：right: 1%（让出右侧面板空间）
    - 其他页面：right: 28%
  -->
  <div id="tool-wrapper" :style="{ right: isManage ? '1%' : '28%' }">
    <div class="tool-item" v-for="item in tools" :title="item.title" @click="handleTool(item)">
      <!-- 图层控制按钮：使用 a-popover 弹出面板 -->
      <a-popover v-if="item.title === '图层控制'" placement="leftBottom" trigger="click">
        <template #content>
          <LineController />
        </template>
        <i :class="['iconfont', item.icon, disabled ? 'disabled-icon' : '']"></i>
      </a-popover>
      <!-- 其他工具按钮 -->
      <i :class="['iconfont', item.icon]" v-else></i>
    </div>
  </div>
</template>

<script setup>
import toolList from "./toolList";
import { ref, onMounted, watch } from "vue";
import { watchLineData, useLineData } from '@/store'
import LineController from "./LineController.vue";
import { renderAll } from '@/cesiumTools/effectController'
import PositionInfoStatusBar from "@/cesiumTools/positionStatusBar";  // 鼠标位置状态栏
import { fullScreen, cancelFullscreen } from "./toolFunctions";

const tools = ref(toolList);          // 工具列表
const lineDataStore = useLineData()
const disabled = ref(false);           // 图层控制是否禁用
const isManage = ref(false)           // 是否在站点管理页面
const isFullScreen = ref(false);       // 是否全屏
const MousePositionShowed = ref(false); // 鼠标位置是否显示

let positionStatus    // 鼠标位置状态栏实例
let viewer

onMounted(async () => {
  viewer = await watchLineData('setViewer')
  const lineData = await watchLineData('setData')

  // 初次渲染所有线路
  renderAll(viewer, lineDataStore.lineData)

  // 创建鼠标位置状态栏（显示在 Cesium 地图左上角）
  positionStatus = new PositionInfoStatusBar(viewer);
})

// 点击工具栏按钮 → 分发到对应操作
const handleTool = (data) => {
  const { title } = data;
  switch (title) {
    case "全屏控件":
      controlFullScreen();
      break;
    case "鼠标位置":
      controlMouse();
      break;
    default:
      break;
  }
}

// 获取要全屏的目标元素（#app）
const targetEle = document.getElementById("app");

/**
 * 全屏切换
 * 当前全屏 → 退出全屏
 * 当前非全屏 → 进入全屏
 */
const controlFullScreen = () => {
  isFullScreen.value && cancelFullscreen();
  !isFullScreen.value && fullScreen(targetEle);
  isFullScreen.value = !isFullScreen.value;
};

/**
 * 监听 Store 中 disableController action 的调用
 * 路径规划模式下，effectController 会调用此 action 禁用图层控制
 */
lineDataStore.$onAction(({ name, store, args, after, onError }) => {
  if (name === 'disableController') {
    after((res) => {
      disabled.value = lineDataStore.isDisable;
    });
  }
})

/**
 * 鼠标位置状态栏切换显示/隐藏
 */
const controlMouse = () => {
  MousePositionShowed.value ? positionStatus.show() : positionStatus.hide();
  MousePositionShowed.value = !MousePositionShowed.value;
};
</script>

<style scoped>
#tool-wrapper {
  position: absolute;
  right: 28%;
  bottom: 10%;
  display: flex;
  flex-direction: column;  /* 垂直排列 */
  z-index: 199;
}

.tool-item {
  margin: 4px;
  pointer-events: all;
  cursor: pointer;
}

.tool-item:hover {
  background-color: #d8951a7f;  /* 金色半透明悬停效果 */
}

#tool-wrapper i {
  color: #ffd31a;          /* 金色图标 */
  border: 1px solid #d8951a;
  padding: 3px;
}

#tool-wrapper span {
  color: #fff;
}

/* 图层控制禁用状态 */
.disabled-icon {
  pointer-events: none;
  cursor: none;
  background-color: rgba(204, 204, 204, 0.306);
}

.disabled-icon:hover {
  cursor: none;
}
</style>
