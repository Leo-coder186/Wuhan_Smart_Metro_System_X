<!--
 * ===================================================================
 * 站点管理页面 注释说明
 * ===================================================================
 *
 * 【布局】左中右三栏
 *   左侧  → queryItems(查询模式选择器)：拥挤度 | 站控措施 | 路径规划 | 周边查询
 *   中间  → subLineData(线路列表) + stationData(站点列表)，路径规划模式时隐藏
 *   右侧  → solutions(站控措施图例)，纯展示，不可点击
 *
 * 【数据流】
 *   lineData.allData (store) → subLineData (响应式) → handleItemClick 选中线路
 *     → stationData 更新为该线路的站点 → chooseStation 选中站点
 *     → chooseQueryItem 切换查询模式 → handleEffect 分发效果
 *       → renderClowed (热力图) | renderStationMeasure (站控标注) | isInRouteDesign (路径规划)
 *
 * 【关键函数】
 *   handleItemClick(item)    - 点击线路，更新站点列表，标记选中
 *   chooseQueryItem(item)    - 点击查询模式，清理旧效果→执行新效果→切换 active
 *   chooseStation(item)      - 点击站点，视角飞到站点+切换选中状态
 *   renderClowed()           - 生成热力图数据→调用 effectController.renderHeat()
 *   renderStationMeasure()   - 为每个站点随机分配站控措施→写入 measureDataStore
 *   recoverEffect()          - 清理所有 Cesium 效果(热力图+站控+路径规划)
 *
 * 【Cesium 交互】
 *   - viewer 实例从 lineData.Viewer (store) 获取，在 CesiumView.vue 中初始化
 *   - effectController.js 提供 focusOnStation / renderHeat 等 Cesium 特效函数
 *   - 离开页面时 onBeforeUnmount 调用 recoverEffect 清理
-->
*** END ***
