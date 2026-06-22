/**
 * @Description: Vue Router 路由配置文件
 * 使用 hash 模式的路由，支持5个功能页面：
 *   - 首页（默认，空内容）
 *   - 重点活动
 *   - 发展历程
 *   - 实时轨迹
 *   - 站点管理
 *   - 路径规划
 * 所有页面组件均使用懒加载（动态 import），按需加载以优化首屏性能
 * @Date: 2024-05-08
 */

import { createRouter, createWebHashHistory } from "vue-router";

// 路由映射表
const routes = [
  // 重点活动页面 - 展示各线路的重点保障活动信息
  { path: "/key_activity", component: () => import("../views/KeyActivity.vue") },
  // 发展历程页面 - 滚动时间轴展示地铁建设里程碑
  { path: "/progress_history", component: () => import("../views/Progress.vue") },
  // 实时轨迹页面 - 列车实时位置追踪与模拟运行
  { path: "/current_route", component: () => import("../views/CurrentRoute.vue") },
  // 站点管理页面 - 站点拥挤度热力图、站控措施、路径规划等
  { path: "/station_manage", component: () => import("../views/StationManage.vue") },
  // 路径规划页面 - 起点终点选择与地铁换乘路径规划
  { path: "/route_design", component: () => import("../views/RouteDesign.vue") },
  // 默认路由（首页） - 显示空 div，实际内容由 Content.vue 的面板提供
  { path: "/", component: { template: "<div></div>" } },
];

// 创建路由实例
const router = createRouter({
  // 使用 hash 模式 (URL 中带 #)，避免部署时需要服务端配置
  history: createWebHashHistory(),
  routes,
});

export default router
