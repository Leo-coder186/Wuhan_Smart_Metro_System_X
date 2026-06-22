/**
 * @Description: 鼠标位置状态栏 - 在 Cesium 地图左上角显示当前鼠标指向的经纬度和高度
 *
 * 功能：
 *   1. 监听鼠标移动 → 实时显示鼠标下方地形的经纬度和海拔
 *   2. 监听相机移动 → 显示当前视角参数（方向、俯仰角、视点高度）
 *   3. 支持 show()/hide() 切换显示
 *
 * 使用场景：工具栏中的"鼠标位置"按钮
 * DOM 结构：
 *   <div class="position-info-status-bar">
 *     经度: xxx.xxxxxx
 *     纬度: xxx.xxxxxx
 *     高度: xxx.xxxxxx
 *   </div>
 *
 * @Date: 2024-05-10
 */
import * as Cesium from 'cesium'

export default class PositionInfoStatusBar {
    constructor(viewer) {
        this.viewer = viewer;
        this.createDom();     // 创建 UI 元素
        this.initEvent();     // 绑定鼠标和相机事件
    }

    /** 创建显示 DOM 元素并挂载到 Cesium 容器中 */
    createDom() {
        this.container = document.createElement("div");
        this.container.className = "position-info-status-bar";

        // 挂载到 Cesium 地图容器内
        let cesiumContaienr = document.getElementById("cesium-viewer")
        cesiumContaienr.appendChild(this.container);

        // 创建显示字段（经度、纬度、高度）
        this.divLng = document.createElement("div");       // 经度
        this.container.appendChild(this.divLng);
        this.divLat = document.createElement("div");       // 纬度
        this.container.appendChild(this.divLat);
        this.divH = document.createElement("div");         // 海拔高度
        this.container.appendChild(this.divH);

        // 以下字段创建了但未显示（预留扩展）
        this.divHeading = document.createElement("div");   // 相机方向
        this.divPitch = document.createElement("div");     // 俯仰角
        this.divcH = document.createElement("div");        // 视点高度
    }

    /** 注册鼠标移动和相机移动事件监听 */
    initEvent() {
        // 使用 Cesium 的 ScreenSpaceEventHandler 处理屏幕空间事件
        this.eventHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

        // 鼠标移动 → 更新鼠标指向位置的经纬度和海拔
        this.eventHandler.setInputAction(((e) => {
            // pickPosition: 射线检测鼠标下方地形/3D物体的真实坐标
            let pickPosition = this.viewer.scene.pickPosition(e.startPosition);
            if (!pickPosition) {
                // 如果没命中物体，退回到地球椭球面上的投影点
                pickPosition = this.viewer.scene.camera.pickEllipsoid(e.startPosition, this.viewer.scene.globe.ellipsoid);
            }
            if (!pickPosition) return;
            this.handleMouseMoveEvent(pickPosition);
        }), Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        // 相机移动结束 → 更新视角相关参数
        this.viewer.scene.camera.moveEnd.addEventListener(this.handleCameraMoveEvent, this);
    }

    /** 鼠标移动处理：更新经纬度和高度显示 */
    handleMouseMoveEvent(position) {
        let degrees = this.catesian3ToDegrees(position);
        this.divLng.innerHTML = "经度：" + degrees.x.toFixed(6);
        this.divLat.innerHTML = "纬度：" + degrees.y.toFixed(6);
        this.divH.innerHTML = "高度：" + degrees.z.toFixed(6);
    }

    /** 相机移动处理：更新方向、俯仰角、视点高度 */
    handleCameraMoveEvent() {
        this.divHeading.innerHTML = "方向：" + Cesium.Math.toDegrees(this.viewer.scene.camera.heading).toFixed(0) + "度";
        this.divPitch.innerHTML = "俯仰角：" + Cesium.Math.toDegrees(this.viewer.scene.camera.pitch).toFixed(0) + "度";

        let degrees = this.catesian3ToDegrees(this.viewer.scene.camera.position);
        this.divcH.innerHTML = "视高：" + degrees.z.toFixed(6) + "米";
    }

    /**
     * Cesium 笛卡尔坐标 → 经纬度 + 高度
     * @param {Cesium.Cartesian3} position
     * @returns {{ x: number, y: number, z: number }} x经度 y纬度 z高度
     */
    catesian3ToDegrees(position) {
        const c = Cesium.Cartographic.fromCartesian(position);
        const lon = Cesium.Math.toDegrees(c.longitude);
        const lat = Cesium.Math.toDegrees(c.latitude);
        const height = c.height;
        return { x: lon, y: lat, z: height }
    }

    /** 显示状态栏 */
    show() {
        this.container.style.display = "block";
    }

    /** 隐藏状态栏 */
    hide() {
        this.container.style.display = "none";
    }
}
