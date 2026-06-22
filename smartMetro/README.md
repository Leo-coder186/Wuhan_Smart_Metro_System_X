# 武汉智慧地铁三维可视化管控平台

基于 **Vue 3 + CesiumJS + NestJS** 的地铁运营三维可视化大屏系统，实现地铁线路、站点、列车实时轨迹的三维展示与数据监控。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Vue 3 (Composition API) + TypeScript |
| 构建工具 | Vite 5 |
| 3D 引擎 | CesiumJS 1.97 |
| UI 组件 | Ant Design Vue 4 |
| 状态管理 | Pinia |
| 图表 | ECharts 5 |
| 后端框架 | NestJS 11 |
| 数据库 | MySQL + TypeORM |
| 大屏适配 | v-scale-screen |

## 功能模块

- **首页** — 6 个数据面板（运营统计/客流指标/告警趋势）+ Cesium 3D 武汉地图
- **实时轨迹** — 列车实时位置追踪 + 时间轴动画
- **重点活动** — 活动区域标注 + 渐变圆柱标记
- **站点管理** — 查询模式切换（拥挤度热力图/站控措施/路径规划）
- **发展历程** — 地铁建设里程碑时间轴 + 线路漫游动画
- **路径规划** — 起终点选择 + 换乘方案展示

## Cesium 特效

- 天空盒 + 太阳光晕着色器
- 建筑模型高度渐变着色器（昼夜切换）
- 水面波动着色器
- 腾讯底图 + 武汉 3D 建筑白模
- 自定义时间轴控件

## 快速启动

```bash
# 前端
cd frontend
pnpm install
pnpm dev          # http://localhost:5173

# 后端
cd backend
pnpm install
pnpm start:dev    # http://localhost:8090
```

## 环境要求

- Node.js >= 18
- MySQL 8.x（执行 `line.sql` 初始化数据库）
- 3D 建筑模型服务（可选，运行在 `localhost:666`）

## 项目结构

```
smartMetro/
├── frontend/          # Vue 3 前端
│   ├── src/
│   │   ├── views/         # 页面组件（6 个功能页面）
│   │   ├── components/    # 通用组件（面板/顶栏/底栏/图表）
│   │   ├── cesiumTools/   # Cesium 集成（场景管理/特效/热力图/时间轴）
│   │   ├── store/         # Pinia 状态管理
│   │   ├── api/           # API 请求层
│   │   ├── router/        # 路由配置
│   │   └── assets/        # 静态资源（图片/字体/3D 模型）
│   ├── env/               # 环境变量
│   └── vite.config.js
└── backend/           # NestJS 后端
    └── src/
        └── metro/         # 地铁业务模块（控制器/服务/实体/网关）
```
