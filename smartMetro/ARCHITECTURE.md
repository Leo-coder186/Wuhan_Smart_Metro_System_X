# 武汉智慧地铁三维可视化管控平台 — 项目架构大纲

> 整理日期：2026-06-20  
> 项目根目录：`smartMetro/`

---

## 一、项目总览

本项目是一个**武汉智慧地铁三维可视化管控平台**，基于 CesiumJS 构建 3D 数字孪生场景，实现地铁线路、站点、列车实时位置、客流数据等信息的可视化展示与管控。项目分为三层代码库：

| 目录 | 角色 | 技术栈 | 说明 |
|---|---|---|---|
| `backend/` | 后端服务 | NestJS + TypeORM + MySQL | 当前使用的后端，由 Go 重写为 NestJS |
| `frontend/` | 前端应用 | Vue 3 + Vite + CesiumJS | 当前开发中的前端，在老师示例基础上演进 |
| `teacher-demo/` | 老师示例 | Vue 3 + Vite + CesiumJS + Go 后端 | 老师提供的完整参考实现 |

```
smartMetro/
├── backend/          # NestJS 后端服务
├── frontend/         # Vue3 + CesiumJS 前端
└── teacher-demo/     # 老师示例（完整参考实现）
```

---

## 二、后端架构（`backend/`）

### 2.1 技术栈

| 组件 | 技术选型 |
|---|---|
| 运行时 | Node.js 20 |
| 语言 | TypeScript 5.8 |
| 框架 | NestJS 11 |
| ORM | TypeORM 0.3 |
| 数据库 | MySQL 8.0（utf8mb4） |
| HTTP 客户端 | Axios（`@nestjs/axios`） |
| 数据校验 | class-validator + class-transformer |
| API 文档 | Swagger（`@nestjs/swagger`） |
| WebSocket | `@nestjs/websockets` + `ws` |
| 文件上传 | Multer |
| 配置管理 | `@nestjs/config`（`.env`） |
| 容器化 | Docker + Docker Compose |

### 2.2 目录结构

```
backend/src/
├── main.ts                  # 应用入口（创建 NestJS 应用，启用 Swagger）
├── app.module.ts            # 根模块（数据库、静态文件、Multer、Metro 模块）
├── common/
│   └── response.ts          # 统一响应格式（success / failed / successPage）
└── metro/
    ├── metro.module.ts      # 地铁业务模块入口
    ├── controllers/
    │   ├── metro.controller.ts       # 线路/站点/列车位置 API
    │   ├── line-plan.controller.ts   # 路线规划 API（调高德地图）
    │   └── upload.controller.ts      # 文件上传 + 健康检测 API
    ├── services/
    │   ├── metro.service.ts          # 线路/站点/列车位置 业务逻辑
    │   ├── line-plan.service.ts      # 高德公交路线规划 服务
    │   └── upload.service.ts         # 文件上传配置（Multer）
    ├── entities/
    │   └── line.entity.ts            # 线路数据表实体（TypeORM）
    ├── interfaces/
    │   └── line.interface.ts         # TS 类型定义
    ├── dto/                          # Swagger DTO 定义（6 个文件）
    └── gateways/
        └── train-position.gateway.ts # WebSocket 列车实时位置推送
```

### 2.3 数据库设计

**数据库名：** `smart_metro`  
**核心表：** `line`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | int(11) PK | 线路 ID（自增） |
| `name` | varchar(30) | 线路名称（如"轨道交通 1 号线"） |
| `basic_price` | varchar(10) | 起步票价 |
| `total_price` | varchar(10) | 全程票价 |
| `length` | varchar(10) | 线路总长度 |
| `xs` | longtext | 经度坐标串（逗号分隔） |
| `ys` | longtext | 纬度坐标串（逗号分隔） |
| `stations` | longtext | 站点 JSON 数组 `[{name, xy_coords}]` |

**初始化方式：** `line.sql` 脚本在 MySQL 首次启动时自动执行（Docker volume 挂载到 `/docker-entrypoint-initdb.d/`）。

### 2.4 API 路由表

基础路径：`/api/v1`

| 方法 | 路径 | 功能 | 所属模块 |
|---|---|---|---|
| GET | `/getLine` | 获取所有线路（含站点、票价、坐标、客流） | MetroController |
| GET | `/getStationInfo?name=` | 按站名查询站点信息 | MetroController |
| GET | `/getCarPosition?id=` | 获取指定线路的模拟列车位置 | MetroController |
| GET | `/getLinePlan?origin=&destination=` | 高德公交换乘路线规划 | LinePlanController |
| GET | `/test` | 测试接口（东风公司站） | MetroController |
| POST | `/upload` | 图片上传（jpg/png/gif，限 5MB） | UploadController |
| GET | `/pong` | 健康检测 | UploadController |
| WS | `/ws/train-position` | WebSocket 实时列车位置推送 | TrainPositionGateway |
| GET | `/api-docs` | Swagger API 文档页 | Swagger |

**统一响应格式：**
```json
{ "code": 200, "message": "成功", "data": {...} }
```

### 2.5 关键设计说明

- **数据模拟：** 客流为人流随机数（0-99），列车位置在线路坐标中随机选取
- **换乘站识别：** `MetroService` 中硬编码了 29 个武汉地铁换乘站名称
- **高德集成：** 路线规划依赖高德地图 v5 公交换乘 API（需要 `AMAP_KEY`）
- **WebSocket 广播：** 每 500ms 自动推送 1-5 号线的模拟列车位置及速度（40-60 km/h）
- **无鉴权：** 当前 API 完全开放，无认证/授权中间件

### 2.6 部署架构

```
┌─────────────────────────────────────┐
│         Docker Compose              │
│  ┌──────────────┐ ┌──────────────┐  │
│  │metro-backend │ │    mysql     │  │
│  │  (Node 20)  │ │  (MySQL 8)  │  │
│  │  port:8092  │ │  port:3308  │  │
│  └──────────────┘ └──────────────┘  │
│         │               │           │
│         └───────┬───────┘           │
│           共享网络 bridge            │
└─────────────────────────────────────┘
```

---

## 三、前端架构（`frontend/`）

### 3.1 技术栈

| 层级 | 技术选型 | 版本 |
|---|---|---|
| 框架 | Vue 3（Composition API + `<script setup>`） | ^3.4 |
| 构建 | Vite | ^5.2 |
| 3D 引擎 | CesiumJS | 1.97 |
| 状态管理 | Pinia | ^2.1 |
| 路由 | Vue Router 4（hash 模式） | ^4.3 |
| UI 组件库 | Ant Design Vue 4 | ^4.2 |
| 图表 | ECharts | ^5.5 |
| HTTP | Axios | ^1.6 |
| 视频 | video.js + flv.js | — |
| 屏幕适配 | v-scale-screen（1920×1080 基准） | ^2.2 |
| 无缝滚动 | vue3-seamless-scroll | ^2.0 |
| 图片查看 | viewerjs + v-viewer | — |
| 热力图 | cesium-heatmap-es6 + heatmap.js-fixed | — |
| 空间分析 | turf.js | ^3.0 |

### 3.2 目录结构

```
frontend/src/
├── main.js                     # 应用入口（注册所有插件）
├── App.vue                     # 根组件（CesiumView + HomePage）
├── style.scss                  # 全局样式
│
├── router/
│   └── index.js                # 路由配置（hash 模式，当前仅有 / 路由）
│
├── store/
│   ├── index.js                # Pinia store（useLineData, useMeasureData）
│   ├── staticData.js           # 静态常量（线路颜色、换乘站、预警数据等）
│   └── menuData.js             # 底部导航菜单定义（5 项）
│
├── api/
│   ├── request.js              # Axios 实例（base URL、拦截器）
│   └── line.js                 # API 封装（getLine, getLinePlan, getStationInfo, getWeather）
│
├── views/
│   ├── CesiumView.vue          # Cesium 3D 地球初始化容器
│   ├── HomePage.vue            # 主页布局（Header + Content + Footer）
│   └── Content.vue             # 仪表盘面板网格（6 个面板 + router-view）
│
├── components/
│   ├── Header.vue              # 顶栏（城市、时间、天气、标题）
│   ├── Footer.vue              # 底部导航栏
│   ├── Panel.vue               # 可复用面板容器
│   ├── HlsLive.vue             # 直播视频播放器
│   └── charts/
│       ├── OperateStatic.vue   # 运营统计饼图（ECharts）
│       ├── HistoryWarning.vue  # 历史预警趋势折线图（ECharts）
│       ├── SubwayActivity.vue  # 活动信息无缝滚动列表
│       ├── GuestsRate.vue      # 客流率柱状图（ECharts）
│       ├── LineScan.vue        # 线路图查看器（ViewerJS）
│       └── HlsLive.vue         # 直播视频（副本）
│
├── cesiumTools/
│   ├── sceneManager.js         # Cesium Viewer 初始化、场景配置、3D 瓦片加载
│   ├── mapPlugin.js            # 坐标转换（WGS84/GCJ02/BD09）、腾讯/谷歌影像
│   ├── echartsOpts.js          # ECharts 配置工厂函数
│   └── Bubble/
│       ├── htmlMarker.js       # SimpleLabel 类：Vue 组件 → Cesium HTML 叠加层
│       ├── MakerTemplate.vue   # 站点标记弹窗模板
│       ├── PopupCar.vue        # 列车信息弹窗模板
│       └── PopupQuery.vue      # 站台查询弹窗模板
│
├── Tools/
│   └── ToolBar.vue             # 工具栏（全屏、鼠标坐标、图层控制等）
│
└── assets/                     # 静态资源
    ├── skyBox/                 # 天空盒（6 面纹理）
    ├── model/metro.gltf        # 地铁 3D 模型
    ├── materialResources/      # 自定义着色器材质
    ├── uiResources/            # UI 图片资源（面板、按钮、图标等）
    └── *.ttf/*.otf             # 自定义字体
```

### 3.3 组件层级架构

```
App.vue
└── <v-scale-screen> (1920×1080 自适应缩放)
    ├── CesiumView.vue         ← 全屏 3D 地球层（z-index: 2）
    │   └── ToolBar.vue        ← 覆盖工具栏（slot）
    └── HomePage.vue           ← UI 叠加层（z-index: 10, pointer-events: none）
        ├── Header.vue         ← 顶部标题栏
        ├── Content.vue        ← 仪表盘面板网格
        │   ├── Panel > OperateStatic.vue    (pie chart)
        │   ├── Panel > LineScan.vue         (image viewer)
        │   ├── Panel > HistoryWarning.vue   (line chart)
        │   ├── Panel > SubwayActivity.vue   (scroll list)
        │   ├── Panel > GuestsRate.vue       (bar chart)
        │   ├── Panel > HlsLive.vue          (video player)
        │   └── <router-view>               (子页面)
        └── Footer.vue         ← 底部导航栏
```

### 3.4 路由设计

| 路由 | 页面 | 说明 |
|---|---|---|
| `/` | Content（仪表盘） | 首页大屏面板 |
| `/current_route` | 实时轨迹 | 列车实时追踪（预留） |
| `/key_activity` | 重点活动 | 重点活动展示（预留） |
| `/progress_history` | 发展历程 | 线路建设历程（预留） |
| `/station_manage` | 站点管理 | 站点管控页面（预留） |

> **注意：** 当前 `frontend/` 中仅实现了 `/` 路由，其余子页面尚未从 `teacher-demo/` 迁移。

### 3.5 数据流架构

```
┌──────────┐     HTTP/WS      ┌──────────────┐
│  NestJS  │ ←──────────────→ │   Axios 实例  │
│  Backend │   /api/v1/*      │ (request.js) │
│ :8092    │                   └──────┬───────┘
└──────────┘                          │
                                      ▼
                              ┌──────────────┐
                              │  API 封装层   │
                              │  (line.js)   │
                              │  GCJ02→WGS84 │
                              └──────┬───────┘
                                     │
                                     ▼
                     ┌───────────────────────────┐
                     │      Pinia Store           │
                     │  useLineData (lineData,    │
                     │  viewer, tileset)          │
                     │  useMeasureData            │
                     └──────────┬────────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                  ▼
     ┌────────────┐   ┌──────────────┐   ┌──────────────┐
     │ Cesium 3D  │   │  ECharts 图表 │   │  UI 组件     │
     │ 场景渲染    │   │  数据可视化   │   │  信息展示    │
     │ (线路/站点  │   │  (饼图/柱图   │   │  (列表/面板  │
     │  列车/建筑) │   │   /折线图)    │   │   /视频)     │
     └────────────┘   └──────────────┘   └──────────────┘
```

### 3.6 构建配置要点

- **开发环境：** Cesium 从本地 `node_modules` 拷贝；3D 瓦片从 `localhost:666` 加载
- **生产环境：** Cesium 从 unpkg CDN 加载（externalize）；3D 瓦片从生产服务器加载
- **坐标处理：** 后端返回 GCJ-02（火星坐标），前端统一转换为 WGS-84 后再用于 Cesium
- **屏幕适配：** 以 1920×1080 为设计基准，通过 `v-scale-screen` 等比缩放

---

## 四、老师示例架构（`teacher-demo/`）

### 4.1 与当前前端的差异

老师示例是一个**功能更完整**的参考实现，当前 `frontend/` 在其基础上裁剪和重构。主要差异：

| 维度 | teacher-demo（老师示例） | frontend（当前开发） |
|---|---|---|
| **后端** | Go 二进制（`api/api.exe`） | NestJS 重写 |
| **子页面** | 5 个完整页面（实时轨迹/重点活动/发展历程/站点管理/路线设计） | 仅首页仪表盘，其余未迁移 |
| **cesiumTools** | 完整：场景管理、特效控制、热力图、自定义时间轴、水效果、昼夜切换、自定义 Shader、标记管理器 | 精简：场景管理、地图插件、Bubble 系统 |
| **工具栏** | 完整工具栏（图层控制、皮肤切换、全屏、鼠标坐标等） | 基础工具栏（部分被注释） |
| **视频播放** | HLS + FLV 双模式 | 仅 HLS |
| **自定义 Shader** | 建筑昼夜着色器、水面着色器、发光锥体、圆形光晕 | 暂无 |

### 4.2 老师示例独有的核心模块

#### 4.2.1 Cesium 特效系统（`cesiumTools/`）

```
cesiumTools/
├── sceneManager.js         # Viewer 初始化、场景、着色器、昼夜切换、水面
├── effectController.js     # Entity 管理器（线路/站点/锥体/热力图 增删改）
├── mapPlugin.js            # 坐标转换 + 腾讯/谷歌自定义影像提供者
├── core.js                 # 坐标/几何工具函数
├── echartsOpts.js          # 全部 ECharts 图表配置
├── positionStatusBar.js    # 鼠标位置状态栏
├── cesiumHeatMap.js        # 热力图叠加层
├── texutruedCircle.js      # 自定义圆形光晕材质
├── wallMaterial.js         # 自定义墙面渐变材质
├── flvjs-tech.js           # FLV.js 适配 video.js
├── Bubble/
│   ├── htmlMarker.js       # SimpleLabel 类
│   └── htmlMarkerManager.js # 性能优化的标记管理器（统一 postRender）
└── TimeLine/
    ├── timeline.js         # 完整自定义时间轴控件
    ├── TimelineTrack.js    # 轨道渲染
    └── TimelineHighlightRange.js # 高亮范围渲染
```

#### 4.2.2 昼夜切换系统

`sceneManager.js` 中的 `handleUpdateScene()` 通过计算太阳方向与相机方向的夹角，自动切换：

- **白天模式：** IBL 日间纹理、Phong 光照、建筑高度渐变着色
- **夜晚模式：** IBL 夜间纹理、建筑光带动画、发光圆环、Bloom 后处理、水面发光动画

#### 4.2.3 Entity 缓存管理

`effectController.js` 维护模块级 Entity 缓存数组（`stations[]`, `billboards[]`, `lines[]`, `cones[]`），支持按名称精确控制显示/隐藏，避免重复创建。

#### 4.2.4 自定义时间轴

`TimeLine/timeline.js` 完全重新实现了 Cesium 的时间轴控件，支持缩放、平移、拖拽、触摸交互，时间刻度从毫秒到世纪。

### 4.3 老师示例的完整页面清单

| 页面组件 | 路由 | 功能描述 |
|---|---|---|
| `Content.vue` | `/` | 首页仪表盘（7 面板网格） |
| `CurrentRoute.vue` | `/current_route` | 列车实时轨迹追踪（3D 列车动画） |
| `KeyActivity.vue` | `/key_activity` | 重点活动可视化（自定义墙面材质） |
| `Progress.vue` | `/progress_history` | 线路建设发展历程时间轴 |
| `StationManage.vue` | `/station_manage` | 站点管理（站控措施） |
| `RouteDesign.vue` | — | 路线规划/设计页面 |

---

## 五、系统交互全景图

```
┌──────────────────────────────────────────────────────────┐
│                      浏览器客户端                         │
│  ┌────────────────────────────────────────────────────┐  │
│  │              Vue 3 SPA (v-scale-screen)             │  │
│  │  ┌──────────────┐  ┌─────────────────────────────┐ │  │
│  │  │  CesiumJS    │  │      UI 叠加层               │ │  │
│  │  │  3D 地球     │  │  Header / Content / Footer   │ │  │
│  │  │  · 建筑模型   │  │  · ECharts 图表面板          │ │  │
│  │  │  · 地铁线路   │  │  · 视频监控                  │ │  │
│  │  │  · 站点标记   │  │  · 活动列表                  │ │  │
│  │  │  · 列车动画   │  │  · 导航菜单                  │ │  │
│  │  └──────┬───────┘  └──────────────┬──────────────┘ │  │
│  │         │                         │                 │  │
│  │         └─────────┬───────────────┘                 │  │
│  │                   │                                 │  │
│  │          ┌────────┴────────┐                        │  │
│  │          │   Pinia Store   │                        │  │
│  │          │  (状态管理中心)   │                        │  │
│  │          └────────┬────────┘                        │  │
│  └───────────────────┼────────────────────────────────┘  │
└──────────────────────┼───────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ NestJS   │ │ 高德地图  │ │ 3D 瓦片  │
    │ Backend  │ │   API    │ │  Server  │
    │ :8092    │ │ (天气/路线)│ │ :666     │
    └────┬─────┘ └──────────┘ └──────────┘
         │
    ┌────┴─────┐
    │  MySQL   │
    │ :3306    │
    │smart_metro│
    └──────────┘
```

---

## 六、迁移与开发建议

基于三份代码的对比分析，当前 `frontend/` 处于**从老师示例裁剪重构的早期阶段**：

### 6.1 已完成

- [x] 基础项目骨架搭建（Vue 3 + Vite + CesiumJS）
- [x] NestJS 后端重写（替代 Go 后端）
- [x] 首页仪表盘面板（6 个图表面板）
- [x] 基础 Cesium 场景初始化（含 3D 建筑瓦片）
- [x] 坐标转换系统（GCJ-02 → WGS-84）
- [x] API 通信层（Axios + 拦截器）
- [x] 自定义字体和 UI 皮肤

### 6.2 待迁移（从 teacher-demo 到 frontend）

- [ ] **子页面迁移：** CurrentRoute（实时轨迹）、KeyActivity（重点活动）、Progress（发展历程）、StationManage（站点管理）、RouteDesign（路线设计）
- [ ] **Cesium 特效系统：** 昼夜切换着色器、水面效果、建筑光带动画
- [ ] **Entity 缓存管理：** `effectController.js` 的线路/站点/锥体管理
- [ ] **热力图：** `cesiumHeatMap.js` 集成
- [ ] **自定义时间轴：** `TimeLine/` 组件
- [ ] **FLV 视频支持：** `FlvVideo.vue` + `flvjs-tech.js`
- [ ] **图层控制面板：** `LineController.vue` + `SkinSwitch.vue`
- [ ] **完整工具栏：** 鼠标坐标、图层切换等
- [ ] **WebSocket 实时数据：** 连接后端 `/ws/train-position` 实现真实列车位置更新

### 6.3 后端待完善

- [ ] 替换模拟数据为真实数据源
- [ ] 添加认证/授权中间件
- [ ] 添加单元测试和 E2E 测试
- [ ] WebSocket 与真实数据源对接

---

## 七、技术关键词

`Vue 3` `CesiumJS` `NestJS` `TypeScript` `Vite` `Pinia` `ECharts` `WebSocket` `MySQL` `TypeORM` `Docker` `GCJ-02/WGS-84坐标转换` `3D Tiles` `GLSL自定义着色器` `昼夜切换` `HTML Overlay 标记系统` `v-scale-screen自适应` `高德地图API` `武汉地铁` `数字孪生`
