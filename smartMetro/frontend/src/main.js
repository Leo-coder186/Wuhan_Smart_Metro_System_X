/**
 * @Description: Vue 应用入口文件
 * 负责创建和配置 Vue 应用实例，注册所有插件并挂载到 DOM
 * @Date: 2024-05-08
 */

import { createApp } from 'vue'           // Vue 3 应用创建函数
import Antd from 'ant-design-vue';         // Ant Design Vue UI 组件库
import 'ant-design-vue/dist/reset.css';    // Ant Design 样式重置文件
import App from './App.vue'               // 根组件
import { createPinia } from 'pinia'       // Pinia 状态管理库（Vue 3 官方推荐替代 Vuex）
import router from './router'             // Vue Router 路由配置
import VScaleScreen from 'v-scale-screen' // 大屏自适应缩放插件，保持1920×1080设计稿等比缩放
import './style.scss'                     // 全局样式文件

// 创建 Vue 应用实例
const app = createApp(App);

// 按顺序注册插件：
// 1. Antd - Ant Design Vue 组件库
// 2. createPinia() - 全局状态管理
// 3. router - 路由系统
// 4. VScaleScreen - 大屏自适应（使页面在任何分辨率下等比缩放）
// 最后挂载到 #app 元素上
app.use(Antd).use(createPinia()).use(router).use(VScaleScreen).mount('#app')

// 导出应用实例，供其他模块（如 CesiumView）引用
export default app
