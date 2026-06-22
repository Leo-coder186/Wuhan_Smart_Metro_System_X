<!--
 * @Description: 皮肤切换组件 - 切换暗黑/亮色主题
 *
 * 当前使用 Ant Design Radio 单选按钮组
 * 选项：暗黑系(dark) / 亮色系(light)
 * 注意：目前仅有 UI 切换控件，具体主题切换逻辑尚未实现
 * @Date: 2024-11-07
-->
<template>
  <div id="skinSwitch">
    <!-- a-radio-group: Ant Design 的单选按钮组 -->
    <a-radio-group v-model:value="skin">
      <a-radio :style="radioStyle" v-for="item in skinList" :value="item.key">{{ item.title }}</a-radio>
    </a-radio-group>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';

// 当前皮肤（'dark' | 'light'）
const skin = ref('dark')

// Radio 按钮样式
const radioStyle = reactive({
  display: 'flex',
  height: '30px',
  lineHeight: '30px',
});

// 皮肤选项列表
const skinList = ref([
  {
    title: '暗黑系',
    key: 'dark'
  },
  {
    title: '亮色系',
    key: 'light'
  }
])
</script>

<style scoped lang='less'>
</style>
