<!--
 * @Description: 鼠标跟随提示框组件
 *
 * 功能：在鼠标附近显示一个跟随的提示框
 * Props: text - 要显示的文本（空字符串则不显示）
 *
 * 实现：
 *   - 使用 lodash throttle 节流（30ms），避免高频更新
 *   - 监听全局 mousemove 事件
 *   - 提示框在鼠标右下方 15px 处显示
 * @Date: 2024-05-21
-->
<template>
    <!-- 仅在有文本时显示 -->
    <div class="toolTip" ref="toolTip" v-if="text.length">{{ text }}</div>
</template>

<script setup>
import { onMounted, ref, watch, onUnmounted } from 'vue'
import _ from 'lodash'

const props = defineProps({
    text: String   // 提示文本
})

const toolTip = ref(HTMLElement)

// 节流处理鼠标移动事件（每30ms最多更新一次位置）
const event = _.throttle((e) => {
    if (toolTip.value) {
        // 提示框显示在鼠标右下方
        toolTip.value.style.top = e.clientY - 25 + 'px';   // 鼠标上方25px
        toolTip.value.style.left = e.clientX + 15 + 'px';  // 鼠标右侧15px
    }
}, 30)

// 注册全局鼠标移动监听
const registerEvent = () => {
    document.body.addEventListener('mousemove', event)
}

onMounted(() => {
    // 有文本时才注册监听
    if (props.text.length) {
        registerEvent()
    }
})

// 卸载时移除监听，防止内存泄漏
onUnmounted(() => {
    document.removeEventListener('mousemove', event)
})
</script>

<style scoped>
.toolTip {
    min-width: 100px;
    min-height: 20px;
    font-size: 16px;
    background-color: #fff;
    border: 1px solid #ccc;
    border-radius: 4px;
    color: #000;
    position: absolute;
    padding: 6px;
    z-index: 333;
    left: 0;
    top: 0;
}
</style>
