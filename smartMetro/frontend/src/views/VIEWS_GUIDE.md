# 地铁管控平台 — View 页面组件注释说明

> 所有页面源码已从 teacher-demo 复制到 frontend/src/views/。
> 下面是每个页面的架构、数据流和关键函数说明。

---

## 1. StationManage.vue — 站点管理

### 布局（左中右三栏）
- **左侧**：查询模式选择器（拥挤度 / 站控措施 / 路径规划 / 周边查询）
- **中间**：地铁线路列表（左下角） + 站点列表（右下角），路径规划模式时隐藏
- **右侧**：站控措施图例（纯展示，不可点击）

### 数据流
\\\
lineData.allData (Pinia store)
  → subLineData (响应式数组，含 choosed 标记)
    → 用户点击线路 → handleItemClick()
      → stationData 更新为该线路的站点列表
        → 用户点击站点 → chooseStation()
          → 视角飞到站点（Cesium 特效）
          → 执行当前查询模式的效果

queryItems (来自 staticData.js)
  → 用户点击 → chooseQueryItem()
    → recoverEffect() 清理旧效果
    → handleEffect() 分发到具体渲染函数
\\\

### 核心函数
| 函数 | 说明 |
|------|------|
| \handleItemClick(item)\ | 点击线路 → 站点面板显示该线路的所有站点，当前线路高亮 |
| \chooseStation(item)\ | 点击站点 → 调用 focusOnStation 飞到该站点 + 标记选中 |
| \chooseQueryItem(item)\ | 切换查询模式 → 先清理再执行新效果 |
| \handleEffect(title)\ | 根据模式标题分发：拥挤度→热力图 / 站控→随机标注 / 路径→RouteDesign |
| \enderClowed()\ | 遍历所有站点生成热力图数据，调用 effectController.renderHeat() |
| \enderStationMeasure()\ | 为每个站点随机分配 0-5 种措施，写入 measureDataStore |
| \ecoverEffect()\ | 移除热力图 + 退出路径规划 + 清空站控数据 |
| \ocusOnStation(viewer, name)\ | effectController 提供：Cesium 视角飞到指定站点 |
| \enderHeat(viewer, data)\ | effectController 提供：渲染热力图，返回清除函数 |

### Cesium 集成
- \iewer\ 从 \lineData.Viewer\ (store) 获取，在 \CesiumView.vue\ 中初始化
- 热力图、站点聚焦等特效由 \effectController.js\ 提供
- 离开页面时 \onBeforeUnmount\ → \ecoverEffect()\ 清理所有 Cesium 特效

---

## 2. CurrentRoute.vue — 实时轨迹

### 布局
中间区域展示当前列车运行轨迹监控图，带搜索框和控制按钮。

### 数据流
\\\
后端 WebSocket (train-position.gateway.ts)
  → 实时推送列车位置
  → currentRouteLine (响应式)
    → Cesium 地图上绘制列车实时位置 + 轨迹线
\\\

### 核心函数
| 函数 | 说明 |
|------|------|
| \getCurrentRoutes()\  | 从后端 API 获取当前运营的线路列表 |
| \changeRoute(id)\ | 切换监控的线路 |
| \ocusCar(carId)\ | 视角跟踪指定列车 |
| \uildTrackPolyline()\ | 在 Cesium 上绘制列车运行轨迹 |

---

## 3. KeyActivity.vue — 重点活动

### 布局
左侧活动列表（可滚动），右侧 Cesium 地图展示活动范围。

### 核心函数
| 函数 | 说明 |
|------|------|
| \ocusOnActivity(item)\ | 点击活动 → Cesium 视角飞到活动区域 |

---

## 4. Progress.vue — 发展历程

### 布局
垂直时间轴（echarts 时间线图表）展示地铁建设里程碑。

### 核心函数
| 函数 | 说明 |
|------|------|
| \initTimeline()\ | 初始化 echarts 时间线图表 |
| \lyToMilestone(item)\ | 点击时间节点 → Cesium 视角飞到对应地理位置 |

---

## 5. RouteDesign.vue — 路径规划

### 布局
路径规划面板：起点/终点选择 + 换乘方案列表。嵌入在 StationManage 中使用。

### 核心函数
| 函数 | 说明 |
|------|------|
| \searchPath()\ | 调用后端 getLinePlan API 查询换乘方案 |
| \enderPath(pathIndex)\ | 在 Cesium 地图上高亮显示指定方案路径 |

---

## 6. Content.vue — 首页数据面板

### Grid 布局
\\\
┌─────────┬───────────────┬─────────┐
│ 运营统计 │               │ 线路概览 │
├─────────┤    part2      ├─────────┤
│ 地铁活动 │  (透明窗口    │ 告警趋势 │
├─────────┤   显示底图)   ├─────────┤
│ 客流指标 │               │ 实时影像 │
└─────────┴───────────────┴─────────┘
\\\

### baseMode 逻辑
- 路由为 \/\（首页）→ \aseMode=true\，显示数据面板
- 路由为其他路径 → \aseMode=false\，隐藏面板，全屏显示子页面

---

## 7. CesiumView.vue — Cesium 底图容器

### 初始化流程
\\\
onMounted()
  → initViewer("cesium-viewer")  // sceneManager.js
    → new Cesium.Viewer() → 腾讯底图 → 场景后处理 → 视角飞到武汉
  → getWeather()  // 高德天气 API
  → loadTilesets()  // 3D 建筑白模
  → lineDataStore.setViewer(viewer)  // 存入 Pinia store，供其他组件使用
\\\

---

*生成日期：2026-06-21*
