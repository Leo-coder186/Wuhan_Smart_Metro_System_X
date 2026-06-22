<!--
 * @Description: 顶部导航栏组件 - 显示时间、天气和系统标题
 *
 * 三栏布局：
 *   左侧：城市名 + 当前日期 + 星期 + 实时时钟
 *   中间：系统标题 "地铁三维可视化管控平台"
 *   右侧：天气图标 + 天气描述 + 温度
 *
 * 数据来源：
 *   - 时间：dayjs 库，每秒更新
 *   - 天气：getWeather() API 获取实时天气数据
 * @Date: 2024-05-08
-->
<template>
    <div id="header">
        <!-- 左侧：定位信息 + 日期时间 -->
        <div class="leftTool">
            <!-- 定位图标 -->
            <i class='iconfont metro-dingwei' style="color:#eb9a02;"></i>
            <span style="marginRight:20px;marginLeft:10px;">武汉市</span>
            <!-- 日期（YYYY/MM/DD 格式） -->
            <span style="marginRight:15px;marginLeft:15px;letter-spacing:2px;">{{currentDate}}</span>
            <!-- 星期（中文） -->
            <span style="marginRight:15px;marginLeft:15px;">{{currentWeek}}</span>
            <!-- 实时时钟（hh:mm:ss 格式） -->
            <span style="marginRight:15px;marginLeft:15px;">{{currentSecond}}</span>
        </div>

        <!-- 中间：系统标题（金色渐变文字） -->
        <div class="title">地铁三维可视化管控平台</div>

        <!-- 右侧：天气信息 -->
        <div class="rightTool">
           <!-- 天气图标（根据天气类型动态切换） -->
           <i :class="['iconfont',weatherIcon,'icon']"></i>
           <!-- 天气描述（晴/雨/雪/阴） -->
           <span style="margin:0 10px">{{ weather }}</span>
           <!-- 当前温度 -->
           <span>{{temp}}℃</span>
        </div>
    </div>
</template>

<script setup>
import dayjs from 'dayjs'
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { getWeather } from '@/api/line.js'

// 定时器引用（用于清理）
const timer = ref(null)

// 英文星期 → 中文星期的映射表
const weekMap = {
    'Monday': '星期一',
    'Tuesday': '星期二',
    'Wednesday': '星期三',
    'Thursday': '星期四',
    'Friday': '星期五',
    'Saturday': '星期六',
    'Sunday': '星期日',
}

// 响应式时间数据（初始化为当前时间）
let currentDate = ref(dayjs().format('YYYY/MM/DD'))    // 2024/05/08
let currentWeek = ref(weekMap[dayjs().format('dddd')]) // 星期三
let currentSecond = ref(dayjs().format('hh:mm:ss'))    // 14:30:00

// 天气相关数据
const weather = ref('晴')           // 天气描述
const temp = ref(0)                 // 温度

// 天气类型 ↔ 图标的映射（计算属性）
const weatherIcon = computed(() => {
    return weatherMap[weather.value]
})

// 天气类型对应的 iconfont 图标 class
const weatherMap = {
    '晴': 'metro-qingtian',  // 晴天图标
    '雨': 'metro-yutian',    // 雨天图标
    '雪': 'metro-xuetian',   // 雪天图标
    '阴': 'metro-duoyun',    // 阴天/多云图标
}

onMounted(async () => {
    // 启动定时器：每100ms更新一次时间显示
    // 使用100ms而不是1000ms是为了在整秒时及时更新
    timer.value = setInterval(() => {
        currentDate.value = dayjs().format('YYYY/MM/DD')
        currentWeek.value = weekMap[dayjs().format('dddd')]
        currentSecond.value = dayjs().format('hh:mm:ss')
    }, 100);

    // 获取实时天气数据（使用高德/和风天气 API）
    const weatherRes = await getWeather()
    console.log(weatherRes)
    // 解析天气响应：取 lives[0] 的第一个结果
    weather.value = weatherRes.lives[0]?.weather || '晴'
    temp.value = weatherRes.lives[0]?.temperature || 0
})

// 组件卸载时清除定时器，防止内存泄漏
onUnmounted(() => {
    timer.value && clearInterval(timer.value)
})
</script>

<style scoped lang="scss">
/* 顶部导航栏 - 使用 header.png 作为背景 */
#header {
    width: 100%;
    height: 57px;
    position: absolute;
    top: 0;
    left: 0;
    background: url('../assets/uiResources/header.png');
    background-size: cover;
    display: flex;
    justify-content: center;
}

#timeline {
    width: 200px;
    height: 30px;
    pointer-events: all;
}

/* 系统标题 - 金色渐变文字效果 */
.title {
    font-family: '等线Bold';
    font-size: 26px;
    font-weight: bold;
    letter-spacing: 2px;
    /* 白色到金色的渐变 */
    background: rgb(255,255,255);
    background-image: linear-gradient(180deg,
        rgba(255,255,255,1) 9%,
        rgba(211,156,50,1) 57%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-top: 3px;
}

/* 左侧信息区域 */
.leftTool {
    width: 26%;
    height: 70%;
    position: absolute;
    left: 0;
    top: 0;
    display: flex;
    align-items: center;
    color: #fff;
    padding-left: 20px;
    font-size: 15px;
}

/* 右侧天气区域 */
.rightTool {
    width: 26%;
    height: 70%;
    position: absolute;
    right: 0;
    top: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    font-size: 12px;
    color: #fff;
    margin-right: 20px;
}

/* 天气图标 - 金色渐变 */
.icon {
    font-family: '等线Bold';
    font-size: 16px;
    font-weight: bold;
    background: rgb(255,255,255);
    background-image: linear-gradient(180deg,
        rgba(255,255,255,1) 9%,
        rgba(211,156,50,1) 57%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-right: 10px;
}
</style>
