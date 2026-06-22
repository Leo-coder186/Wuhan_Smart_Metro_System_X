<!--
 * @Description: HLS 视频直播播放器组件 - 用于展示地铁站实时监控影像
 *
 * 技术栈：
 *   - @videojs-player/vue: Vue 3 封装版 Video.js
 *   - video.js: HTML5 视频播放器框架
 *
 * 支持播放类型：
 *   - HLS (m3u8)：默认视频源为流媒体切片
 *   - FLV：通过 flvjs-tech 插件可支持 FLV 直播流
 *
 * Props:
 *   - src: 视频流地址（默认 HLS m3u8 地址）
 *   - videoType: 视频类型（'hls' 等，默认 'hls'）
 *
 * @Date: 2024-05-08
-->
<template>
    <!--
      video-player: Vue 封装的 Video.js 播放器
      poster: 封面图（视频加载前显示）
      crossorigin: 跨域属性（anonymous 表示不带 cookie）
      controls: 显示播放控件栏
      loop: 循环播放
      volume: 默认音量 0.6
      techOrder: 技术顺序 ['html5', 'flvjs'] → 优先用 HTML5，必要时降级 FLV
      autoplay: 自动播放
      @mounted: 播放器就绪后的回调
    -->
    <video-player :poster="poster" crossorigin="anonymous" :controls="true" :loop="true" :volume="0.6"
        :techOrder="['html5', 'flvjs']" autoplay="true" width="500px" height="300px" @mounted="handleMounted" />
</template>

<script setup>
import { VideoPlayer } from '@videojs-player/vue'
import 'video.js/dist/video-js.css'   // Video.js 默认样式
import { ref } from 'vue'

const props = defineProps({
    src: {
        type: String,
        // 默认 HLS 测试流地址
        default: 'http://v2h.jdshipin.com/asia_action/asia_action.stream/chunklist.m3u8'
    },
    videoType: {
        type: String,
        default: 'hls'
    }
})

// 视频封面图（加载前显示）
const poster = ref('/src/assets/subway.jpeg')

/**
 * 播放器挂载完成回调
 * 根据视频类型设置数据源
 */
const handleMounted = ({ player }) => {
    if (props.videoType === 'hls') {
        player.src(props.src)    // 设置 HLS 流地址
    }
}
</script>
