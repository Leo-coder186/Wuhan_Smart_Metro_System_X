<!--
 * @Description: 路径规划结果展示卡片
 *
 * 位置：路径规划模式下，显示在页面右侧
 * 显示内容：
 *   1. 路线概览卡：起止线路名 > 换乘线路 > 终点线路 + 总距离（公里）
 *   2. 路线详情卡：折叠面板展示每段地铁线路
 *      - 线路名 + 换乘信息
 *      - 上车/下车站点
 *      - 途径站点列表（可点击跳转）
 *      - 每段线路用对应颜色渲染
 *
 * Props:
 *   - routeInfo: 路径规划数据 { distance, stations: [...] }
 *   - cacheData: 地图上已渲染的实体缓存（用于站点聚焦跳转）
 * @Date: 2024-05-21
-->
<template>
    <div class="display-card">
        <!-- 路线概览卡片 -->
        <a-card title="路线概览" style="margin-bottom: 10px;background: transparent;color: #fff;" :bordered="false"
            size="small">
            <div class="header">
                <!-- 线路名序列（如：1号线 > 2号线 > 4号线） -->
                <div class="item-wrapper">
                    <div class="header-item" v-for="(item, index) in headerTitles">
                        <i class="iconfont metro-ditie"></i>
                        <span style="margin-left: 4px;">{{ item }}</span>
                        <!-- 箭头分隔符（最后一项不显示） -->
                        <span v-if="index !== headerTitles.length - 1">&gt;</span>
                    </div>
                </div>
                <!-- 总距离（公里） -->
                <div style="font-size: 18px; font-weight:bold;;color: rgb(156, 148, 218);line-height: 25px;margin-left: 20px;">
                    {{ distanceTotal }} <span style="font-size: 10px;color: #ddd;">公里</span>
                </div>
            </div>
        </a-card>

        <!-- 路线详情卡片（折叠面板） -->
        <a-card title="路线详情" style="background: transparent;color: #fff;" :bordered="false" size="small">
            <div class="detail">
                <!--
                  a-collapse: Ant Design 折叠面板组件
                  ghost: 透明背景模式
                  v-model:activeKey: 控制当前展开的面板
                -->
                <a-collapse v-model:activeKey="activeKey" ghost>
                    <!-- 遍历每段线路，一段地铁线路 = 一个折叠面板 -->
                    <a-collapse-panel :key="sitem.id" v-for="(sitem, sIndex) in stationInfo"
                        :style="collapseStyle">
                        <template #header>
                            <div class="header-collapse">
                                <!-- 线路名 -->
                                {{ sitem.name }}
                                <!-- 换乘信息（如果有换乘） -->
                                <div class="changed" v-if="changeStations[sIndex]">
                                    <i class="iconfont metro-ly_huancheng" style="color: #9c94da;"></i>
                                    {{ changeStations[sIndex].name }}
                                    <span style="color: #ddd; font-size: 12px;">站内换乘</span>
                                </div>
                            </div>
                        </template>
                        <!-- 折叠面板内容：显示上车/下车/途径站 -->
                        <a-card style="padding-left: 20px;position: relative; margin-bottom: 10px;height:200px;color: #fff;"
                            :bordered="false"
                            :style="{ backgroundColor: getOpacityColor(sitem.color, 0.5) }"
                            size="small">
                            <!-- 左侧竖线装饰 -->
                            <div class="line" :style="{ backgroundColor: getOpacityColor(sitem.color, 0.7) }">
                                <div class="icon">
                                    <i class="iconfont metro-ditie"></i>
                                </div>
                            </div>
                            <!-- 出发站（上车） -->
                            <div class="departure" @click="jumpStation(sitem.departure_stop, sitem)">
                                {{ sitem.departure_stop.name }}
                                <span style="color: #ddd;font-size: 12px;margin-left: 10px;">上车</span>
                            </div>
                            <!-- 到达站（下车） -->
                            <div class="arrival" @click="jumpStation(sitem.arrival_stop, sitem)">
                                {{ sitem.arrival_stop.name }}
                                <span style="color: #ddd;font-size: 12px;margin-left: 10px;">下车</span>
                            </div>
                            <hr>
                            <!-- 途径站点列表（可点击跳转） -->
                            <div class="via_station">
                                <div class="station" v-for="item in sitem.via_stops" @click="jumpStation(item, sitem)">
                                    {{ item.name }}
                                </div>
                            </div>
                        </a-card>
                    </a-collapse-panel>
                </a-collapse>
            </div>
        </a-card>
    </div>
</template>

<script setup>
import { computed, ref, onMounted } from "vue";
import { focusOnStation } from '@/cesiumTools/effectController'
import { useLineData } from '@/store'

const lineData = useLineData()
let viewer

onMounted(() => {
    viewer = lineData.Viewer
})

// routeInfo 数据格式说明：
// {
//   distance: "总距离（米）",
//   stations: [{
//     arrival_stop: { name, location, type },
//     departure_stop: { name, location, type },
//     name: "线路名",
//     color: "#218acd",
//     via_stops: [{ name, location, type }]
//   }]
// }
const props = defineProps({
    routeInfo: {
        type: Object,
        default: {},
    },
    cacheData: {
        type: Object,
        default: {}
    }
});

const collapseStyle = 'border-radius: 4px;max-height:240px;border: 0;overflow-y: hidden;margin-bottom:4px;'

// 折叠面板当前展开的 key（空数组 = 全部折叠）
const activeKey = ref([]);

// 路线标题 - 提取每条线路名（去掉"(换乘)"后缀）
const headerTitles = computed(() => {
    return props.routeInfo.stations.map((item) => item.name.split("(")[0]);
});

// 总距离（米 → 公里，保留1位小数）
const distanceTotal = computed(() => {
    const distance = (Number(props.routeInfo.distance) / 1000).toFixed(1)
    return `${distance}`;
});

// 站点信息（直接返回 stations 数组）
const stationInfo = computed(() => {
    return props.routeInfo.stations
})

// 换乘站列表（筛选 type === '换乘站' 的站点）
const changeStations = computed(() => {
    const result = props.routeInfo.stations.filter(item => {
        const { arrival_stop } = item
        return arrival_stop.type === '换乘站'
    }).map(m => m.arrival_stop)
    return result
})

/**
 * 将十六进制颜色转为带透明度的 rgba 格式
 * @param {string} thisColor - 十六进制颜色（如 "#218acd"）
 * @param {number} thisOpacity - 透明度（0-1）
 * @returns {string} rgba 颜色字符串（如 "rgba(33,138,205,0.5)"）
 */
const getOpacityColor = (thisColor, thisOpacity) => {
    let theColor = thisColor.toLowerCase();
    // 十六进制颜色正则
    let r = /^#([0-9a-fA-f]{3}|[0-9a-fA-f]{6})$/;
    if (theColor && r.test(theColor)) {
        // 处理3位简写格式（如 #abc → #aabbcc）
        if (theColor.length === 4) {
            let sColorNew = "#";
            for (let i = 1; i < 4; i += 1) {
                sColorNew += theColor.slice(i, i + 1).concat(theColor.slice(i, i + 1));
            }
            theColor = sColorNew;
        }
        // 将每两个十六进制字符转为十进制数值
        let sColorChange = [];
        for (let i = 1; i < 7; i += 2) {
            sColorChange.push(parseInt("0x" + theColor.slice(i, i + 2)));
        }
        return "rgba(" + sColorChange.join(",") + "," + thisOpacity + ")";
    }
    return theColor;
}

/**
 * 点击站点 → 视角跳到该站点并高亮
 * 使用 effectController.focusOnStation 实现聚焦和闪烁效果
 */
const jumpStation = (item, lineData) => {
    focusOnStation(viewer, item.name, props.cacheData)
}
</script>

<style scoped>
/* 展示卡片容器 */
.display-card {
    width: 500px;
    position: absolute;
    right: 14%;
    top: 26%;
    pointer-events: all;
    padding: 4px;
    background-color: rgba(0, 0, 0, 0.6);
    border: 1px solid #885f12;
}

.item-wrapper {
    display: flex;
    font-size: 12px;
}

.header {
    display: flex;
    justify-content: space-between;
}

.header-item {
    margin: 0 5px;
}

/* 左侧竖线装饰（表示线路） */
.line {
    position: absolute;
    top: 4px;
    left: 10px;
    width: 4px;
    height: 185px;
    background-color: #fff;
    display: flex;
    justify-content: center;
    align-items: center;
}

/* 竖线顶部圆点 */
.line::after {
    content: '';
    position: absolute;
    left: 50%;
    top: -3px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #fff;
    transform: translateX(-50%);
}

/* 竖线底部圆点 */
.line::before {
    content: '';
    position: absolute;
    left: 50%;
    bottom: -3px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #fff;
    transform: translateX(-50%);
}

.icon {
    padding: 4px;
    border-radius: 50%;
}

/* 途径站点列表 - 可滚动 */
.via_station {
    max-height: 110px;
    overflow-y: scroll;
    margin: 10px 0;
    color: #ddd;
    cursor: pointer;
}

.station:hover {
    background-color: #885f12;
}

/* 上车/下车站点 */
.arrival,
.departure {
    margin-bottom: 4px;
    cursor: pointer;
}

.header-collapse {
    width: 100%;
    display: flex;
    justify-content: space-between;
}
</style>
