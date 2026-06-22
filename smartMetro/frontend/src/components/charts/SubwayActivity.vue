<!--
 * @Description: 地铁活动滚动列表 - 展示地铁建设动态（无缝滚动）
 *
 * 功能：使用 vue3-seamless-scroll 实现文字列表的无缝滚动
 * 数据：20条模拟的活动消息，格式为 { message, time }
 *
 * 注意：当前使用固定模拟数据，实际生产应连接后端接口
 * @Date: 2024-05-08
-->
<template>
  <div class="activity">
    <!--
      vue3-seamless-scroll: 无缝滚动组件
      list: 数据源
      hover: 鼠标悬停时暂停滚动
      step: 每帧滚动 0.4px
    -->
    <vue3-seamless-scroll :list="list" class="scroll" :hover="true" :step="0.4">
      <div class="item" v-for="(item, index) in list" :key="index">
        <!-- 活动消息 -->
        <span class="message">{{ item.message }}</span>
        <!-- 活动时间 -->
        <span class="time">{{ item.time }}</span>
      </div>
    </vue3-seamless-scroll>
  </div>
</template>

<script>
import { defineComponent, ref } from "vue";
import { Vue3SeamlessScroll } from "vue3-seamless-scroll";

export default defineComponent({
  name: "App",
  components: { Vue3SeamlessScroll },
  setup() {
    // 生成20条模拟活动消息
    const list = ref(Array.from({ length: 20 }, (_, i) => ({
      message: "7月31日,全线20座车站封顶",  // 活动描述
      time: "2022-05-01",                    // 活动时间
    })));
    return { list };
  },
});
</script>

<style>
.activity {
  color: #fff; width: 100%; height: 100%; overflow: hidden; pointer-events: all;
}
.activity .scroll {
  height: 200px; margin: 10px; overflow: hidden;
}
/* 每条活动条目 */
.item {
  height: 40px; display: flex; align-items: center;
  justify-content: space-between; padding: 0 30px; padding-right: 60px;
}
.item>span:first-child { color: #5dcad0; }       /* 活动描述 - 青蓝色 */
.item>span:last-child { color: #667eb8; font-weight: bold; }  /* 时间 - 蓝紫色 */
</style>
