/**
 * @Description: 底部圆环发光材质 - 站点底部渐变圆形光圈
 *
 * 视觉效果：从圆心向外辐射的发光渐变圆
 *   - 圆心向外0.1：纯白（最亮）
 *   - 0.1-0.2：快速衰减到透明
 *   - 0.2-0.3：回弹到90%不透明（光环）
 *   - 0.3-0.5：渐变到透明
 *   - 0.5-0.9：微弱发光
 *   - 0.9-1.0：回到白色（边缘亮环）
 *
 * 原理：
 *   1. 使用 Canvas 2D 绘制径向渐变圆（createRadialGradient）
 *   2. 将 Canvas 导出为 base64 图片
 *   3. 作为 Cesium MaterialProperty 的贴图源
 *   4. 与实体颜色混合产生彩色发光效果
 *
 * 使用：effectController.bottomCircle() 中的 ellipse.material
 *
 * @Date: 2023-04-23
 */
import * as Cesium from 'cesium'

/**
 * 创建底部圆材质纹理图片
 * 在离屏 Canvas 上绘制放射状渐变圆
 * @returns {string} base64 图片 URL
 */
function createBottomCircleTexture() {
    let canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    let ctx = canvas.getContext('2d');

    // 创建径向渐变：从圆心(256,256)向外扩散到半径256
    let gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);

    // 多段渐变实现"发光光环"效果
    gradient.addColorStop(0.1, "rgba(255, 255, 255, 1.0)");   // 圆心：纯白不透明
    gradient.addColorStop(0.2, "rgba(255, 255, 255, 0.0)");   // 快速衰减
    gradient.addColorStop(0.3, "rgba(255, 255, 255, 0.9)");   // 光环回弹
    gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.0)");   // 再次衰减
    gradient.addColorStop(0.9, "rgba(255, 255, 255, 0.2)");   // 微弱外围
    gradient.addColorStop(1.0, "rgba(255, 255, 255, 1.0)");   // 边缘亮环

    ctx.clearRect(0, 0, 512, 512);
    ctx.beginPath();
    ctx.arc(256, 256, 256, 0, Math.PI * 2, true);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.restore();

    // 导出为 base64 图片 URL（用于 Cesium 贴图）
    return canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
}

/**
 * 底部圆环发光材质属性
 * 继承 Cesium 的 MaterialProperty 接口
 *
 * @param {Cesium.Color} color - 圆环叠加的颜色（站点标识色）
 */
function ConeGlowBottomCircleMaterialProperty(color) {
    this._definitionChanged = new Cesium.Event();  // 材质变化事件
    this._color = undefined;
    this._colorSubscription = undefined;
    this.color = color;
}

// (后续 property getter/setter...此材质通过 createBottomCircleTexture() 的图片 + Entity color 混合)
export default ConeGlowBottomCircleMaterialProperty;
