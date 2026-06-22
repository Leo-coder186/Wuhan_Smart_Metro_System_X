<!--
 * @Description: 
 * @Author: your name
 * @version: 
 * @Date: 2024-05-16 09:03:17
 * @LastEditors: your name
 * @LastEditTime: 2025-04-18 11:44:20
-->
<!-- 发展历程,该功能进入的时候需要将所有的地铁路线都清除，离开的时候再添加回来，使用该功能的时候无法使用图层管理控件 -->
<template>
    <div id="subLine-controller">
        <div class="item-wrapper">
            <div class="item" v-for="item in subLineData" @click.stop="handleItemClick(item)">
                <div class="box" :style="{ borderColor: item.color, backgroundColor: item.color }"></div>
                <span :style="{ color: '#34c5cf' }">{{ item.name.slice(-3) }}</span>
            </div>
        </div>
    </div>
    <div class="active-panel">
        <div class="header">
            <strong>发展历程</strong>
            <div class="controler">
                <i class="iconfont metro-pause" @click="pause"></i>
                <i class="iconfont metro-play" @click="play"></i>
                <i class="iconfont metro-icon-replay-copy" @click="replay"></i>
            </div>
        </div>
        <div class="content">
            <a-slider style="width: 500px" v-if="resPaths.length !== 0" v-model:value="currentTime" :marks="marks"
                :step="0.5" :min="0" :max="max" :disabled="true">
            </a-slider>
        </div>
        <div class="message" v-if="message.length">
            {{ message }}
        </div>
    </div>
</template>

<script setup>
import * as Cesium from 'cesium'
import { onMounted, ref, onBeforeUnmount, watch } from 'vue'
import { useLineData } from '@/store'
import { polygon, centroid } from 'turf'
import { flattenPositions } from '@/cesiumTools/core'
import _ from 'lodash'
import { renderAll, removeByCacheData } from '@/cesiumTools/effectController'
import { line_history } from '@/store/staticData'
const currentTime = ref(0);
const marks = ref({});
const max = ref(100);
const message = ref("");
const lineDataStore = useLineData()
const subLineData = ref([])
// 地铁线的路径数组
let curPaths = [];
let resPaths = [];
let isAnimate = false
let viewer
// 进入的时候隐藏所有地铁线路,并跳转到默认点
onMounted(() => {
    viewer = lineDataStore.Viewer
    subLineData.value = lineDataStore.allData
    // 将站点站线全部隐藏
    const lineNames = lineDataStore.allData.map(item => item.name)
    lineDataStore.displayLine(lineNames, false)
    // 暂时禁用全局管理，unMount的时候打开
    lineDataStore.disableController(true)
})

onBeforeUnmount(() => {
    pause()
    // 清除已经有的数据以及实体
    removeByCacheData(viewer, dataEnts)
    dataEnts = null
    // 全局管理恢复，路线展示恢复
    lineDataStore.disableController(false)
    // 将站点站线全部展示
    const lineNames = lineDataStore.allData.map(item => item.name)
    lineDataStore.displayLine(lineNames, true)
})

const removeCurrentEnts = () => {
    // 清除已经有的数据以及实体
    console.log(dataEnts);
    removeByCacheData(viewer, dataEnts)
    dataEnts = {}
}

// 点击对应线路，视角跳转，并重新渲染该线路，id要不一样，路线坐标使用callbackProperty
// dataEnts类型 {
//   lineEnts:[],
//   stationEnts:[],
//   billboards:[]
// }

let flyPoint
const flyToCentroid = (positions) => {
    if (positions.length) {
        if(flyPoint){
            viewer.entities.remove(flyPoint)
            flyPoint=null
        }
        const dataSource = []
        positions.forEach(item => {
            const { lng, lat } = item
            dataSource.push([lng, lat])
        })
        dataSource.push([positions[0].lng, positions[0].lat])
        // 注意：polygon首尾坐标要一致
        const polygonData = polygon([dataSource]);

        const centroidData = centroid(polygonData);
        console.log(centroidData);
        const {geometry:{coordinates}}=centroidData
        flyPoint=viewer.entities.add({
            name:'mount',
            position: Cesium.Cartesian3.fromDegrees(coordinates[0],coordinates[1],10000),
            point:{
                pixelSize:0.01
            }
        })
        viewer.flyTo(flyPoint, {
            offset: new Cesium.HeadingPitchRange(Cesium.Math.toRadians(70), Cesium.Math.toRadians(-60), 40000)
        })
    }
}

let dataEnts = {}
const handleItemClick = (item) => {
    const { id, paths } = item;
    const positions = flattenPositions(paths)
    // 计算多边形质心，用于视角跳转
    flyToCentroid(paths)
    pause()
    removeCurrentEnts()
    const target = line_history.find((n) => n.id === id);
    if (target) {
        pause()
        currentTime.value = 0;
        // 渲染站点站线,不走effectCotroller中的stations缓存,要获取返回值，dataEnts在组件中进行管理
        // 最后一个false，是isCache，是否要使用全局的缓存数据，这个组件，是单独进行实体数据管理的，不能够污染全局数据
        dataEnts = renderAll(viewer, [item], false)
        // 渲染时间slider
        const { history } = target;
        max.value = history.length * 10;
        let res = {};
        history.forEach((item, index) => {
            res[index * 10] = {
                style: {
                    color: "#fff",
                    fontSize: 10,
                },
                label: item.timePoint,
                message: item.message,
            };
        });
        // 给播放控件赋值，并给路径数据赋值
        marks.value = res;
        resPaths = positions;
        // 截取两个坐标作为动态坐标的初始值
        curPaths = positions.slice(0, 2);
        // 找到路线的实体，并给其坐标重新赋值
        const entity = dataEnts.lineEnts[0]
        // 给播放控件赋值，并给路径数据赋值
        entity.polyline.positions = new Cesium.CallbackProperty(() => Cesium.Cartesian3.fromDegreesArray(curPaths), false)
        // 自动开始播放
        play()
    }
}

const pause = () => {
    isAnimate = false
};

let myRequestID = null;
const play = () => {
    // 将raf给清除
    cancelAnimationFrame(myRequestID)
    const animate =() => {
        if (isAnimate) {
            currentTime.value += 0.1;
            // 百分比形式的播放进度
            const rate = currentTime.value / max.value;
            let index = Math.ceil(rate * resPaths.length);
            // 我们的坐标两个为一组，不为双数的话，就加一
            if (index % 2 !== 0) {
                index = index + 1;
            }
            // 如果是最后一个坐标，就返回
            if (index >= resPaths.length - 1) {
                // curPaths当前播放的坐标数组
                curPaths = resPaths;
                isAnimate = false
                return;
            }
            // [1,2,1,2,3,4] 主要数组arr
            // [].push(data)
            // data=arr[index]
            // index=rate
            curPaths = resPaths.slice(0, index);
            myRequestID=requestAnimationFrame(animate)
        }
    }

    isAnimate = true
    animate()
}

const replay = () => {
    pause();
    currentTime.value = 0;
    curPaths = resPaths.slice(0, 2);
    play();
}

// 监听当前进度
// 1.找到当前进度在marks当中的下标
// 2.通过下标,找message
watch(currentTime, (val) => {
    let targetIndex = null;
    const markKeys = Object.keys(marks.value).map((n) => Number(n));
    const markValues = Object.values(marks.value);
    markKeys.forEach((m, index) => {
        // 判断val是否在值区间
        if (index > 0 && val <= m && val > markKeys[index - 1]) {
            targetIndex = index;
        }

        if (val <= m && index === 0) {
            targetIndex = index;
        }
    });
    if (targetIndex) {
        const result = markValues[targetIndex];
        message.value = result.message;
    } else {
        message.value = "";
    }
});

</script>

<style scoped>
#subLine-controller {
    position: absolute;
    bottom: 0;
    left: 32%;
    transform: translateX(-50%);
    width: 7.625vw;
    height: 7.292vw;
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

.active-panel {
    width: 580px;
    height: 170px;
    border: 1px solid #ab7818;
    background-color: rgba(0, 0, 0, 0.3);
    position: absolute;
    left: 37%;
    bottom: 0;
    color: #fff;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.active-panel>.header {
    height: 1.563vw;
    padding: 0.208vw;

    margin-bottom: -0.521vw;
    font-family: "等线Bold";
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.active-panel>.header>strong {
    background: rgb(255, 255, 255);
    background-image: linear-gradient(180deg,
            rgba(255, 255, 255, 1) 9%,
            rgba(211, 156, 50, 1) 57%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

.controler {
    width: 100px;
    display: flex;
    align-items: center;
    justify-content: space-around;
}

.controler>i {
    cursor: pointer;
    pointer-events: all;
    font-size: 20px;
}

.controler>i:hover {
    background: rgb(255, 255, 255);
    background-image: linear-gradient(180deg,
            rgba(255, 255, 255, 1) 9%,
            rgba(211, 156, 50, 1) 57%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

.active-panel>.header>strong {
    font-weight: normal;
    margin-right: 0.521vw;
}

.active-panel>.header>span {
    font-size: 0.625vw;
}

.content {
    flex: 1;
    padding: 0 30px;
    margin-top: 30px;
}

.message {
    position: absolute;
    bottom: 26px;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(0, 0, 0, 0.3);
    color: #fff;
    text-align: center;
}
</style>
