/**
 * @Description: 渐变墙体材质 - 用于活动圆柱标记的渐变遮罩
 *
 * 视觉效果：
 *   圆柱体从上到下逐渐变透明，形成"渐隐光柱"效果。
 *   使用 Cesium 内置的 WallGradientsImage 作为 alpha 遮罩，
 *   叠加自定义颜色实现彩色渐变墙体。
 *
 * 原理：
 *   - 返回 { color, image } 材质值
 *   - image: Cesium.Material.WallGradientsImage（内置渐变贴图）
 *   - color: 自定义颜色（站点/活动标识色）
 *   - Cesium 底层将 image 的 alpha 通道与 color 混合
 *
 * 使用：effectController.addGradientCone() 中的 wall.material
 *
 * @Date: 2024-05-15
 */
import * as Cesium from "cesium";

/**
 * 渐变墙体材质属性
 * @param {Cesium.Color} color - 墙体颜色
 */
function WallGradientsMaterialProperty(color) {
  this._definitionChanged = new Cesium.Event();  // 材质变化事件
  this._color = undefined;
  this._colorSubscription = undefined;
  this.color = color;
}

// (后续 property descriptor 和 getValue 方法...)
export default WallGradientsMaterialProperty;
