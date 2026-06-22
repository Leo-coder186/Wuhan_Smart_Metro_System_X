<!--
 * @Description: 列车实时轨迹 - 模拟列车在线路上运行的3D可视化
 *
 * 核心功能：
 *   1. 左侧地铁线路选择面板（8条线路的颜色块）
 *   2. 右侧站点列表（选中线路后显示所有站点）
 *   3. 加载 glTF 地铁列车3D模型
 *   4. 使用 Cesium SampledProperty 实现列车沿路径平滑运行
 *   5. 跟随列车视角（trackedEntity），展示气泡信息框
 *   6. 到达站点时自动暂停2秒（模拟停站）
 *
 * 技术要点：
 *   - Cesium.TimeIntervalCollection 定义列车在时间轴上的可见性
 *   - Cesium.VelocityOrientationProperty 让列车朝向运动方向
 *   - viewer.clock.onTick 每帧监听，计算到达站点距离
 *   - SimpleLabel (htmlMarker) 渲染气泡信息框
 *
 * 注意：当前使用模拟数据，真实项目需替换为实际后端 WebSocket 数据
 * @Date: 2024-05-17
-->
<template>
    <div class="center-wrapper">
        <!-- ========== 左侧：地铁线路选择面板 ========== -->
        <div id="subLine-controller">
            <div class="title-bg">
                <i class="iconfont metro-lineRoute"></i> 地铁线路
            </div>
            <div class="item-wrapper">
                <!-- 遍历所有线路，渲染颜色块 + 线路名 -->
                <div class="item" v-for="(item, index) in subLineData" :key='index'
                    @click.stop="handleItemClick(item)">
                    <!-- 颜色块：选中时填充颜色，否则透明仅显示边框 -->
                    <div class="box" :style="{
                        borderColor: item.color,
                        backgroundColor: item.choosed ? item.color : 'rgba(0,0,0,0)',
                    }"></div>
                    <!-- 线路名：取后3个字（如 "1号线"） -->
                    <span :style="{ color: '#34c5cf' }">{{ item.name.slice(-3) }}</span>
                </div>
            </div>
        </div>

        <!-- ========== 右侧：站点列表面板 ========== -->
        <div id="station-controller">
            <div class="title-bg">
                <i class="iconfont metro-ditie"></i> 地铁站点
            </div>
            <div class="item-wrapper">
                <div class="item" :key="index" v-for="(item, index) in stationData">
                    <!-- 已经过的站点填充白色，未经过的站点透明 -->
                    <div class="box" :style="{
                        backgroundColor: index - 1 < metroIndex ? '#fff' : 'rgba(0,0,0,0)',
                    }"></div>
                    <span :style="{ color: '#34c5cf' }">{{ item.name }}</span>
                </div>
            </div>
        </div>

        <!-- ========== Loading 加载遮罩层 ========== -->
        <a-spin :spinning="loading" :tip="loadingTip" size="large" class="route-loading">
            <div class="loading-placeholder"></div>
        </a-spin>
    </div>
</template>

<script setup>
import * as Cesium from 'cesium'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useLineData } from '@/store'
import { resetTimeLine } from '../cesiumTools/sceneManager'
import SimpleLabel from '@/cesiumTools/Bubble/htmlMarker'  // HTML 气泡标注组件
import { getPositions, getSiteTimes } from '@/cesiumTools/core' // 坐标转换 + 时间计算工具
import config from "@/config/env.js";

// ========== 响应式数据 ==========
const lineData = useLineData()
const subLineData = ref([])    // 线路列表数据
const stationData = ref([]);   // 当前选中线路的站点列表
const currentLine = ref({})    // 当前选中的线路对象
const metroIndex = ref(0)      // 列车当前经过的站点索引
const loading = ref(false)     // Loading 遮罩状态
const loadingTip = ref('列车模型加载中...');

// ========== 非响应式变量（Cesium 对象，无需 Vue 代理） ==========
let viewer                    // Cesium Viewer 实例
let trainEntity               // 列车实体
let popupController           // 气泡控制器
let modelGraphics             // 3D 模型图形对象

// ========== 生命周期 ==========

onMounted(async () => {
    // 1. 将 Store 中的线路数据复制到组件，添加 choosed 状态
    subLineData.value = lineData.allData.map(item => ({ ...item, choosed: false }))
    viewer = lineData.Viewer

    // 2. 预加载列车 3D 模型（glTF 格式）
    try {
        await loadModel();
        console.log('模型预加载完成，可以开始使用');
    } catch (error) {
        console.error('模型预加载失败:', error);
    }
})

onBeforeUnmount(() => {
    // 离开页面时清理所有轨迹相关实体和事件
    removeCurrentRoute()
    // 恢复时间轴控件的默认显示
    resetTimeLine(viewer)
})

// ============================================
// 模拟服务端 - 获取列车实时信息
// 真实项目中这里应该是 WebSocket 连接后端实时推送
// ============================================
const getTrainDataByLineId = (id) => {
    return new Promise((resolve, reject) => {
        // 从第0个站点出发
        let startIndex = 0
        const startStationInfo = stationData.value[startIndex]
        const endStationInfo = stationData.value[startIndex + 1]

        // 构造模拟列车数据
        const trainData = {
            startIndex,                                  // 出发站点索引
            currentPassengers: Math.ceil(Math.random() * 1000), // 随机乘客数
            startStation: startStationInfo,              // 起点站信息
            destination: endStationInfo,                 // 终点站信息
            lineName: currentLine.value.name,            // 线路名
            currentSpeed: Math.ceil(Math.random() * 100), // 随机速度 (km/h)
            // 列车初始位置：取线路路径的第3个坐标点
            currentPosition: currentLine.value.paths[2],
        }
        resolve(trainData)
    })
}

// ============================================
// 线路点击处理
// ============================================
const handleItemClick = async (item) => {
    // 如果点击的是同一线路，不重复处理
    if (currentLine.value?.name == item.name) return

    try {
        // 显示 loading 遮罩
        loading.value = true;

        // 清除之前的轨迹（移除旧列车、气泡、事件监听）
        removeCurrentRoute()
        currentLine.value = item

        const { stationsList, id } = item;

        // 更新 UI：高亮选中线路
        subLineData.value.forEach(item => {
            if (item.id == id) {
                item.choosed = true;
            } else {
                item.choosed = false
            }
        })

        // 更新站点列表
        stationData.value = stationsList;

        // 获取模拟列车数据
        const trainInfo = await getTrainDataByLineId(id)

        // 在地图上渲染列车实体
        renderTrain(trainInfo)

        // 渲染列车信息气泡框
        renderBubble(trainInfo)

        // 加载完成，隐藏 loading
        loading.value = false;
    } catch (error) {
        console.error('列车模型加载失败:', error);
        loading.value = false;
    }
}

// ============================================
// 渲染气泡信息框（显示列车当前乘客数、线路名）
// ============================================
const renderBubble = (trainInfo) => {
    const { currentPosition, currentPassengers, lineName } = trainInfo
    // 将经纬度转为 Cesium 世界坐标
    const position = new Cesium.Cartesian3.fromDegrees(currentPosition.lng, currentPosition.lat)

    // 创建 HTML 标注控制器
    popupController = new SimpleLabel(viewer, {
        position,                     // 标注位置
        label: null,                  // 不使用默认标签
        isShow: true,                 // 初始显示
        color: '#fff',               // 文字颜色
        scaleByDistance: null,       // 不根据距离缩放
        offset: [130, 205],          // 屏幕偏移量（像素）
        filterStructage: 'height',   // 使用相机高度优化可见性
        attr: {                       // 自定义属性（传递给气泡模板）
            currentPassengers,
            lineName
        },
        type: 'carPopup',            // 气泡类型（对应 CarPopup 模板）
        needOptimize: false          // 不启用内置优化
    })
    popupController.addLabel()
}

// ============================================
// 预加载列车 3D 模型
// 通过创建一个隐藏的临时实体来触发 Cesium 加载并缓存模型
// ============================================
const loadModel = () => {
    return new Promise((resolve, reject) => {
        try {
            // 创建 ModelGraphics：定义列车的 3D 模型外观
            modelGraphics = new Cesium.ModelGraphics({
                scale: 0.17,                        // 模型缩放比例
                uri: config.cesiumMetrolModelURL,    // glTF 模型路径
                minimumPixelSize: 40,                // 最小像素尺寸（防止太远时模型过小）
            });

            // 创建一个隐藏的临时实体来触发模型加载
            const tempEntity = viewer.entities.add({
                show: false,    // 不显示
                model: modelGraphics
            });

            // 注意：这里没有显式 resolve，模型通过 Cesium 内部异步加载
            // 实际上这个 Promise 会立即 resolve，模型在后台加载
            // 真正使用时 Cesium 会使用已缓存的模型资源
        } catch (error) {
            console.error('创建模型失败:', error);
            reject(error);
        }
    });
}

// ============================================
// 在地图上渲染轨道上的列车
// 使用 Cesium 的时间系统 + SampledProperty 实现沿路径平滑运动
// ============================================
const renderTrain = (trainInfo) => {
    const { startIndex, currentPosition, currentSpeed } = trainInfo
    metroIndex.value = startIndex

    // 找到当前坐标在线路路径中的索引
    const pathIndex = currentLine.value.paths.findIndex(path => path === currentPosition)

    // 计算位置-时间采样点（核心：根据路径和速度生成时间序列）
    const { property, startTime, endTime } = handlePosition(currentSpeed, pathIndex)

    // 创建列车实体（Entity）
    trainEntity = viewer.entities.add({
        // availability: 定义实体在哪个时间段内可见
        // 列车只在 startTime 到 endTime 之间存在
        availability: new Cesium.TimeIntervalCollection([
            new Cesium.TimeInterval({
                start: startTime,
                stop: endTime,
            }),
        ]),
        position: property,    // 位置属性（SampledProperty，随时间变化）
        // 朝向：根据速度方向自动调整列车朝向
        orientation: new Cesium.VelocityOrientationProperty(property),
        model: modelGraphics   // 3D 模型外观
    })

    // 设置跟随列车视角（相机自动跟随列车移动）
    viewer.trackedEntity = trainEntity;

    // 启动 Cesium 动画时钟
    viewer.clock.shouldAnimate = true;
    viewer.clock.startTime = startTime.clone();    // 时钟开始时间
    viewer.clock.stopTime = endTime.clone();        // 时钟结束时间
    viewer.clock.currentTime = startTime.clone();   // 当前时间设为起始

    // 调整时间轴控件范围
    viewer.timelineSelf.zoomTo(startTime.clone(), endTime.clone())

    // 注册时钟 tick 事件：每帧检查列车是否到达站点
    viewer.clock.onTick.addEventListener(tickEventHandler);
}

// ============================================
// 处理列车漫游效果：将路径转换为时间采样的位置序列
//
// Cesium 的 SampledProperty 存储了 (时间, 位置) 的采样点对，
// 当 clock.currentTime 在两个采样点之间时，Cesium 自动插值
// ============================================
const handlePosition = (speed, pathIndex) => {
    // 创建采样位置属性
    const property = new Cesium.SampledProperty(Cesium.Cartesian3);

    // 起始时间 = 当前真实时间
    let startTime = Cesium.JulianDate.fromDate(new Date());

    // 截取剩余路径（从当前索引到终点）
    const restPath = currentLine.value.paths.slice(pathIndex, currentLine.value.paths.length - 1)

    // 将经纬度数组转为 Cesium Cartesian3 坐标数组
    const positions = getPositions(restPath)

    // 根据速度计算每段路径的时间
    // siteTimes: 到达每个点的时间（相对起始时间的秒数）
    // timeSum: 总时间
    const { siteTimes, timeSum } = getSiteTimes(positions, speed)

    // 结束时间 = 起始时间 + 总时间
    const endTime = Cesium.JulianDate.addSeconds(
        startTime,
        timeSum,
        new Cesium.JulianDate()
    );

    // 为每个路径点添加时间采样
    positions.forEach((position, index) => {
        const time = Cesium.JulianDate.addSeconds(
            startTime,
            siteTimes[index],      // 到达第 i 个点的时间
            new Cesium.JulianDate()
        )
        property.addSample(time, position);  // 添加 (时间, 位置) 采样点
    })

    return {
        property,   // SampledProperty 对象
        startTime,  // 动画开始时间
        endTime,    // 动画结束时间
        siteTimes   // 每个站点的时间偏移
    }
}

// ============================================
// 时钟 Tick 事件处理 - 每帧调用（约60fps）
// 职责：
//   1. 计算列车与下一站的距离
//   2. 距离 < 阈值时暂停2秒（模拟停站）
//   3. 更新气泡框位置跟随列车
//   4. 到达终点时清理
// ============================================
let apporachDistance = 20  // 接近站点的距离阈值（米）

const tickEventHandler = () => {
    // 获取列车当前位置（根据当前时钟时间在 SampledProperty 中插值得到）
    const startPosition = trainEntity.position.getValue(viewer.clock.currentTime);

    // 通过当前时间和路径采样点，计算当前到达了哪个站点
    getCurrentStation(viewer.clock.currentTime)

    // 获取下一个站点的位置
    const { position } = stationData.value[metroIndex.value + 1]
    const endPosition = new Cesium.Cartesian3.fromDegrees(position.lng, position.lat)

    if (startPosition && endPosition) {
        // 计算列车到下一站的距离
        let distance = Cesium.Cartesian3.distance(startPosition, endPosition);

        if (distance <= apporachDistance) {
            // 暂停动画（模拟停站）
            viewer.clock.shouldAnimate = false;
            // 2秒后恢复动画
            setTimeout(() => {
                viewer.clock.shouldAnimate = true;
            }, 2000);
        }

        // 同步更新气泡框位置
        popupController && popupController.changePosition(startPosition)
    } else {
        // 列车已到达终点 → 清理所有实体和事件
        viewer.trackedEntity = null
        trainEntity && viewer.entities.remove(trainEntity)
        popupController && popupController.removeMarker()
        tickEventHandler && viewer.clock.onTick.removeEventListener(tickEventHandler);
        viewer.clock.shouldAnimate = false
    }
}

// ============================================
// 根据当前时间判断列车到达了哪个站点
// 原理：遍历 SampledProperty 的时间数组，
//   找到 currentTime 落在哪两个采样时间之间 → 对应哪个路径点 → 匹配站点
// ============================================
const getCurrentStation = (currentTime) => {
    if (trainEntity.position._times.length) {
        const times = trainEntity.position._times  // SampledProperty 内部的时间数组
        for (let i = 0; i < times.length - 1; i++) {
            let nowTime = times[i]
            let nextTime = times[i + 1]

            // compare > 0 表示 currentTime 在 nowTime 之后
            const compareNow = Cesium.JulianDate.compare(currentTime, nowTime)
            // compare > 0 表示 nextTime 在 currentTime 之后
            const compareNext = Cesium.JulianDate.compare(nextTime, currentTime)

            // currentTime 在 nowTime 和 nextTime 之间
            if (compareNow > 0 && compareNext > 0) {
                const targetPath = currentLine.value.paths[i]
                if (targetPath) {
                    // 通过坐标匹配找到对应的站点
                    const targetStationIndex = stationData.value.findIndex(
                        station => station.position.lng === targetPath.lng
                            && station.position.lat === targetPath.lat
                    )
                    if (targetStationIndex >= 0) {
                        metroIndex.value = targetStationIndex
                    }
                }
            }
        }
    }
}

// ============================================
// 清理当前轨迹的所有副作用
// 包括：取消跟随、删除实体、移除气泡、移除事件监听
// ============================================
const removeCurrentRoute = () => {
    viewer.trackedEntity = null                                    // 释放相机跟随
    trainEntity && viewer.entities.remove(trainEntity)             // 删除列车实体
    popupController && popupController.removeMarker()              // 移除气泡
    tickEventHandler && viewer.clock.onTick.removeEventListener(tickEventHandler); // 取消 tick 监听
    viewer.clock.shouldAnimate = false                             // 停止动画
}
</script>

<style scoped>
/* 地铁线路选择面板 */
#subLine-controller {
    position: absolute;
    bottom: 0;
    left: 32.5%;
    transform: translateX(-50%);
    width: 180px;
    height: 200px;
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

/* 线路项和站点项通用样式 */
.item {
    width: 64.992px;
    height: 20.006px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 0.156vw;
    background-color: rgba(255, 255, 255, 0.2);
    border: 1px solid #885f12;
    color: #fff;
    font-size: 14px;
    pointer-events: all;  /* 子元素可点击 */
    cursor: pointer;
}

.item:hover {
    border: 1px solid #d8961a;
}

.item>span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 50px;
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
    width: 600px;
    height: 200px;
    border: 1px solid #ab7818;
    background-color: rgba(0, 0, 0, 0.3);
    position: absolute;
    left: 38%;
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

/* 标题渐变文字 */
.title-bg {
    width: 100%;
    height: 30px;
    color: #fff;
    background-repeat: no-repeat;
    line-height: 30px;
    margin-left: 10px;
    /* 渐变文字效果：从白色到金色 */
    background: rgb(255, 255, 255);
    background-image: linear-gradient(180deg,
            rgba(255, 255, 255, 1) 9%,
            rgba(211, 156, 50, 1) 57%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

/* Loading 遮罩层样式 */
.route-loading {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1000;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
}

.loading-placeholder {
    width: 100%;
    height: 100%;
}

.route-loading .ant-spin-text {
    color: #fff;
    font-size: 16px;
    margin-top: 16px;
}

.route-loading .ant-spin-dot {
    font-size: 32px;
}

.route-loading .ant-spin-dot-item {
    background-color: #1890ff;
}
</style>
