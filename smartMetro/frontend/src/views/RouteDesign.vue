<!--
 * @Description: 路径规划组件 - 地铁换乘路径规划与可视化
 *
 * 操作流程：
 *   1. 在面板上选择起点站（线路 + 站点两级联选）和终点站
 *   2. 点击 "进入规划模式" → 请求后端路径规划 API
 *   3. 规划模式下：隐藏所有原有图层，显示路径规划结果
 *   4. 地图上渲染：起点/终点/换乘站/途径站 的标记牌（billboard），
 *      以及各段地铁线路路径（polyline）
 *   5. 右侧展示 PathDesignDisplayCard 路径详情面板（距离、换乘信息）
 *   6. 点击 "离开规划模式" → 恢复所有原始图层，清除规划实体
 *
 * 技术要点：
 *   - 使用 Ant Design 的 <a-cascader> 实现线路→站点的两级选择
 *   - 路径实体通过 cacheData 对象手动管理，不使用 effectController 的全局缓存
 *     （因为路径规划是临时性的，不应污染全局缓存）
 *   - watch 监听起终点变化，自动重新规划
 *   - renderStation + renderStationBill 渲染站点标记（图标 + 文字标签）
 *
 * 数据流：
 *   选择站点 → getLinePlan() API → 解析 segments → 渲染站点+路径
 * @Date: 2024-05-08
-->
<template>
    <!-- 路径规划面板 -->
    <div class="route-design-wrapper">
        <div class="route-design">
            <!-- 面板标题栏 -->
            <div class="header">
                <i class="iconfont metro-lujingguihua"></i>
                <span>路径规划</span>
                <!-- 进入/离开规划模式的切换按钮 -->
                <button class="start-btn" @click="enterDesign">
                    {{ isDesign ? "离开规划模式" : "进入规划模式" }}
                </button>
            </div>

            <!-- 站点选择区域 -->
            <div class="content">
                <!-- 起点站选择：两级联选器 → 线路 → 站点 -->
                <div>
                    <span style="margin-right: 5px">起点:</span>
                    <a-cascader v-model:value="startStation" :options="options" placeholder="请输入起点站">
                        <template #clearIcon>
                            <i class="iconfont metro-close"></i>
                        </template>
                    </a-cascader>
                </div>
                <!-- 终点站选择 -->
                <div>
                    <span style="margin-right: 5px">终点:</span>
                    <a-cascader v-model:value="endStation" :options="options" placeholder="请输入起点站">
                        <template #clearIcon>
                            <i class="iconfont metro-close"></i>
                        </template>
                    </a-cascader>
                </div>
            </div>
        </div>
    </div>

    <!-- 路径规划结果展示卡片（仅在规划模式下显示） -->
    <PathDesignDisplayCard :routeInfo="routeInfo" v-if="isDesign" :cacheData="cacheData"/>
</template>

<script setup>
import PathDesignDisplayCard from '@/components/PathDesignDisplayCard.vue';
import { ref, onMounted, watch, onBeforeUnmount } from 'vue';
import { lineColors } from "@/store/staticData";
import { useLineData } from '@/store'
import {
    renderStation,       // 渲染站点标记（圆形+图标）
    renderLines,         // 渲染路径线条（Polyline）
    renderStationBill,   // 渲染站点信息牌（HTML billboard）
    removeByCacheData,   // 按缓存数据清除实体
    flyToDefaultView     // 飞往武汉全景视角
} from '@/cesiumTools/effectController'
import { getLinePlan } from "@/api/line";  // 路径规划 API
import { message } from "ant-design-vue";

const lineData = useLineData()
let viewer

// 线路数据（用于映射站点坐标）
const subLineData = ref([])

// 级联选择器的值：["线路名", "站点名"]
const startStation = ref([]);
const endStation = ref([]);

// 是否处于路径规划模式
const isDesign = ref(false);

// 路径规划结果（API 返回数据）
const routeInfo = ref({})

// ============================================
// 路径规划的临时实体缓存
// 使用独立的 cacheData 对象，不使用 effectController 的全局缓存
// 原因：路径规划是临时功能，使用全局缓存会污染其他功能的实体管理
// ============================================
const cacheData = {
    lineEnts: [],     // 路径线段实体数组
    stationEnts: [],  // 站点标记实体数组
    billboards: []    // 站点信息牌数组
};

// 从 API 获取的原始路径规划数据
let pathInfo = {};

// 级联选择器的下拉选项数据
let options = ref([])

onMounted(() => {
    viewer = lineData.Viewer
    subLineData.value = lineData.allData

    // 构建级联选择器的选项树
    // 格式：[{ label: "1号线", value: "1号线", children: [{ label: "站点名", value: "站点名" }] }]
    if (subLineData.value.length > 0) {
        options.value = subLineData.value.map((item) => {
            const { name, stationsList } = item;
            const children = stationsList.map((s) => ({
                value: s.name,
                label: s.name,
            }));
            return {
                label: name,     // 第一级：线路名
                value: name,
                children,        // 第二级：该线路下的所有站点
            };
        });
    }
})

// 离开页面时清理所有规划实体
onBeforeUnmount(() => {
    leaveRouteDesign()
})

// ============================================
// 监听起终点变化 → 自动重新规划路径
// ============================================
watch([startStation, endStation], async (value) => {
    if (isDesign.value) {
        // 重新获取路径数据
        const data = await getLineData()
        pathInfo = data
        // 更新地图渲染
        mapChange()
    }
});

// ============================================
// 调用后端 API 获取路径规划数据
// ============================================
const getLineData = async () => {
    const start = startStation.value;
    const end = endStation.value;

    // 起点和终点都填写后才发起请求
    if (start.length && end.length) {
        let params = {};
        // 从 lineData 中查找站点坐标
        params.origin = getPositon(start[0], start[1]);       // "lng,lat"
        params.destination = getPositon(end[0], end[1]);      // "lng,lat"
        const { code, data } = await getLinePlan(params);

        if (code === 200) {
            return data
        } else {
            message.warn("查询不到相关数据");
            return null
        }
    }
}

// ============================================
// 地图渲染更新：根据 pathInfo 渲染站点和路径
//
// 数据格式说明（API 返回的 pathInfo）：
// {
//   distance: 总距离,
//   segments: [{ bus: { buslines: [...] } }]
// }
// 每个 busline 包含：
//   - type: "地铁线路" / "步行"
//   - name: 线路名
//   - arrival_stop / departure_stop: 起点/终点站
//   - via_stops: 途径站数组
//   - polyline: 路径坐标数组
// ============================================
const mapChange = () => {
    // 1. 清除旧的规划实体
    removeActiveEnts()

    // 2. 解析 API 数据，提取站点和路径
    const stations = [];  // 站点数据（用于标记渲染）
    const paths = [];     // 路径数据（用于线条渲染）
    const route = {
        stations: []      // 路径信息（用于展示面板）
    }

    const { distance, segments } = pathInfo;
    route.distance = distance  // 总距离

    // 遍历每一段（segments 表示换乘段）
    segments.forEach((s, sIndex) => {
        const {
            bus: { buslines },
        } = s;

        if (buslines?.length) {
            // 取第一条公交线路数据（通常只有一条）
            const target = buslines[0]
            const color = lineColors[sIndex]  // 每段用不同颜色
            target.color = color
            route.stations.push(target)

            // 处理每条子线路
            buslines.forEach((b, index) => {
                const line = { part: index + 1, partStation: [] };
                const { type, arrival_stop, departure_stop, name, polyline, via_stops } = b;

                // 存储路径坐标
                paths.push({
                    name,
                    part: index + 1,
                    polyline,
                });

                if (type === "地铁线路") {
                    let arrival = arrival_stop;      // 到达站
                    let departure = departure_stop;  // 出发站

                    // 标注站点类型（起点站 / 终点站 / 换乘站）
                    arrival.type = sIndex === segments.length - 1 ? "终点站" : "换乘站";
                    departure.type = sIndex === 0 ? "起点站" : "换乘站";

                    // partStation 存储该段线路的站点序列
                    line.partStation.push(arrival);

                    // 中间途径站
                    via_stops.forEach((v) => {
                        v.type = "途径站";
                        line.partStation.push(v);
                    });

                    line.partStation.push(departure);
                    line.name = name;
                }
                stations.push(line);
            });
        }
    })

    // 更新展示面板数据
    routeInfo.value = route

    // 3. 在地图上渲染站点标记
    stations.forEach((station, index) => {
        let color = lineColors[index];
        const { partStation } = station;

        partStation.forEach(async p => {
            let { location, name, type } = p
            // 换乘站名称后加标记
            name = type === '换乘站' ? name + '(换乘)' : name
            const position = location

            // 渲染站点圆形标记（不是用缓存，因为 name 可能不同）
            const stationEnt = renderStation(viewer, {
                position,
                name,
                color: type === '换乘站' ? '#e9a526' : color  // 换乘站用金色
            })

            // 渲染站点信息牌（HTML 标签）
            const billboard = await renderStationBill(viewer, {
                position,
                name,
                color: type === '换乘站' ? '#e9a526' : color,
                attr: { name }
            })

            // 存入组件级缓存（离开时统一清除）
            cacheData.stationEnts.push(stationEnt)
            cacheData.billboards.push(billboard)
        })
    });

    // 4. 在地图上渲染路径线条
    paths.forEach((path, index) => {
        const color = lineColors[index];
        const { polyline, name } = path;

        const lineEnt = renderLines(viewer, {
            positions: polyline,  // 路径坐标数组 [{lng, lat}, ...]
            name,
            color
        });
        cacheData.lineEnts.push(lineEnt);
    });

    // 5. 视角飞到全景
    flyToDefaultView(viewer)
}

// ============================================
// 根据线路名和站点名查找站点坐标
// 返回格式："lng,lat"（用于 API 请求参数）
// ============================================
const getPositon = (lineName, stationName) => {
    const targetLine = subLineData.value.find((l) => l.name === lineName);
    const { position } = targetLine.stationsList.find(
        (s) => s.name === stationName
    );
    return `${position.lng},${position.lat}`;
};

// ============================================
// 离开规划模式：清理实体 + 恢复原有图层
// ============================================
const leaveRouteDesign = () => {
    // 移除所有规划相关的实体
    removeActiveEnts()
    // 恢复所有线路图层显示
    lineData.controlAll(true)
    // 重置状态
    isDesign.value = false
    startStation.value = []
    endStation.value = []
    pathInfo = {}
}

// ============================================
// 进入规划模式
// ============================================
const enterDesign = async () => {
    // 如果还没有规划数据
    if (!Object.keys(pathInfo).length) {
        // 检查是否已选择起终点
        if (startStation.value.length && endStation.value.length) {
            // 调用 API 获取路径数据
            const data = await getLineData()
            pathInfo = data
        } else {
            message.warn('请先选择起点和终点站点')
            return
        }
    }

    // 如果已经在规划模式 → 退出
    if (isDesign.value) {
        leaveRouteDesign()
        return
    }

    // === 进入规划模式 ===
    // 1. 隐藏当前地图上所有图层（交由图层控制组件完成）
    lineData.controlAll(false)
    // 2. 渲染规划结果
    mapChange()
    // 3. 设置状态
    isDesign.value = true
};

// ============================================
// 移除所有路径规划实体
// 使用 effectController 提供的 removeByCacheData 方法
// ============================================
const removeActiveEnts = () => {
    removeByCacheData(viewer, cacheData)
    // 清空缓存数组
    cacheData.billboards = []
    cacheData.lineEnts = []
    cacheData.stationEnts = []
};
</script>

<style scoped>
/* 路径规划面板容器 */
.route-design-wrapper {
    position: absolute;
    right: 14%;
    top: 5%;
}

/* 路径规划面板 */
.route-design {
    width: 320px;
    height: 170px;
    background-color: rgba(0, 0, 0, 0.6);
    border: 1px solid #885f12;
}

/* 面板标题 - 金色渐变文字 */
.route-design>.header {
    width: 100%;
    height: 40px;
    color: #fff;
    padding-left: 10px;
    background: rgb(255, 255, 255);
    background-image: linear-gradient(180deg,
            rgba(255, 255, 255, 1) 9%,
            rgba(211, 156, 50, 1) 57%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    display: flex;
    align-items: center;
}

.route-design span {
    margin-left: 5px;
}

/* 站点选择区域 */
.content {
    width: 100%;
    height: 110px;
    pointer-events: all;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-around;
    color: #fff;
}

/* 进入/离开规划模式按钮 */
.start-btn {
    width: 80px;
    color: #fff;
    margin-left: 140px;
    background-color: transparent;
    border: 1px solid #885f12;
    font-size: 12px;
    padding: 3px;
    pointer-events: all;
    cursor: pointer;
}

.start-btn:hover {
    background-color: #5c3f096d;
    border: 1px solid #881212;
}
</style>
