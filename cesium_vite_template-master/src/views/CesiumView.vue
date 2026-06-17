<!--
 * @Description: 
 * @Author: your name
 * @version: 
 * @Date: 2024-05-08 16:34:13
 * @LastEditors: your name
 * @LastEditTime: 2024-09-10 09:25:51
-->
<template>
    <div id="cesium-viewer">
        <slot/>
    </div>
</template>

<script setup>
import * as Cesium from "cesium";
import { onMounted,markRaw } from "vue";
import app from '../main'
import {
    initViewer,
    setScene,
    loadTilesets,
    handleDefaultModelEffect,
    flyToDefaultView
} from "@/cesiumTools/sceneManager";
import { useLineData } from '@/store'
import {getWeather} from '@/api/line.js'

const lineDataStore = useLineData()

//初始化cesium实例
Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN;

onMounted(async () => {
    const viewer = initViewer("cesium-viewer");
    const data=await getWeather()
    console.log(data);

    setScene(viewer);
    flyToDefaultView(viewer)
    const modelUrls = [{
      url:"http://localhost:666/public/wuhan/tileset.json",
      options:{}
    }]
    lineDataStore.setViewer(markRaw(viewer))
    // 加载多个3dtiles
    await loadTilesets(viewer,modelUrls,(tilesets)=>{
      handleDefaultModelEffect(tilesets[0])
      lineDataStore.setTileset(markRaw(tilesets[0]))
    })
});
</script>
<style>
#cesium-viewer {
    pointer-events: all;
}
</style>