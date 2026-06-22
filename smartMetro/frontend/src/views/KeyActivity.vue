<!--
 * @Description: 重点活动页面 - 展示当天各线路的重点保障活动
 *
 * 功能流程：
 *   1. 左侧线路色块选择器 - 可点击切换线路
 *   2. 右侧活动面板 - 显示该线路当天需要重点保障的活动列表
 *   3. 点击线路 → 视角飞到线路质心、高亮线段、在相关站点添加渐变圆柱标记
 *   4. 点击活动条目 → 视角飞到该活动对应的站点
 *
 * 视觉效果：
 *   - 选中线路后，在涉及活动的站点位置添加渐变光柱（半透明圆锥体）
 *   - 使用电子围栏材质（wallMaterial）
 *
 * 数据来源：@/store/staticData 中的 activity 数组（模拟数据）
 * @Date: 2024-05-08
-->
<template>
    <!-- 左侧：线路选择面板 -->
    <div id="subLine-controller">
        <div class="item-wrapper">
            <div class="item" v-for="item in subLineData" @click="handleItemClick(item)">
                <div class="box" :style="{ borderColor: item.color, backgroundColor: item.color }"></div>
                <span :style="{ color: '#34c5cf' }">{{ item.name.slice(-3) }}</span>
            </div>
        </div>
    </div>

    <!-- 右侧：重点活动面板 -->
    <div class="active-panel">
        <div class="header">
            <strong>重点活动</strong>
            <!-- 显示当天日期 -->
            <span>{{ date }}</span>
        </div>
        <div class="content">
            <!-- 有活动数据时显示列表 -->
            <div class="active-wrapper" v-if="activityData.length">
                <div v-for="item in activityData"
                    :class="['acitve-item', item.isActive ? 'item-active' : '']"
                    @click="clickActiveItem(item)">
                    <div>{{ item.activedTime }}</div>    <!-- 活动时间 -->
                    <div>{{ item.activedPlace }}</div>   <!-- 活动地点 -->
                    <div>{{ item.activity }}</div>       <!-- 活动名称 -->
                </div>
            </div>
            <!-- 无数据时显示空状态 -->
            <a-empty v-else :image="simpleImage" description="无数据" />
        </div>
    </div>
</template>

<script setup>
import { computed, onMounted, ref, onBeforeUnmount } from 'vue'
import { useLineData } from '@/store'
import { activity } from '@/store/staticData'
import {
    flyToLine,        // 飞到指定线路的质心位置
    binkLineByName,   // 高亮闪烁指定线路
    addGradientCone,  // 添加渐变圆锥体（活动标记）
    removeAllCones,   // 清除所有圆锥体标记
    flyToCone         // 飞到指定圆锥体的位置
} from '@/cesiumTools/effectController'
import dayjs from 'dayjs'

const lineData = useLineData()
const subLineData = computed(() => lineData.allData)
let viewer

onMounted(() => {
    viewer = lineData.Viewer
})

// 离开页面时清除所有活动标记（渐变圆柱）
onBeforeUnmount(() => {
    removeAllCones(viewer)
})

// 当前日期（YYYY-MM-DD 格式）
const date = computed(() => {
    return dayjs().format("YYYY-MM-DD");
});

// 重点活动列表
const activityData = ref([]);

// 当前线路上被激活（有活动）的站点
const currentStations = ref([])

// ============================================
// 点击线路：飞往线路质心 + 高亮线条 + 在活动站点显示渐变标记
// ============================================
const handleItemClick = (item) => {
    const { name, stationsList, color } = item

    // 视角飞往该线路的质心点
    flyToLine(viewer, name)

    // 高亮闪烁该线路
    binkLineByName(name)

    // 记录当前线路的站点列表
    currentStations.value = stationsList

    // 填充活动数据
    activityData.value = activity

    // 在活动涉及的站点上显示渐变圆柱标记
    showActiveArea(color)
}

// ============================================
// 在活动涉及的站点位置添加渐变圆柱体标记
// 原理：
//   1. 清除旧标记
//   2. 从活动数据中提取涉及的站点 ID
//   3. 在当前线路的站点列表中按 ID 匹配
//   4. 为匹配的站点添加渐变圆锥体（半透明光柱）
// ============================================
const showActiveArea = (color) => {
    // 先清除旧标记
    removeAllCones(viewer)

    // 提取活动涉及的站点 ID 列表
    const ids = activityData.value.map(item => item.id)

    // 给站点分配临时 ID（与活动数据对齐），筛选出有活动的站点
    const activedStations = currentStations.value.map((item, index) => {
        item.id = index
        return item
    }).filter(item => ids.includes(item.id))

    // 为每个有活动的站点添加渐变圆柱
    activedStations.forEach(item => {
        const { position, id } = item
        addGradientCone(viewer, {
            position,   // 站点经纬度坐标
            color,      // 线路颜色
            name: id    // 用作标识符
        })
    })
}

// ============================================
// 点击具体活动条目 → 视角飞到该活动的站点
// ============================================
const clickActiveItem = (item) => {
    const { id } = item
    flyToCone(viewer, id)
}
</script>

<style scoped>
#subLine-controller {
    position: absolute;
    bottom: 0;
    left: 34%;
    transform: translateX(-50%);
    width: 146px;
    height: 140px;
    background-color: rgba(0, 0, 0, 0.3);
    border: 1px solid #664a16;
    padding: 4px;
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
}

.item {
    width: 65px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 3px;
    background-color: rgba(255, 255, 255, 0.2);
    border: 1px solid #885f12;
    color: #fff;
    font-size: 10px;
    pointer-events: all;
    cursor: pointer;
}

.item:hover {
    border: 1px solid #d8961a;
}

.item>span {
    line-height: 9.005px;
}

.item>input {
    outline: none;
    border: none;
    transition: all 0.3s ease;
}

.item-wrapper {
    display: flex;
    justify-content: space-between;
    align-content: space-around;
    flex-wrap: wrap;
    flex: 1;
}

/* 重点活动面板 */
.active-panel {
    width: 500px;
    height: 140.006px;
    border: 1px solid #ab7818;
    background-color: rgba(0, 0, 0, 0.3);
    position: absolute;
    left: 39%;
    bottom: 0;
    color: #fff;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

/* 面板标题 - 金色渐变文字 */
.active-panel>.header {
    height: 30px;
    padding: 4px;
    background: rgb(255, 255, 255);
    background-image: linear-gradient(180deg,
            rgba(255, 255, 255, 1) 9%,
            rgba(211, 156, 50, 1) 57%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: -0.521vw;
    font-family: "等线Bold";
}

.active-panel>.header>strong {
    font-weight: normal;
    margin-right: 10px;
}

.active-panel>.header>span {
    font-size: 12px;
}

.content {
    flex: 1;
}

/* 活动列表水平排列 */
.active-wrapper {
    display: flex;
    align-items: center;
    justify-content: space-around;
    height: 100%;
}

/* 单个活动卡片 */
.acitve-item {
    width: 150px;
    height: 70px;
    border: 1px solid #ab7818;
    background-color: rgba(214, 174, 41, 0.1);
    margin: 4px;
    text-align: center;
    pointer-events: all;
    cursor: pointer;
    transition: all 0.3s linear;
    color: #37b3bb;
    padding-top: 12px;
    font-size: 12px;
}

.acitve-item:hover {
    background-color: rgba(214, 174, 41, 0.3);
    color: #fff;
}

/* 选中状态的活动卡片 */
.item-active {
    background-color: rgba(214, 174, 41, 0.3);
    color: #fff;
}
</style>
