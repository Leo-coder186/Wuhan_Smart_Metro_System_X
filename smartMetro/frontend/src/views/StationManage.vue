<!--
 * @Description: 站点管理页面 - 地铁站点综合查询与管控
 *
 * 页面布局（三栏）：
 *   左侧：查询模式选择面板
 *     - 站点拥挤度（热力图）
 *     - 路径规划（跳转 RouteDesign 组件）
 *     - 站控措施（每个站点随机分配管控措施）
 *   中间：线路 + 站点选择器
 *     - 上方：地铁线路色块选择器
 *     - 下方：当前线路的站点列表
 *   右侧：站控措施图例面板
 *
 * 交互流程：
 *   1. 点击线路 → 展开站点列表
 *   2. 点击站点 → 视角飞到该站点 + 站点闪烁 + 显示查询效果
 *   3. 选择查询模式 → 切换对应的地图效果
 *
 * 技术要点：
 *   - 使用 useMeasureData Store 在组件间共享站控措施数据
 *   - 热力图通过 effectController.renderHeat 渲染
 *   - 站点聚焦通过 effectController.focusOnStation 实现
 *   - 路径规划模式复用 RouteDesign.vue 组件
 * @Date: 2024-05-08
-->
<template>
    <div class="wrapper">
        <!-- ========== 左侧：查询控制面板 ========== -->
        <div class="left-wrapper">
            <div class="query-controller">
                <div style="color: #fff;margin-bottom: 4px;">查询模式选择</div>
                <!-- 竖线分隔 -->
                <div class="divide"></div>
                <!-- 遍历查询模式选项 -->
                <div class="query-item" v-for="item in queryItems">
                    <!-- 图标：选中态/默认态切换 -->
                    <i :class="[
                        'iconfont',
                        item.icon,
                        'commonIcon',
                        item.active ? 'commonIconActive' : '',
                    ]"></i>
                    <!-- 查询模式按钮：选中态/默认态切换 -->
                    <span :class="[
                        'query-item-title',
                        item.active ? 'query-item-title-active' : '',
                    ]" @click="chooseQueryItem(item)">
                        {{ item.title }}
                    </span>
                </div>
            </div>
        </div>

        <!-- ========== 中间：线路 + 站点选择器（路径规划模式下隐藏） ========== -->
        <div class="center-wrapper" v-if="!isInRouteDesign">
            <!-- 地铁线路选择 -->
            <div id="subLine-controller">
                <div class="title-bg">
                    <i class="iconfont metro-lineRoute"></i> 地铁线路
                </div>
                <div class="item-wrapper">
                    <div class="item" v-for="item in subLineData" @click.stop="handleItemClick(item)">
                        <!-- 选中时填充颜色，否则透明 -->
                        <div class="box" :style="{
                            borderColor: item.color,
                            backgroundColor: item.choosed ? item.color : 'rgba(0,0,0,0)',
                        }"></div>
                        <span :style="{ color: '#34c5cf' }">{{ item.name.slice(-3) }}</span>
                    </div>
                </div>
            </div>

            <!-- 站点列表 -->
            <div id="station-controller">
                <div class="title-bg">
                    <i class="iconfont metro-ditie"></i> 地铁站点
                </div>
                <div class="item-wrapper">
                    <div class="item" v-for="item in stationData" @click="chooseStation(item)">
                        <!-- 选中时白色，否则透明 -->
                        <div class="box" :style="{
                            backgroundColor: item.choosed ? '#fff' : 'rgba(0,0,0,0)',
                        }"></div>
                        <span :style="{ color: '#34c5cf' }">{{ item.name }}</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- ========== 右侧：站控措施图例面板 ========== -->
        <div class="right-wrapper">
            <div class="legend">
                <div class="title">
                    <span style="margin-right: 14px">图标</span>
                    <span>站控措施</span>
                </div>
                <!-- 展示所有站控措施类型的图标和名称 -->
                <div class="query-item" v-for="item in solutions">
                    <i :class="['iconfont', item.iconName, 'commonIcon']"></i>
                    <span class="query-item-title">
                        {{ item.title }}
                    </span>
                </div>
            </div>
        </div>

        <!-- ========== 路径规划面板（仅路径规划模式显示） ========== -->
        <RouteDesign v-if="isInRouteDesign" />
    </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import {
    stationMangeItems,     // 查询模式菜单配置
    station_solutions,     // 站控措施类型列表
} from "@/store/staticData";
import RouteDesign from './RouteDesign.vue'
import {
    focusOnStation,       // 聚焦到站点（视角跳动 + 闪烁效果）
    renderHeat             // 渲染站点拥挤度热力图
} from '@/cesiumTools/effectController.js'
import { useLineData, useMeasureData } from '@/store'

// ========== Store 实例 ==========
const measureDataStore = useMeasureData()  // 站控措施数据 Store
const lineData = useLineData()            // 线路数据 Store

// ========== 响应式数据 ==========
const solutions = ref(station_solutions);  // 站控措施图例列表
let viewer
let removeHeat                             // 热力图的清除函数（renderHeat 返回）

const queryItems = ref(stationMangeItems);  // 查询模式列表
const subLineData = ref([])                 // 线路数据（含 choosed 状态）
const stationData = ref([]);                // 当前选中线路的站点列表
const currentLine = ref("");                // 当前选中的线路名
const queryWay = ref("");                   // 当前激活的查询模式名称
const isInRouteDesign = ref(false)          // 是否在路径规划模式

// ========== 生命周期 ==========

onMounted(() => {
    // 复制线路数据并添加 choosed 状态
    subLineData.value = lineData.allData.map(item => ({ ...item, choosed: false }))
    viewer = lineData.Viewer
})

// 离开页面时清除效果
onBeforeUnmount(() => {
    recoverEffect()
})

// ============================================
// 点击地铁线路 → 显示该线路的站点列表
// ============================================
const handleItemClick = (item) => {
    const { stationsList, id, name } = item;
    currentLine.value = name;
    stationData.value = stationsList;

    // 更新选中状态（单选）
    subLineData.value = subLineData.value.map((n) => {
        n.choosed = id === n.id;
        return n;
    });
};

// ============================================
// 点击查询方式 → 切换地图底图效果
// ============================================
const chooseQueryItem = (item) => {
    // 1. 清除上一次的查询效果
    recoverEffect()
    // 2. 应用新的查询效果
    handleEffect(item.title)

    // 3. 更新 UI 选中状态
    queryItems.value = queryItems.value.map((n) => {
        if (n.id === item.id) {
            n.active = true;
            queryWay.value = item.title;
        } else {
            n.active = false;
        }
        return n;
    });
};

// ============================================
// 清除当前查询效果
// ============================================
const recoverEffect = () => {
    // 移除热力图
    removeHeat && removeHeat()
    // 退出路径规划模式
    isInRouteDesign.value = false
    // 清除站控措施数据
    measureDataStore.clearData()
}

// ============================================
// 根据查询模式分发到具体处理函数
// ============================================
const handleEffect = (title) => {
    if (title === "站点拥挤度") {
        renderClowed();            // 热力图
    } else if (title === '路径规划') {
        isInRouteDesign.value = true  // 显示 RouteDesign 组件
    } else if (title === '站控措施') {
        renderStationMeasure()     // 生成随机站控措施数据
    }
}

// ============================================
// 站控措施数据生成（模拟数据）
// 为每条线路的每个站点随机分配 0-5 个站控措施
// 结果存入 measureDataStore，供其他组件读取
// ============================================
const renderStationMeasure = () => {
    /**
     * 生成 [min, max] 范围内的随机整数
     */
    function getRandomIntInclusive(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * 从数组中随机取 num 个不重复元素
     */
    const getRandomArrayValue = (arr, num) => {
        var sData = arr.slice(0), i = arr.length, min = i - num, item, index;
        while (i-- > min) {
            index = Math.floor((i + 1) * Math.random());
            item = sData[index];
            sData[index] = sData[i];
            sData[i] = item;
        }
        return sData.slice(min);
    }

    // 为每条线路的每个站点生成随机措施
    const resultData = []
    lineData.allData.forEach(item => {
        const { stationsList, color } = item;
        const result = stationsList.map(s => {
            // 随机 0-5 个站控措施
            const measureNum = getRandomIntInclusive(0, 5)
            let measures = getRandomArrayValue(station_solutions, measureNum)
            return {
                name: s.name,
                measures
            }
        })
        resultData.push(result)
    })
    // 存入全局 Store
    measureDataStore.setData(resultData)
}

// ============================================
// 站点拥挤度 - 热力图渲染
// 为每个站点生成 0-1000 的随机拥挤度值
// 使用 Cesium 热力图插件在地图上展示
// ============================================
const renderClowed = () => {
    const dataSource = [];
    subLineData.value.forEach((item) => {
        const { stationsList } = item;
        stationsList.forEach((s) => {
            const { position } = s;
            dataSource.push({
                x: position.lng,       // 经度
                y: position.lat,       // 纬度
                value: Math.ceil(Math.random() * 1000),  // 拥挤度值（0-1000）
            });
        });
    });
    // 渲染热力图，返回清除函数
    removeHeat = renderHeat(viewer, dataSource);
};

// ============================================
// 点击站点 → 聚焦站点 + 闪烁效果
// ============================================
const chooseStation = (item) => {
    // 1. 视角飞往该站点 + 站点闪烁高亮
    focusOnStation(viewer, item.name);

    // 2. 更新站点列表的选中状态
    stationData.value = stationData.value.map((v) => {
        if (v.name === item.name) {
            v.choosed = true;
        } else {
            v.choosed = false;
        }
        return v;
    });
};
</script>

<style scoped>
.wrapper {
    width: 100%;
    height: 100%;
}

/* 左侧：查询模式选择区域 */
.left-wrapper {
    width: 23.438vw;
    height: 100%;
    position: absolute;
    left: 0;
    top: 2.083vw;
}

/* 查询模式列表 */
.query-controller {
    position: relative;
    width: 10.417vw;
    display: flex;
    flex-direction: column;
    margin-left: 1.771vw;
    margin-top: 1.042vw;
}

/* 查询模式项 */
.query-item {
    margin: 4px;
    color: #fff;
    display: flex;
    align-items: center;
}

/* 图标通用样式 */
.commonIcon {
    padding: 2px 6px;
    font-size: 14px;
    background: url("/src/assets/uiResources/icon-wrapper.png");
    background-size: 100% 100%;
    background-repeat: no-repeat;
    pointer-events: all;
    cursor: pointer;
}

/* 图标选中态 */
.commonIconActive {
    background: url("/src/assets/uiResources/icon-wrapper-active.png");
    background-size: 100% 100%;
    background-repeat: no-repeat;
    color: #11916b;
}

.commonIcon:hover {
    background: url("/src/assets/uiResources/icon-wrapper-active.png");
    background-size: 100% 100%;
    background-repeat: no-repeat;
}

/* 按钮通用样式 */
.query-item-title {
    display: inline-block;
    padding: 3px 10px;
    font-size: 10px;
    margin-left: 20px;
    background: url("/src/assets/uiResources/button.png");
    background-size: 100% 100%;
    background-repeat: no-repeat;
    position: relative;
    cursor: pointer;
    pointer-events: all;
}

/* 按钮选中态 */
.query-item-title-active {
    background: url("/src/assets/uiResources/button-active.png");
    background-size: 100% 100%;
    background-repeat: no-repeat;
    color: #11916b;
}

.query-item-title:hover {
    background: url("/src/assets/uiResources/button-active.png");
    background-size: 100% 100%;
    background-repeat: no-repeat;
}

/* 按钮左侧的连接线 */
.query-item-title::after {
    content: "";
    width: 10px;
    height: 1px;
    background-color: rgba(224, 193, 193, 0.693);
    position: absolute;
    top: 50%;
    left: -10px;
}

/* 竖分隔线 */
.divide {
    width: 1px;
    height: 86%;
    position: absolute;
    top: 30px;
    left: 40px;
    background-color: rgba(224, 193, 193, 0.693);
}

/* 地铁线路选择面板 */
#subLine-controller {
    position: absolute;
    bottom: 0;
    left: 34%;
    transform: translateX(-50%);
    width: 7.625vw;
    height: 8.292vw;
    background-color: rgba(0, 0, 0, 0.3);
    border: 1px solid #ab7818;
    display: flex;
    flex-direction: column;
}

.box {
    width: 10px;
    height: 10px;
    border-width: 1px;
    border-style: solid;
    background: transparent;
    user-select: all;
    cursor: pointer;
    transition: all 0.3s linear;
}

.item {
    width: 3.385vw;
    height: 1.042vw;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 0.156vw;
    background-color: rgba(255, 255, 255, 0.2);
    border: 1px solid #885f12;
    color: #fff;
    font-size: 0.521vw;
    pointer-events: all;
    cursor: pointer;
}

.item:hover {
    border: 1px solid #d8961a;
}

.item>span {
    line-height: 0.469vw;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 2.083vw;
}

.item>input {
    outline: none;
    border: none;
    transition: all 0.3s ease;
}

.item-wrapper {
    display: flex;
    justify-content: space-around;
    align-content: space-around;
    flex-wrap: wrap;
    flex: 1;
    padding: 4px;
    overflow: hidden;
}

/* 站点列表面板 */
#station-controller {
    width: 33.458vw;
    height: 8.292vw;
    border: 1px solid #ab7818;
    background-color: rgba(0, 0, 0, 0.3);
    position: absolute;
    left: 39%;
    bottom: 0;
    color: #fff;
    display: flex;
    flex-direction: column;
}

#station-controller .item-wrapper {
    justify-content: flex-start;
}

#station-controller .item {
    margin: 0 7px;
}

/* 标题 - 金色渐变文字 */
.title-bg {
    width: 100%;
    height: 30px;
    color: #fff;
    background-repeat: no-repeat;
    line-height: 30px;
    margin-left: 10px;
    background: rgb(255, 255, 255);
    background-image: linear-gradient(180deg,
            rgba(255, 255, 255, 1) 9%,
            rgba(211, 156, 50, 1) 57%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

/* 右侧站控措施图例 */
.right-wrapper {
    width: 11.417vw;
    height: 100%;
    position: absolute;
    right: 0px;
    top: 2.083vw;
}

/* 图例不可点击 */
.right-wrapper .query-item-title {
    cursor: default;
    pointer-events: none;
}

.right-wrapper .query-item-title::after {
    width: 20px;
    left: -20px;
}

.legend .query-item i {
    pointer-events: none;
    cursor: default;
}

.title {
    color: #fff;
}
</style>
