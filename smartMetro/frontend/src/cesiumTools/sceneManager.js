/**
 * @Description: Cesium 场景管理器 - 3D 地图场景的核心控制模块
 *
 * 职责：
 *   1. 初始化 Cesium Viewer（创建3D地图实例）
 *   2. 设置场景属性（光照、阴影、天空盒、后处理）
 *   3. 加载 3D Tiles 建筑白模
 *   4. 建筑模型昼夜效果着色器
 *   5. 水面渲染 + 昼夜切换效果
 *   6. 太阳光晕后期处理
 *   7. 视角控制（飞到默认位置）
 *   8. 自定义时间轴控件
 *
 * 技术亮点：
 *   - 自定义 GLSL 着色器实现太阳光晕（lens flare）
 *   - 建筑白模的自定义 CustomShader（phong光照 + 夜景光带 + IBL反射）
 *   - 水面 GroundPrimitive（自定义材质，白天/夜晚不同效果）
 *   - 昼夜自动切换（通过相机-太阳角度判断）
 *
 * @Date: 2024-05-08
 */
import * as Cesium from "cesium";
import { TencentImageryProvider } from "./mapPlugin";
import { cartesian3ToDegreesHeight } from './core'
import { CoordTransform } from '@/cesiumTools/mapPlugin.js'
import Timeline from "./TimeLine/timeline";

/**
 * 太阳光晕着色器（GLSL 片段着色器）
 *
 * 效果：当相机镜头对准太阳时，在屏幕空间产生逼真的光晕效果
 * 原理：
 *   1. 从 Cesium 内部获取太阳在屏幕空间的投影坐标（sunPositionWC）
 *   2. 对每个像素计算其与太阳位置的距离
 *   3. 根据距离生成多层光晕：中心明亮光斑 + 星芒 + 光环 + 衍射条纹
 *   4. 使用噪声函数（rnd）增加自然感
 *   5. 与原始场景颜色叠加（不是替换）
 *
 * 参数：
 *   u_isShow: 控制光晕是否可见（0=隐藏, 1=显示）
 *   u_brightness: 光晕亮度系数
 */
const lensflareShader = /*glsl*/`
// ...（着色器代码保持不变）...
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
varying vec2 v_textureCoordinates;
uniform float u_isShow;
uniform float u_brightness;

float rnd(vec2 p) {
    float f = fract(sin(dot(p, vec2(12.1234, 72.8392)) * 45123.2));
    return f;
}

float rnd(float w) {
    float f = fract(sin(w) * 1000.);
    return f;
}

float regShape(vec2 p, int N) {
    float f;
    float a = atan(p.x, p.y) + .2;
    float b = 6.28319 / float(N);
    f = smoothstep(.5, .51, cos(floor(.5 + a / b) * b - a) * length(p.xy));
    return f;
}

vec3 circle(vec2 p, float size, float decay, vec3 color, vec3 color2, float dist, vec2 mouse) {
    float l = length(p + mouse * (dist * 4.)) + size / 2.;
    float l2 = length(p + mouse * (dist * 4.)) + size / 3.;
    float c = max(00.01 - pow(length(p + mouse * dist), size * 1.4), 0.0) * 50.;
    float c1 = max(0.001 - pow(l - 0.3, 1. / 40.) + sin(l * 30.), 0.0) * 3.;
    float c2 = max(0.04 / pow(length(p - mouse * dist / 2. + 0.09) * 1., 1.), 0.0) / 20.;
    float s = max(00.01 - pow(regShape(p * 5. + mouse * dist * 5. + 0.9, 6), 1.), 0.0) * 5.;
    color = 0.5 + 0.5 * sin(color);
    color = cos(vec3(0.44, .24, .2) * 8. + dist * 4.) * 0.5 + .5;
    vec3 f = c * color;
    f += c1 * color;
    f += c2 * color;
    f += s * color;
    return f - 0.01;
}

void main() {
    vec4 sunPos = vec4(czm_sunPositionWC, 1.0);
    vec4 sunPositionEC = czm_view * sunPos;
    vec4 sunPositionWC = czm_eyeToWindowCoordinates(sunPositionEC);
    sunPositionWC.xy /= czm_viewport.zw;

    vec2 uv = v_textureCoordinates - 0.5;
    uv.x *= czm_viewport.z / czm_viewport.w;

    float iTime = czm_frameNumber / 60.;

    vec2 mm = sunPositionWC.xy;
    mm -= 0.5;
    mm.x *= czm_viewport.z / czm_viewport.w;

    vec3 circColor = vec3(0.9, 0.2, 0.1);
    vec3 circColor2 = vec3(0.3, 0.1, 0.9);

    vec3 color = mix(vec3(0.3, 0.2, 0.02) / 0.9, vec3(0.2, 0.5, 0.8), uv.y) * 3. - 0.52 * sin(iTime);

    for(float i = 0.; i < 10.; i++) {
        color += circle(uv, pow(rnd(i * 2000.) * 1.8, 2.) + 1.41, 0.0, circColor + i, circColor2 + i, rnd(i * 20.) * 3. + 0.2 - .5, mm);
    }

    float a = atan(uv.y - mm.y, uv.x - mm.x);
    float l = max(1.0 - length(uv - mm) - 0.84, 0.0);
    float bright = 0.1;

    color += max(0.1 * 2.0 / pow(length(uv - mm) * 5., 5.), 0.0) * abs(sin(a * 5. + cos(a * 9.))) / 20.;
    color += max(0.1 * 2.0 / pow(length(uv - mm) * 10., 1. / 20.), .0) + abs(sin(a * 3. + cos(a * 9.))) / 8. * (abs(sin(a * 9.))) / 1.;
    color += (max(bright / pow(length(uv - mm) * 4., 1. / 2.), 0.0) * 4.) * vec3(0.2, 0.21, 0.3) * 4.;

    color *= exp(1.0 - length(uv - mm)) / 5.;

    vec4 fragColor = vec4(color * u_isShow, 1.0);
    gl_FragColor = texture2D(colorTexture, v_textureCoordinates) + fragColor * u_brightness;
}
`

// ============================================
// 初始化 Cesium Viewer（3D 地图核心实例）
// ============================================
/**
 * 初始化 Cesium Viewer 实例
 *
 * @param {string} container - DOM 容器元素的 id
 * @returns {Cesium.Viewer} 配置完成的 Viewer 实例
 *
 * 配置要点：
 *   - 隐藏所有默认控件（timeline/animation/baseLayerPicker等），使用自定义 UI
 *   - 使用腾讯地图作为底图（替代默认的 Bing Maps）
 *   - 允许更大范围的缩放（maxZoomDistance = 100km）
 *   - 开启 WebGL1 兼容模式（支持自定义着色器）
 *   - 防止 v-scale-screen 缩放时 canvas 尺寸归零导致崩溃
 *   - 显示 FPS 性能调试面板
 */
export const initViewer = (container) => {
  const viewer = new Cesium.Viewer(container, {
    timeline: false,              // 隐藏默认时间轴（使用自定义时间轴）
    animation: false,             // 隐藏动画控件
    baseLayerPicker: false,       // 隐藏底图选择器（固定使用腾讯底图，避免 token 问题）
    infoBox: false,               // 隐藏默认信息弹窗
    selectionIndicator: false,    // 隐藏选中指示器
    homeButton: false,            // 隐藏 Home 按钮
    fullscreenButton: false,      // 隐藏全屏按钮（使用自定义全屏）
    geocoder: false,              // 隐藏地理编码搜索
    sceneModePicker: false,       // 隐藏场景模式选择器
    shouldAnimate: true,          // 启用动画循环
    navigationHelpButton: false,  // 隐藏导航帮助按钮
    // WebGL 上下文配置
    contextOptions: {
      requestWebgl1: true,                      // 兼容 WebGL1 着色器语法
      allowTextureFilterAnisotropic: true,      // 开启各向异性过滤（视角倾斜时不模糊）
      webgl: {
        alpha: false,                           // 画布不透明
        depth: true,                            // 开启深度测试
        stencil: false,                         // 关闭模板测试
        antialias: true,                        // 开启抗锯齿
        powerPreference: "high-performance",    // 优先使用高性能 GPU
        premultipliedAlpha: true,               // 预乘 alpha
        preserveDrawingBuffer: false,           // 不保留绘制缓冲区
        failIfMajorPerformanceCaveat: false,    // 低性能硬件不直接失败
      },
    },
  });

  // 显示 FPS 性能面板
  viewer.scene.debugShowFramesPerSecond = true

  // 腾讯底图配置
  const options = {
    style: 4,      // 底图样式编号（腾讯地图的多种样式）
    crs: "WGS84",  // 坐标参考系
  };

  // 添加腾讯地图作为底图（替代 Cesium 默认的 Bing Maps）
  viewer.imageryLayers.add(
    new Cesium.ImageryLayer(new TencentImageryProvider(options))
  );

  const ssc = viewer.scene.screenSpaceCameraController
  ssc.maximumZoomDistance = 100000  // 最大缩放距离 100km

  // ========================================
  // 修复：防止 canvas 尺寸异常导致的崩溃
  // 场景：v-scale-screen 缩放时或 HMR 热更新时，canvas 可能短暂变为 0×0
  // 解决：在 render 前检查 canvas 尺寸，尺寸为 0 时跳过渲染
  // ========================================
  const cesiumWidget = viewer._cesiumWidget;
  const _originalRender = cesiumWidget.render.bind(cesiumWidget);
  cesiumWidget.render = function () {
    const canvas = viewer.canvas;
    if (!canvas || canvas.clientWidth === 0 || canvas.clientHeight === 0) {
      return;  // 跳过渲染
    }
    try {
      return _originalRender();
    } catch (e) {
      if (e && e.message) {
        const msg = e.message;
        if (msg.includes('Expected width to be greater than 0') ||
            msg.includes('key is required to be a string or number')) {
          return;  // 非致命错误，跳过本帧
        }
      }
      throw e;  // 其他错误继续抛出
    }
  };

  return viewer;
};

// ============================================
// 时间轴控件
// ============================================
/**
 * 重置/初始化自定义时间轴控件
 *
 * 时间轴范围：当前时间 → 2天后
 * 时间轴用于控制列车轨迹动画的播放进度
 *
 * @param {Cesium.Viewer} viewer - Viewer 实例
 */
export const resetTimeLine = (viewer) => {
  // 固定上午 10:00（UTC+8 北京时间），让太阳在东南方
  const now = new Date();
  now.setHours(10, 0, 0, 0);
  const startTime = new Cesium.JulianDate.fromDate(now)
  const stopTime = Cesium.JulianDate.addDays(startTime, 2, new Cesium.JulianDate())
  viewer.clock.startTime = startTime
  viewer.clock.stopTime = stopTime
  viewer.clock.currentTime = startTime.clone()

  if (!viewer.timelineSelf) {
    // 首次：创建自定义时间轴 DOM 容器
    const container = document.createElement('div')
    container.className = 'cesium-viewer-timelineContainer'
    viewer.cesiumWidget.container.appendChild(container)

    // 创建时间轴控件实例
    const timeline = new Timeline(viewer, container, viewer.clock)

    // 监听时间轴拖动事件：拖拽时间轴时暂停动画
    timeline.addEventListener("settime", onTimelineScrubfunction, false);
    function onTimelineScrubfunction(e) {
      const clock = e.clock;
      clock.currentTime = e.timeJulian;  // 跳转到指定时间
      clock.shouldAnimate = false;       // 暂停自动播放
    }

    timeline.zoomTo(viewer.clock.startTime, viewer.clock.stopTime);
    viewer.timelineSelf = timeline  // 缓存到 viewer 上
  } else {
    // 已存在：重设时间轴范围
    viewer.clock.shouldAnimate = false;
    viewer.timelineSelf.zoomTo(viewer.clock.startTime, viewer.clock.stopTime);
  }
}

// ============================================
// 场景属性设置
// ============================================
/**
 * 设置场景基础属性
 *
 * 包括：
 *   - 隐藏 Cesium 版权信息
 *   - 开启地形深度测试
 *   - 开启阴影（shadow map）
 *   - 设置自定义天空盒（6面天空纹理）
 *   - 配置 FXAA 抗锯齿
 *   - 配置 Bloom（泛光）后处理效果
 *   - 配置环境光遮蔽（AO，初始关闭）
 *
 * @param {Cesium.Viewer} viewer - Viewer 实例
 */
export const setScene = (viewer) => {
  resetTimeLine(viewer)

  // 隐藏 Cesium 版权信息
  viewer._cesiumWidget._creditContainer.style.display = "none";

  // 地形深度测试：开启后地表上的物件与地形有正确的遮挡关系
  viewer.scene.globe.depthTestAgainstTerrain = true;

  // 阴影配置
  viewer.scene.globe.shadows = Cesium.ShadowMode.ENABLED;
  viewer.shadows = true;
  viewer.shadowMap.size = 2048;            // 阴影贴图分辨率
  viewer.shadowMap.softShadows = false;    // 硬阴影（性能考虑）
  viewer.shadowMap.maximumDistance = 4000; // 阴影最大距离（米）

  // 日照效果（太阳光照）
  viewer.scene.sun.show = true
  viewer.scene.globe.enableLighting = true

  // 雾效设置（远距离衰减）
  viewer.scene.fog.minimumBrightness = 0.5;
  viewer.scene.fog.density = 2.0e-4 * 1.2;

  // 大气光照强度
  viewer.scene.globe.atmosphereLightIntensity = 1;
  viewer.scene.globe.atmosphereBrightnessShift = -0.01;

  // 自定义天空盒（替换默认黑色天空）
  // 使用 6 张 1024×1024 的立方体贴图
  viewer.scene.skyBox = new Cesium.SkyBox({
    sources: {
      positiveX: "/src/assets/skyBox/px.jpg",  // 右
      negativeX: "/src/assets/skyBox/nx.jpg",  // 左
      positiveY: "/src/assets/skyBox/py.jpg",  // 上
      negativeY: "/src/assets/skyBox/ny.jpg",  // 下
      positiveZ: "/src/assets/skyBox/pz.jpg",  // 前
      negativeZ: "/src/assets/skyBox/nz.jpg",  // 后
    },
  });

  // ========== 后处理效果 ==========

  // FXAA 快速近似抗锯齿（性能友好）
  viewer.scene.postProcessStages.fxaa.enabled = true

  // Bloom 泛光效果（亮区向周围扩散光晕）
  viewer.scene.postProcessStages.bloom.enabled = false;  // 初始关闭
  viewer.scene.postProcessStages.bloom.uniforms.contrast = 119;
  viewer.scene.postProcessStages.bloom.uniforms.brightness = -0.4;
  viewer.scene.postProcessStages.bloom.uniforms.glowOnly = false;  // 非纯发光模式
  viewer.scene.postProcessStages.bloom.uniforms.delta = 0.9;
  viewer.scene.postProcessStages.bloom.uniforms.sigma = 3.78;
  viewer.scene.postProcessStages.bloom.uniforms.stepSize = 5;

  // 环境光遮蔽（AO，增加立体感，初始关闭）
  viewer.scene.postProcessStages.ambientOcclusion.enabled = false;
};

// ============================================
// 太阳光晕后期处理
// ============================================
let lensflareStage  // 光晕 Stage 单例

/**
 * 添加太阳光晕后期处理效果
 * 使用自定义 GLSL 着色器，在屏幕上叠加光晕效果
 * 只在第一次调用时创建（后续调用不重复创建）
 */
export const setSelfPostProgress = (viewer) => {
  if (!lensflareStage) {
    viewer.scene.globe.enableLighting = true

    // 创建后处理 Stage
    lensflareStage = new Cesium.PostProcessStage({
      name: 'lensflare',
      fragmentShader: lensflareShader,  // 使用顶部的自定义光晕着色器
      uniforms: {
        u_isShow: 0,       // 初始隐藏光晕
        u_brightness: 0.5  // 亮度
      }
    })

    viewer.scene.postProcessStages.add(lensflareStage)
  }
}

// ============================================
// 3D Tiles 模型加载
// ============================================
/**
 * 批量加载多个 3D Tiles 模型
 *
 * @param {Cesium.Viewer} viewer - Viewer 实例
 * @param {Array<{url: string, options?: object}>} urls - 模型 URL 列表
 * @param {Function} loadCb - 全部加载完成的回调，参数为 tileset 数组
 */
export const loadTilesets = async (viewer, urls, loadCb) => {
  const tilesets = urls.map((item) => {
    const { url, options } = item;
    let params = { url };

    // 合并额外选项
    if (typeof options === "object") {
      Object.assign(params, options);
    }

    const tile = viewer.scene.primitives.add(
      new Cesium.Cesium3DTileset(params)
    );
    return tile.readyPromise;  // 返回加载完成的 Promise
  });

  let result = await Promise.all(tilesets);  // 等待全部加载完成
  loadCb && loadCb(result);
};

// ============================================
// 建筑模型效果（自定义着色器）
// ============================================
/**
 * 设置建筑白模的默认样式和昼夜效果着色器
 *
 * 效果：
 *   白天模式：
 *     - 建筑高度渐变着色（低处暗 → 高处亮）
 *     - Phong 光照模型（环境光 + 漫反射）
 *     - IBL（基于图像的照明）反射贴图（让建筑表面有天空反射）
 *   夜晚模式（u_isDark = true）：
 *     - 建筑顶部固定颜色增加立体感
 *     - 动态光带效果（colorStripe）：沿建筑高度向上流动的彩色光带
 *     - 夜景 IBL 反射贴图
 *     - 周期性脉冲光晕（从下向上扫描）
 *
 * @param {Cesium.Cesium3DTileset} tile - 建筑白模 tileset
 */
export const handleDefaultModelEffect = (tile) => {
  // 初始样式：根据海拔高度着色
  tile.style = new Cesium.Cesium3DTileStyle({
    color: {
      conditions: [
        // 海拔 < 20m → 透明（这部分可能是水面以下）
        ["Number(${Elevation})<20", "color('rgb(25, 211, 226)',0.0)"],
        // 海拔 > 20m → 淡蓝色半透明
        ["Number(${Elevation})>20", "color('rgb(25, 211, 226)',1)"],
      ],
      show: false,
    },
  });

  // 自定义着色器
  const customShader = new Cesium.CustomShader({
    // ======== Uniform 变量 ========
    uniforms: {
      maxHeight: {
        type: Cesium.UniformType.FLOAT,
        value: 660.0,  // 建筑最高海拔（高亮范围的上限）
      },
      minHeight: {
        type: Cesium.UniformType.FLOAT,
        value: 520.0,  // 建筑最低海拔（基础高度）
      },
      u_isDark: {
        type: Cesium.UniformType.BOOL,
        value: false   // 当前是否为夜晚模式
      },
      u_TextureNight: {
        type: Cesium.UniformType.SAMPLER_2D,
        value: new Cesium.TextureUniform({
          url: import.meta.env.PROD ? '/assets/night.jpg' : '/src/assets/night.jpg'
        })
      },
      u_TextureDay: {
        type: Cesium.UniformType.SAMPLER_2D,
        value: new Cesium.TextureUniform({
          url: import.meta.env.PROD ? '/assets/sky.jpg' : '/src/assets/sky.jpg'
        })
      },
      u_colorTexture: {
        type: Cesium.UniformType.SAMPLER_2D,
        value: new Cesium.TextureUniform({
          url: import.meta.env.PROD ? '/assets/color.png' : '/src/assets/color.png'
        })
      }
    },
    mode: Cesium.CustomShaderMode.MODIFY_MATERIAL,  // 修改材质模式（不是替换）
    lightingModel: Cesium.LightingModel.PBR,         // 物理基础渲染光照模型

    vertexShaderText: /*glsl*/ `
      void vertexMain(VertexInput vsInput, inout czm_modelVertexOutput vsOutput) {
        // 顶点着色器：不需要额外处理，保留默认行为
      }
    `,

    fragmentShaderText: /*glsl*/ `
      /**
       * 获取 IBL（基于图像的照明）反射颜色
       * 根据法线方向从环境贴图中采样
       * 白天/夜晚使用不同的贴图
       */
      vec3 getIBLReflection(vec3 positionEC, vec3 normalEC) {
        vec3 eyeToSurfaceDir = normalize(positionEC);
        vec3 direction = reflect(eyeToSurfaceDir, normalEC);
        vec3 coord = normalize(vec3(czm_inverseViewRotation * direction));
        vec3 resCol = vec3(0.);
        if(u_isDark) {
          resCol = texture2D(u_TextureNight, vec2(coord.x, (coord.z - coord.y) / 3.0)).rgb;
        } else {
          resCol = texture2D(u_TextureDay, vec2(coord.x, (coord.z - coord.y) / 3.0)).rgb;
        }
        return resCol;
      }

      /**
       * 夜景光带效果
       * 在建筑表面生成周期性的彩色条纹
       * 条纹随时间向上流动（通过 czm_frameNumber 驱动）
       */
      vec3 getColorStripe(vec3 positionMC, float czm_h) {
        vec3 col = vec3(0.1, 0.2, 0.2);
        float heightInterval = 50.;    // 光带间距 50 米
        float lineWidth = 5.;          // 光带宽度 5 米
        float modRes = mod(positionMC.y, heightInterval);
        float iTime = czm_frameNumber / 120.;

        // 从色板纹理中采样颜色，让光带有色彩变化
        float textureX = fract(positionMC.x / 50.);
        float textureY = fract(positionMC.y / 50.) - iTime;  // 随时间滚动
        vec3 highLightCol = texture2D(u_colorTexture, vec2(textureX, textureY)).rgb;

        if(modRes < lineWidth) {
          col = highLightCol;   // 在光带宽度内使用彩色
        } else {
          col *= czm_h;         // 否则使用基础色 × 高度衰减
        }
        return col;
      }

      void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
        vec3 positionMC = fsInput.attributes.positionMC;   // 模型坐标
        vec3 positionEC = fsInput.attributes.positionEC;    // 视点坐标
        vec3 normalEC = fsInput.attributes.normalEC;        // 视点法线

        float ambientCoefficient = 0.3;
        float diffuseCoefficient = max(0.0, dot(normalEC, czm_sunDirectionEC));

        float _baseHeight = minHeight;
        float _heightRange = maxHeight;
        float _glowRange = maxHeight;

        float czm_height = positionMC.y - _baseHeight - 65.0;
        float czm_h = czm_height / _heightRange;  // 0~1 的高度比例
        float bottomColor = czm_height / _heightRange * 2.0;

        vec3 resCol = material.diffuse;

        if(u_isDark) {
          // ======== 夜晚模式 ========

          // 房顶固定颜色（增加立体感）
          if(czm_height < 29.0) {
            resCol *= vec3(bottomColor);
          } else {
            resCol *= vec3(czm_h);  // 高度越高越亮
          }

          // 动态光脉冲（从下向上扫描）
          float iTime = fract(czm_frameNumber / 240.0);
          iTime = abs(fract(iTime) * 2.0 - 1.0);  // 0→1→0 的周期性
          float czm_diff = step(0.002, abs(czm_h - iTime));
          float brightness = (1.0 - czm_diff) * 10.0;

          // IBL 夜景反射
          vec3 IBLCol = getIBLReflection(positionEC, normalEC);
          resCol = mix(resCol, IBLCol, 0.5);

          // 添加彩色光带
          vec3 colorStripe = getColorStripe(positionMC, czm_h);
          resCol += (resCol * brightness);    // 脉冲光晕
          resCol += colorStripe * 3.;         // 光带叠加

        } else {
          // ======== 白天模式 ========

          // IBL 反射
          vec3 IBLCol = getIBLReflection(positionEC, normalEC);
          resCol *= vec3(czm_h);             // 高度渐变
          resCol = mix(resCol, IBLCol, 0.5); // 混合反射

          // Phong 光照模型（环境光 + 漫反射）
          resCol *= min(diffuseCoefficient + ambientCoefficient, 1.0);
        }

        material.diffuse = resCol;
        material.alpha = 1.0;
      }
    `,
  });

  tile.customShader = customShader;
};

// ============================================
// 水面渲染（自定义 GroundPrimitive + 自定义材质）
// ============================================
/**
 * 渲染水面效果
 *
 * 步骤：
 *   1. 加载 GeoJSON 水面边界数据
 *   2. 提取每个水面多边形的坐标
 *   3. GCJ-02 → WGS-84 坐标转换
 *   4. 创建 GeometryInstance 数组（PolygonGeometry，带挤出高度）
 *   5. 创建自定义水面材质（白天蓝色波浪 / 夜晚流彩效果）
 *   6. 添加为 GroundPrimitive（贴地渲染）
 *
 * 材质特点：
 *   - 白天：借鉴 Cesium 内置 water.glsl，生成动态波浪法线 + 高光
 *   - 夜晚：使用噪声迭代生成流光溢彩效果（shaderToy 风格）
 *
 * @returns {Promise<Cesium.GroundPrimitive>} 水面 Primitive
 */
export const renderWater = async (viewer) => {
  const src = import.meta.env.PROD ? "/assets/water.json" : "/src/assets/water.json";
  const data = await new Cesium.GeoJsonDataSource.load(src);

  const entities = data.entities.values;
  const instances = [];

  entities.forEach((ent) => {
    const hierarchy = ent.polygon.hierarchy.getValue();
    let positions = hierarchy.positions

    // GCJ-02 → WGS-84 坐标转换
    positions = positions.map(position => {
      const [lng, lat] = cartesian3ToDegreesHeight(position)
      const newPos = CoordTransform.GCJ02ToWGS84(lng, lat);
      return new Cesium.Cartesian3.fromDegrees(newPos[0], newPos[1], 0)
    })

    // 创建几何实例（带挤出高度，实现水体厚度效果）
    const instance = new Cesium.GeometryInstance({
      geometry: new Cesium.PolygonGeometry({
        polygonHierarchy: new Cesium.PolygonHierarchy(positions),
        extrudedHeight: 5,   // 挤出顶部高度
        height: 1,           // 底部高度
      }),
    });
    instances.push(instance);
  });

  // 水面外观（自定义材质）
  const appearance = new Cesium.MaterialAppearance({
    material: new Cesium.Material({
      fabric: {
        type: "WaterSelf",  // 自定义材质类型名
        uniforms: {
          baseWaterColor: new Cesium.Color(0.0, 0.5, 0.9, 0.8),   // 基础水色
          blendColor: new Cesium.Color(0.0, 1.0, 0.699, 1.0),     // 混合颜色
          specularMap: Cesium.Material.DefaultImageId,
          normalMap: import.meta.env.PROD ? '/assets/waterNormals.jpg' : '/src/assets/waterNormals.jpg',
          frequency: 3000.0,       // 波纹频率
          animationSpeed: 0.05,    // 动画速度
          amplitude: 1.0,          // 波纹振幅
          specularIntensity: 0.7,  // 高光强度
          fadeFactor: 1.0,         // 衰减系数
          u_isDark: false          // 是否夜晚模式
        },
        source: /*glsl*/`
          // ... (水面材质 GLSL 代码保持不变) ...
          #define TAU 6.28318530718
          #define MAX_ITER 5

          uniform sampler2D specularMap;
          uniform sampler2D normalMap;
          uniform vec4 baseWaterColor;
          uniform vec4 blendColor;
          uniform float frequency;
          uniform float animationSpeed;
          uniform float amplitude;
          uniform float specularIntensity;
          uniform float fadeFactor;

          struct Water {
            vec3 waterCol;
            float alpha;
            vec3 normal;
            float specular;
            float shininess;
          };

          // 获取水面法线和颜色（源于 Cesium 内置 water.glsl）
          Water getWaterNormalCol(czm_materialInput materialInput) {
            Water water;
            float time = czm_frameNumber * animationSpeed;
            float fade = max(1.0, (length(materialInput.positionToEyeEC) / 10000000000.0) * frequency * fadeFactor);
            float specularMapValue = texture2D(specularMap, materialInput.st).r;
            vec4 noise = czm_getWaterNoise(normalMap, materialInput.st * frequency, time, 0.0);
            vec3 normalTangentSpace = noise.xyz * vec3(1.0, 1.0, (1.0 / amplitude));
            normalTangentSpace.xy /= fade;
            normalTangentSpace = mix(vec3(0.0, 0.0, 50.0), normalTangentSpace, specularMapValue);
            normalTangentSpace = normalize(normalTangentSpace);

            float tsPerturbationRatio = clamp(dot(normalTangentSpace, vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
            float alpha = mix(blendColor.a, baseWaterColor.a, specularMapValue) * specularMapValue;
            vec3 col = mix(blendColor.rgb, baseWaterColor.rgb, specularMapValue);
            col += (0.1 * tsPerturbationRatio);
            water.waterCol = col;
            water.alpha = alpha;
            water.normal = normalize(materialInput.tangentToEyeMatrix * normalTangentSpace);
            water.specular = specularIntensity;
            water.shininess = 10.0;
            return water;
          }

          // 夜景水面颜色（shaderToy 风格迭代噪声）
          vec3 getNightWaterCol(czm_materialInput materialInput) {
            vec2 uv = materialInput.st;
            uv *= 5.0;
            vec2 p = mod(uv * TAU, TAU) - 250.0;
            vec2 i = vec2(p);
            float c = 1.0;
            float inten = .005;
            float iTime = czm_frameNumber * animationSpeed;
            float time = iTime * .5 + 23.0;
            for (int n = 0; n < MAX_ITER; n++) {
              float t = time * (1.0 - (3.5 / float(n + 1)));
              i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
              c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
            }
            c /= float(MAX_ITER);
            c = 1.17 - pow(c, 1.4);
            vec3 colour = vec3(pow(abs(c), 8.0));
            colour = clamp(colour + vec3(0.0, 0.35, 0.5), 0.0, 1.0);
            return colour;
          }

          czm_material czm_getMaterial(czm_materialInput materialInput) {
            czm_material material = czm_getDefaultMaterial(materialInput);
            Water water = getWaterNormalCol(materialInput);
            vec3 waterNight = getNightWaterCol(materialInput);

            if(u_isDark) {
              material.diffuse = waterNight;
              material.alpha = 1.0;
            } else {
              material.alpha = water.alpha;
              material.diffuse = water.waterCol;
              material.normal = water.normal;
              material.specular = water.specular;
              material.shininess = water.shininess;
            }
            return material;
          }
        `
      },
    }),
  });

  // 创建 GroundPrimitive（贴地渲染）
  return viewer.scene.primitives.add(
    new Cesium.GroundPrimitive({
      geometryInstances: instances,
      appearance,
    })
  );
};

// ============================================
// 昼夜切换控制
// ============================================
/**
 * 根据相机-太阳角度自动切换白天/夜晚效果
 *
 * 原理：
 *   - 计算相机方向向量 与 太阳方向向量的点积
 *   - 点积 < 0 → 太阳在相机背后 → 夜晚
 *   - 点积 > 0 → 太阳在相机前方 → 白天
 *
 * 切换效果：
 *   - 夜晚：开启 Bloom（泛光）、关闭 AO、建筑夜景着色器 + 光带、水面夜景效果
 *   - 白天：关闭 Bloom、开启 AO、建筑白天着色器、水面蓝色波浪效果
 *   - 同时根据角度调整底图亮度（夜间降低亮度）
 */
export const handleUpdateScene = (viewer, tileset, waterPrimitive) => {
  let _angle = 0;  // 记录上一次的角度，避免重复更新

  const updateScene = () => {
    // 太阳在世界空间的方向
    const sunDirection = Cesium.Cartesian3.normalize(
      viewer.scene.sun._boundingVolume.center, new Cesium.Cartesian3()
    );
    // 相机在世界空间的方向
    const cameraDirection = Cesium.Cartesian3.normalize(
      viewer.camera.position, new Cesium.Cartesian3()
    );

    // 点积：cos(夹角)，< 0 表示夜晚
    const angle = parseFloat(Cesium.Cartesian3.dot(cameraDirection, sunDirection).toFixed(3))

    // 角度没变化 → 跳过（性能优化）
    if (angle === _angle) return false;

    // === 默认先按白天配置 ===
    viewer.postProcessStages.bloom.enabled = false;
    viewer.scene.postProcessStages.ambientOcclusion.enabled = true;
    tileset.customShader.uniforms.u_isDark.value = false;

    // 调整底图亮度（根据角度动态变化）
    const value = Cesium.Math.clamp(angle, 0, 1);
    const imageryLayer = viewer.imageryLayers.get(0)
    if (imageryLayer) {
      imageryLayer.brightness = value + 0.3;
    }

    // 更新水面材质
    if (waterPrimitive) {
      waterPrimitive.appearance.material.uniforms.u_isDark = angle < 0 ? true : false
    }

    // 光晕效果（只在白天显示）
    if(lensflareStage) {
      lensflareStage.uniforms.u_isShow = 1  // 默认显示
    }

    // === 夜晚特殊处理 ===
    if (angle < 0) {
      viewer.postProcessStages.bloom.enabled = true;            // 开启泛光
      viewer.scene.postProcessStages.ambientOcclusion.enabled = false;  // 关闭 AO
      tileset.customShader.uniforms.u_isDark.value = true;     // 建筑切换到夜景
      if(lensflareStage) {
        lensflareStage.uniforms.u_isShow = 0  // 隐藏光晕
      }
    }

    _angle = angle
  }

  // 注册 postRender 事件：每帧渲染后检查是否需要切换
  viewer.scene.postRender.addEventListener(() => updateScene())
}

// ============================================
// 视角控制
// ============================================
/**
 * 飞到武汉默认俯瞰视角
 * 目标坐标：(113.95°E, 30.19°N, 34000m 高度)
 * 朝向：东北方向35°，俯视-37°
 */
export const flyToDefaultView = (viewer) => {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(113.95, 30.19, 34000),
    duration: 2,  // 飞行时间 2 秒
    orientation: {
      heading: Cesium.Math.toRadians(35.0),
      pitch: Cesium.Math.toRadians(-37.0),
      roll: 0.0,
    },
  });
};
