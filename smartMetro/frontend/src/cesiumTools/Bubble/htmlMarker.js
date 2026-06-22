/**
 * @Description: HTML 文本标注类 - 在 Cesium 场景中渲染基于 DOM 的标注
 *
 * 功能：
 *   1. 在 Cesium 3D 坐标位置渲染 Vue 组件作为标注
 *   2. 每帧更新标注的屏幕位置（随相机移动）
 *   3. 支持距离缩放（近大远小效果）
 *   4. 支持显示/隐藏切换
 *   5. 支持弹出查询气泡（点击标注后显示详细信息）
 *
 * 与 Cesium 原生 Label 的区别：
 *   - 原生 Label：WebGL 渲染，性能好但不能有复杂交互
 *   - SimpleLabel：DOM 渲染，支持点击、悬停、表单等复杂交互
 *
 * 三种弹出类型（popupType）：
 *   - 'marker': 站点标记（MakerTemplate.vue）
 *   - 'carPopup': 列车信息弹窗（PopupCar.vue）
 *   - 'queryPopup': 站点查询弹窗（PopupQuery.vue）
 *
 * @Date: 2024-05-14
 */
import { render, createVNode } from "vue";
import { getStationInfo } from "@/api/line";
import * as Cesium from "cesium";

class SimpleLabel {
  /**
   * @param {Cesium.Viewer} viewer - Cesium Viewer 实例
   * @param {Object} options - 配置选项
   *   - position: Cesium.Cartesian3 标注的世界坐标位置
   *   - label: string 标签文字
   *   - isShow: boolean 是否显示
   *   - color: string 十六进制颜色
   *   - fields: string[] 查询弹窗的字段名列表
   *   - values: any[] 查询弹窗的字段值列表
   *   - scaleByDistance: Cesium.NearFarScalar 距离缩放配置
   *   - attr: Object 附加属性（传递给 Vue 模板）
   *   - type: string 弹出类型 ('marker'|'carPopup'|'queryPopup')
   *   - offset: [number, number] 屏幕偏移 [x, y]（像素）
   */
  constructor(viewer, options) {
    this.viewer = viewer;
    this.position = Cesium.defaultValue(options.position, Cesium.Cartesian3.ZERO);
    this.label = Cesium.defaultValue(options.label, "label");
    this.isShow = Cesium.defaultValue(options.isShow, true);
    this.color = Cesium.defaultValue(options.color, "#ff0000");
    this.fields = Cesium.defaultValue(options.fields, []);
    this.values = Cesium.defaultValue(options.values, []);
    // 距离缩放：1000米内 scale=1，20000米外 scale=0.4
    this.scaleByDistance = Cesium.defaultValue(
      options.scaleByDistance,
      new Cesium.NearFarScalar(1000, 1, 20000, 0.4)
    );
    this.attr = Cesium.defaultValue(options.attr, {});
    this.popupType = Cesium.defaultValue(options.type, "marker");
    this.offset = Cesium.defaultValue(options.offset, [0, 0]);

    // 不同类型的 Vue 模板懒加载映射
    this.popupRoutes = {
      marker: () => import("./MakerTemplate.vue"),   // 站点标记模板
      carPopup: () => import("./PopupCar.vue"),      // 列车信息弹窗
      queryPopup: () => import("./PopupQuery.vue"),  // 站点查询弹窗
    };

    this.queryPopup = null;  // 查询弹窗引用（子 SimpleLabel 实例）
    this.isDisplay = true;   // 当前显示状态
  }

  /** 外部修改标注的世界坐标位置 */
  changePosition(position) {
    this.position = position;
  }

  /** 移除查询弹窗 */
  removeQueryPopup() {
    this.queryPopup && this.queryPopup.removeMarker()
  }

  /**
   * 显示查询气泡框
   *
   * 流程：
   *   1. 调用 getStationInfo API 获取站点详细数据
   *   2. 创建一个新的 SimpleLabel（type='queryPopup'）
   *   3. 查询弹窗显示站点的名称、客流量状态、所属线路等信息
   */
  async showQueryPopup() {
    const params = {
      name: this.attr.name,
    };
    const { code, data } = await getStationInfo(params);
    if (code === 200) {
      const address = data.address;
      const peopleFlow = data.peopleFlow;
      const fields = ["名称", "客流量状态", "所属线路", "是否换乘"];
      const values = [
        this.attr.name,
        peopleFlow,
        address,
        this.attr.isChange ? "是" : "否",
      ];

      // 创建子查询弹窗（也是 SimpleLabel 实例）
      this.queryPopup = new SimpleLabel(this.viewer, {
        position: this.position,
        label: this.attr.name,
        isShow: true,
        color: this.color,
        scaleByDistance: this.scaleByDistance,
        attr: this.attr,
        fields: fields,
        values: values,
        type: "queryPopup",
        offset: [150, -20],  // 向右150px，向下20px
      });
      this.queryPopup.addLabel();
    }
  }

  /**
   * 添加标注到 Cesium 场景
   *
   * 实现步骤：
   *   1. 根据 popupType 动态 import 对应的 Vue 组件
   *   2. 使用 createVNode 创建 Vue 虚拟 DOM 节点
   *   3. 使用 render() 将 VNode 渲染到内存中的 DOM 元素
   *   4. 将 DOM 元素附加到 Cesium 容器中（覆盖在 canvas 上方）
   *   5. 注册 postRender 事件，每帧更新 DOM 位置
   *
   * @returns {HTMLElement} 渲染后的 DOM 元素
   */
  async addLabel() {
    // 类型不在映射表 → 返回 null
    if (!this.popupRoutes[this.popupType]) {
      return null;
    }

    // 动态导入 Vue 组件
    const res = await this.popupRoutes[this.popupType]();

    // 创建 Vue 虚拟节点实例
    this.vmInstance = createVNode(res.default, {
      label: this.label,
      color: this.color,
      position: this.position,
      attr: this.attr,
      // 点击回调：显示查询弹窗
      clickCallback: () => {
        this.showQueryPopup();
      },
      // 关闭回调：移除标注
      closePopup: () => {
        this.removeMarker();
      },
      fields: this.fields,
      values: this.values,
    });

    // 创建挂载 DOM 节点并渲染 Vue 组件
    this.mountNode = document.createElement("div");
    render(this.vmInstance, this.mountNode);

    // 将 DOM 节点添加到 Cesium 容器中
    this.viewer.cesiumWidget.container.appendChild(this.mountNode);

    // 注册每帧位置更新
    this.addPostRender();

    // 设置初始显示状态
    this.vmInstance.el.style.display = this.isShow ? "block" : "none";
    return this.vmInstance.el;
  }

  /**
   * 对数刻度计算 - 用于距离缩放
   *
   * 原理：将距离在当前 NearFar 范围内做对数映射
   *   距离越近 → scale 越大
   *   距离越远 → scale 越小
   *
   * @param {number} curValue - 当前距离/高度值
   * @param {Cesium.NearFarScalar} stdNearFar - 近远配置
   * @returns {number} 计算后的缩放比例
   */
  calcaluteGrade(curValue, stdNearFar) {
    let curPara = -1;
    if (curValue <= stdNearFar.near) {
      curPara = stdNearFar.nearValue;        // 近距离：最大缩放
    } else if (curValue >= stdNearFar.far) {
      curPara = stdNearFar.farValue;         // 远距离：最小缩放
    } else {
      // 中间距离：对数插值
      const totalGrade = Math.ceil(
        Math.log(stdNearFar.far / stdNearFar.near) / Math.log(2)
      );
      const curGrade = Math.round(
        Math.log(curValue / stdNearFar.near) / Math.log(2)
      );
      curPara =
        stdNearFar.nearValue +
        ((stdNearFar.farValue - stdNearFar.nearValue) * curGrade) / totalGrade;
    }
    return curPara;
  }

  /** 注册 postRender 事件监听 */
  addPostRender() {
    this.viewer.scene.postRender.addEventListener(this.postRender, this);
  }

  /**
   * postRender 回调 - 每帧渲染后执行
   *
   * 处理三件事：
   *   1. 将世界坐标转为屏幕坐标，更新 DOM 位置
   *   2. 根据相机高度调整 DOM 的 scale（近大远小）
   *   3. 超出屏幕范围或距离太远时隐藏 DOM（性能优化）
   */
  postRender() {
    if (!this.vmInstance.el || !this.vmInstance.el.style) return;

    const canvasHeight = this.viewer.scene.canvas.height;
    const windowPosition = new Cesium.Cartesian2();

    // 世界坐标 → 屏幕坐标（WGS84 → 屏幕像素）
    Cesium.SceneTransforms.wgs84ToWindowCoordinates(
      this.viewer.scene,
      this.position,
      windowPosition
    );

    // 更新 DOM 位置：bottom = canvas高度 - 屏幕Y
    this.vmInstance.el.style.bottom =
      canvasHeight - windowPosition.y + this.offset[1] + "px";

    // 水平居中：left = 屏幕X - 元素宽度/2
    const elWidth = this.vmInstance.el.offsetWidth;
    this.vmInstance.el.style.left =
      windowPosition.x - elWidth / 2 + this.offset[0] + "px";

    // 距离缩放：根据相机高度调整 DOM 的 transform:scale
    const cameraHeight = Math.ceil(
      this.viewer.camera.positionCartographic.height
    );
    const scaleSize = this.calcaluteGrade(cameraHeight, this.scaleByDistance);
    this.vmInstance.el.style.transform = `scale(${scaleSize},${scaleSize})`;

    // 性能优化：在屏幕外或太远时隐藏
    if (this.isDisplay) {
      const condition1 = windowPosition.y < 0 || windowPosition.y > canvasHeight;  // 屏幕外（上下）
      const condition2 = this.viewer.camera.positionCartographic.height > 12000;   // 高度 > 12000m
      const condition3 = windowPosition.x < 0 || windowPosition.x > this.viewer.scene.canvas.width;  // 屏幕外（左右）

      if (condition1 || condition2 || condition3) {
        this.vmInstance.el.style.display = "none";
      } else {
        this.vmInstance.el.style.display = "block";
      }
    }
  }

  /**
   * 移除标注
   *   1. 从 DOM 中移除
   *   2. 取消 postRender 事件监听
   */
  removeMarker() {
    this.mountNode &&
      this.viewer.cesiumWidget.container.removeChild(this.mountNode);
    this.viewer.scene.postRender.removeEventListener(this.postRender, this);
    this.mountNode = null;
  }
}

export default SimpleLabel;
