<!--
 * @Description: 线路图层控制器 - 控制各条地铁线路在地图上的显示/隐藏
 *
 * 功能：
 *   1. 全选/取消全选：一键控制所有线路的显隐
 *   2. 单条线路控制：点击颜色块切换单条线路的显隐
 *   3. 数据通过 lineDataStore.displayLine() 方法同步到 Store，
 *      effectController 响应 Store 变化来更新地图上的视觉效果
 *
 * 使用场景：ToolBar 中的图层控制 Popover 弹出此组件
 * @Date: 2024-05-08
-->
<template>
    <div id="subLine-controller">
        <!-- 全选/取消全选 -->
        <div>
            <div class="item">
                <input type="checkbox" :checked="showAll" @change="controlAll"/>
                <span>全选</span>
            </div>
        </div>

        <!-- 各线路独立控制 -->
        <div class="item-wrapper">
            <div class="item" v-for="item in subLineData">
                <!--
                  颜色块：点击切换显隐
                  checked = true → 填充线路颜色
                  checked = false → 透明（仅显示边框）
                -->
                <div class="box" @click.stop="chooseLine(item)" :style="{
                    borderColor: item.color,
                    backgroundColor: item.checked ? item.color : 'transparent',
                }"></div>
                <!-- 线路名（取后3字，如 "1号线"） -->
                <span :style="{ color: '#34c5cf' }">{{ item.name.slice(-3) }}</span>
            </div>
        </div>
    </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useLineData } from '@/store'

const subLineData = ref([])           // 线路数据列表
const showAll = ref(true)             // 全选状态
const lineDataStore = useLineData()

/**
 * 全选 / 取消全选
 * 一次性控制所有线路的显示和隐藏
 */
const controlAll = (e) => {
    const checked = e.target.checked
    const lineNames = subLineData.value.map(item => item.name)
    // 调用 Store 方法：统一设置所有线路的显示状态
    lineDataStore.displayLine(lineNames, checked)
}

/**
 * 单独控制某条线路的显示/隐藏
 * 点击颜色块切换 checked 状态
 */
const chooseLine = (item) => {
    const names = [item.name]
    // 取反当前状态
    lineDataStore.displayLine(names, !item.checked)
}

onMounted(async () => {
    // 从 Store 获取线路数据
    subLineData.value = lineDataStore.allData
})
</script>

<style scoped>
.mask {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    background-color: rgba(204, 204, 204, 0.165);
    z-index: 999;
}

#subLine-controller {
    position: relative;
    width: 3.885vw;
    background-color: rgba(0, 0, 0, 0.3);
    border: 1px solid #664a16;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10px;
    padding-bottom: 0;
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
    margin-bottom: 10px;
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
</style>
