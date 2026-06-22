/**
 * @Description: 导航菜单配置
 * 定义底部导航栏的菜单项，包含名称、路由路径、激活状态
 * 由 Header.vue / Footer.vue 组件读取，渲染底部导航
 * @Date: 2024-05-08
 */

const menus = [
  {
    name: '实时轨迹',          // 菜单显示名称
    path: '/current_route',    // 点击后跳转的路由路径
    isActive: false,           // 当前是否被选中（运行时动态更新）
  },
  {
    name: '重点活动',
    path: '/key_activity',
    isActive: false,
  },
  {
    name: '首页',              // 返回首页（清空路由，显示运营面板）
    path: '/',
    isActive: false,
  },
  {
    name: '发展历程',
    path: '/progress_history',
    isActive: false,
  },
  {
    name: '站点管理',
    path: '/station_manage',
    isActive: false,
  },
]

export default menus
