<!--
 * @Description: 通用面板容器组件 - 提供统一的边框、标题和内容区域样式
 *
 * 用途：Content.vue 中6个运营数据面板的容器
 * Props:
 *   - title: 面板标题（显示在头部）
 * Slots:
 *   - #content: 面板内容插槽
 * @Date: 2024-05-08
-->
<template>
    <div class="panel">
      <!-- 面板头部：显示标题 -->
      <div class="head">
          <span>{{ props.title }}</span>
      </div>
      <!-- 面板内容：通过插槽插入图表组件 -->
      <div class="content">
          <slot name="content"></slot>
      </div>
    </div>
</template>

<script setup>
// 接收标题参数
const props = defineProps({
    title: {
        type: String,
        default: ''
    }
})
</script>

<style scoped>
/* 面板最小尺寸 */
.panel {
    min-width: 300.006px;
    min-height: 190.006px;
    display: flex;
    flex-direction: column;
}

/* 面板头部 - 使用 panel-header.png 背景 */
.panel .head {
    width: 100%;
    height: 45px;
    background: url('../assets/uiResources/panel-header.png');
    background-size: cover;
    font-family: '等线Bold';
    letter-spacing: 1px;
}

/* 面板标题 - 金色渐变文字 */
.panel .head span {
    display: inline-block;
    font-size: 21px;
    /* 白色到金色渐变 */
    background: rgb(255,255,255);
    background-image: linear-gradient(180deg,
        rgba(255,255,255,1) 9%,
        rgba(211,156,50,1) 57%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    height: 100%;
    line-height: 45px;
    margin-left: 38px;
    margin-top: 2px;
}

/* 面板内容 - 使用 panel-content.png 背景 + 半透明黑色叠加 */
.panel .content {
    width: 100%;
    flex: 1;
    background: url('../assets/uiResources/panel-content.png');
    background-size: 100% 100%;
    pointer-events: all;           /* 允许内容区接收鼠标事件 */
    background-color: rgba(0,0,0,.4);
}
</style>
