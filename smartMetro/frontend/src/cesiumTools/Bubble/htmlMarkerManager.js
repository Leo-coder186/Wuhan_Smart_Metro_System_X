/**
 * @Description: HTML 标记管理器 - 统一管理多个 htmlMarker 的更新和生命周期
 *
 * 设计动机（性能优化）：
 *   SimpleLabel 每个实例都会注册一个 postRender 事件来更新位置。
 *   当地铁站点很多时（如100+个站点），每个站点一个 postRender 监听器 → 性能问题。
 *
 * 解决方案：
 *   使用管理器模式，用**一个**统一的 postRender 监听器更新所有标记的位置。
 *   大幅减少 Cesium 场景渲染循环中的 JavaScript 开销。
 *
 * 功能：
 *   1. 添加/移除标记
 *   2. 统一 postRender 更新所有标记位置
 *   3. 根据名称查找/显示/隐藏标记
 *   4. 自动管理监听器生命周期（有标记时注册，无标记时移除）
 *
 * @Date: 2025-01-30
 */
import * as Cesium from "cesium";

class HtmlMarkerManager {
  /**
   * @param {Cesium.Viewer} viewer - Cesium Viewer 实例
   */
  constructor(viewer) {
    this.viewer = viewer;
    this.markers = [];           // 所有 SimpleLabel 实例
    this.isListening = false;    // 是否已注册统一监听器
    this.postRenderBound = this.postRender.bind(this);  // 绑定 this 的 postRender
  }

  /**
   * 添加单个标记到管理器
   * 如果还没有统一监听器，自动注册
   *
   * @param {SimpleLabel} marker - SimpleLabel 实例
   */
  addMarker(marker) {
    if (!marker) return;

    // 避免重复添加
    if (this.markers.indexOf(marker) === -1) {
      this.markers.push(marker);

      // 首次添加时注册统一监听器
      if (!this.isListening) {
        this.viewer.scene.postRender.addEventListener(this.postRenderBound);
        this.isListening = true;
      }
    }
  }

  /**
   * 批量添加多个标记
   * @param {Array<SimpleLabel>} markers
   */
  addMarkers(markers) {
    if (!Array.isArray(markers)) return;
    markers.forEach(marker => this.addMarker(marker));
  }

  /**
   * 从管理器中移除单个标记
   * 如果管理器空了，自动移除统一监听器
   *
   * @param {SimpleLabel} marker
   */
  removeMarker(marker) {
    const index = this.markers.indexOf(marker);
    if (index > -1) {
      this.markers.splice(index, 1);

      // 没有标记了 → 移除监听器，节省资源
      if (this.markers.length === 0 && this.isListening) {
        this.viewer.scene.postRender.removeEventListener(this.postRenderBound);
        this.isListening = false;
      }
    }
  }

  /**
   * 批量移除多个标记
   * @param {Array<SimpleLabel>} markers
   */
  removeMarkers(markers) {
    if (!Array.isArray(markers)) return;
    markers.forEach(marker => this.removeMarker(marker));
  }

  /**
   * 统一的 postRender 方法 - 核心优化点
   *
   * 每帧渲染后遍历所有标记，更新位置/缩放/显示状态。
   * 功能与 SimpleLabel.postRender 完全一致，但只占用一个监听器。
   */
  postRender() {
    const canvasHeight = this.viewer.scene.canvas.height;
    const canvasWidth = this.viewer.scene.canvas.width;

    for (let i = 0; i < this.markers.length; i++) {
      const marker = this.markers[i];

      // 标记 DOM 不存在则跳过
      if (!marker.vmInstance || !marker.vmInstance.el || !marker.vmInstance.el.style) {
        continue;
      }

      const windowPosition = new Cesium.Cartesian2();

      // 世界坐标 → 屏幕坐标
      const success = Cesium.SceneTransforms.wgs84ToWindowCoordinates(
        this.viewer.scene,
        marker.position,
        windowPosition
      );

      if (!success) continue;

      // 更新 DOM 位置
      marker.vmInstance.el.style.bottom =
        canvasHeight - windowPosition.y + (marker.offset?.[1] || 0) + "px";
      const elWidth = marker.vmInstance.el.offsetWidth;
      marker.vmInstance.el.style.left =
        windowPosition.x - elWidth / 2 + (marker.offset?.[0] || 0) + "px";

      // 距离缩放因子计算
      let filterFactor;
      if (marker.filterStructage === "distance") {
        // 使用相机到标记的直线距离
        filterFactor = Cesium.Cartesian3.distance(
          this.viewer.camera.position,
          marker.position
        );
      } else {
        // 默认使用相机高度
        filterFactor = Math.ceil(this.viewer.camera.positionCartographic.height);
      }

      // 应用缩放
      const scaleSize = marker.calcaluteGrade(filterFactor, marker.scaleByDistance);
      marker.vmInstance.el.style.transform = `scale(${scaleSize},${scaleSize})`;

      // 可视范围裁剪（性能优化）
      if (marker.isDisplay) {
        const condition1 = windowPosition.y < 0 || windowPosition.y > canvasHeight;
        const condition2 = filterFactor > 12000;
        const condition3 = windowPosition.x < 0 || windowPosition.x > canvasWidth;

        if (condition1 || condition2 || condition3) {
          marker.vmInstance.el.style.display = "none";
        } else {
          marker.vmInstance.el.style.display = "block";
        }
      }
    }
  }

  /**
   * 清除所有标记
   * 包括：移除所有 DOM、取消所有事件、清空数组、移除统一监听器
   */
  removeAll() {
    this.markers.forEach(marker => {
      if (marker.removeMarker) {
        marker.removeMarker();
      }
    });
    this.markers = [];

    if (this.isListening) {
      this.viewer.scene.postRender.removeEventListener(this.postRenderBound);
      this.isListening = false;
    }
  }

  /**
   * 根据名称数组控制标记显示/隐藏
   *
   * @param {string[]} names - 标记名称数组
   * @param {boolean} isShow - 是否显示
   */
  showByName(names, isShow) {
    if (!Array.isArray(names)) return;

    this.markers.forEach(marker => {
      if (names.includes(marker.label)) {
        marker.isDisplay = isShow;
        if (marker.vmInstance && marker.vmInstance.el) {
          marker.vmInstance.el.style.display = isShow ? "block" : "none";
        }
      }
    });
  }

  /**
   * 根据名称查找标记
   * @param {string} name - 标记名称
   * @returns {SimpleLabel|null}
   */
  findByName(name) {
    return this.markers.find(marker => marker.label === name) || null;
  }

  /**
   * 根据名称批量查找标记
   * @param {string[]} names
   * @returns {SimpleLabel[]}
   */
  findByNames(names) {
    if (!Array.isArray(names)) return [];
    return this.markers.filter(marker => names.includes(marker.label));
  }

  /**
   * 更新指定标记的位置
   * @param {string} name - 标记名称
   * @param {Cesium.Cartesian3} position - 新位置
   */
  updatePositionByName(name, position) {
    const marker = this.findByName(name);
    if (marker && marker.changePosition) {
      marker.changePosition(position);
    }
  }

  /**
   * 获取所有标记的副本（不暴露内部数组）
   * @returns {SimpleLabel[]}
   */
  getAllMarkers() {
    return [...this.markers];
  }

  /**
   * 获取标记数量
   * @returns {number}
   */
  getMarkerCount() {
    return this.markers.length;
  }

  /**
   * 销毁管理器，清理所有资源
   */
  destroy() {
    this.removeAll();
    this.viewer = null;
    this.markers = null;
    this.postRenderBound = null;
  }
}

export default HtmlMarkerManager;
