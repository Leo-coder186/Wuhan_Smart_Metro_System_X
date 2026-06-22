/**
 * @Description: Cesium 效果管理器 - 地铁站点、线路、活动标记的渲染与控制
 *
 * 功能列表（按类别分组）：
 *   === 站点渲染 ===
 *   - coneWithLight():      创建站点光柱（半透明圆锥体，闪烁脉冲效果）
 *   - bottomCircle():        创建站点底部圆环（发光渐变圆）
 *   - renderStation():      渲染完整站点（光柱 + 圆环的组合调用）
 *
 *   === 站点标牌 ===
 *   - renderStationBill():  渲染站点 HTML 信息牌（带距离缩放）
 *   - removeAllBillboards(): 清除所有站点标牌
 *   - changeDisplayBillBoard(): 按名称控制标牌显示/隐藏
 *
 *   === 站点管理 ===
 *   - removeStationByName():  按名称删除单个站点
 *   - hideStationByName():    按名称数组批量控制站点显隐
 *   - removeAllStations():    删除所有站点
 *
 *   === 线路渲染 ===
 *   - renderLines():       创建地铁线路（泛光 Polyline）
 *   - removeAllLines():    删除所有线路
 *   - hideLineByName():    按名称控制线路显隐
 *   - binkLineByName():    线路闪烁效果（600ms间隔，闪烁6次）
 *
 *   === 视角控制 ===
 *   - flyToLine():         飞到指定线路的质心
 *   - flyToLineCenter():   飞到站线质心点（带偏移）
 *   - flyToDefaultView():  飞到武汉默认俯瞰视角
 *   - flyToCone():         飞到指定活动圆柱
 *   - focusOnStation():    聚焦到站点并显示查询弹窗
 *
 *   === 活动标记 ===
 *   - addGradientCone():   添加渐变圆柱（重保活动标记）
 *   - removeAllCones():    删除所有活动圆柱
 *
 *   === 综合操作 ===
 *   - renderAll():           批量渲染全部线路和站点
 *   - removeAll():           清除全部（线路 + 站点 + 标牌 + 管理器）
 *   - removeByCacheData():   按缓存数据清除（组件级缓存管理）
 *   - displayByName():       按名称整体控制显示/隐藏
 *
 *   === 其他 ===
 *   - renderHeat():          渲染站点拥挤度热力图
 *   - registerMouseEvent():  注册左键/右键鼠标事件
 *
 * 架构说明：
 *   - 全局缓存数组：stations（站点）、lines（线路）、billboards（标牌）、cones（圆柱）
 *   - HtmlMarkerManager 单例管理所有 HTML 标记的生命周期
 *   - renderAll() 的 isCache 参数控制走全局缓存还是返回组件级 cacheData
 *   - 路径规划场景不走全局缓存（防止污染其他功能）
 *
 * @Date: 2024-05-13
 */
import * as Cesium from "cesium";
import ConeGlowBottomCircleMaterialProperty from "./texutruedCircle";  // 站点底部圆环材质（渐变发光圆）
import WallGradientsMaterialProperty from "./wallMaterial";            // 电子围栏渐变材质（用于活动圆柱）
import { generateCirclePoints, pointsToPositions } from "./core";
import SimpleLabel from './Bubble/htmlMarker'         // HTML 标记组件
import HtmlMarkerManager from './Bubble/htmlMarkerManager'  // HTML 标记管理器（单例）
import getCesiumHeat from "./cesiumHeatMap";           // 热力图插件

// ============================================
// HTML 标记管理器（全局单例）
// 所有站点标牌统一由此管理器管理生命周期
// ============================================
let htmlMarkerManager = null;

/**
 * 获取或创建 HtmlMarkerManager 实例（单例模式）
 *
 * 单例的好处：
 *   1. 避免重复创建管理器导致内存泄漏
 *   2. 所有标记统一管理，便于批量操作（如删除、查找）
 *
 * @param {Cesium.Viewer} viewer - Cesium Viewer 实例
 * @returns {HtmlMarkerManager} 管理器实例
 */
export const getHtmlMarkerManager = (viewer) => {
  if (!htmlMarkerManager) {
    htmlMarkerManager = new HtmlMarkerManager(viewer);
  }
  return htmlMarkerManager;
};

// ============================================
// 站点光柱效果（半透明圆锥体）
//
// 视觉效果：
//   站点位置上方出现一个向上延伸的半透明光柱
//   光柱会周期性脉冲闪烁（快慢交替）
//   从圆柱中心向边缘：颜色逐渐透明
//
// 原理：
//   - 使用 CylinderGeometry（顶半径0 = 圆锥形）
//   - ENU 局部坐标系变换将圆柱抬高到半高度
//   - 自定义 GLSL 片段着色器实现渐变透明 + 闪烁
// ============================================

/**
 * 创建站点光柱 Primitive
 *
 * @param {Cesium.Viewer} viewer
 * @param {Object} options
 *   - position: Cesium.Cartesian3 光柱底部中心坐标
 *   - height: 光柱高度（默认 700 米）
 *   - bottomRadius: 底部半径（默认 100 米）
 *   - color: Cesium.Color 光柱颜色（默认 AQUA）
 * @returns {Cesium.Primitive} 光柱实例（可通过 .show 控制显隐）
 */
export const coneWithLight = (viewer, options) => {
  const position = Cesium.defaultValue(
    options.position,
    Cesium.Cartesian3.ZERO
  );
  const height = Cesium.defaultValue(options.height, 700);
  const bottomRadius = Cesium.defaultValue(options.bottomRadius, 100);
  const color = Cesium.defaultValue(options.color, Cesium.Color.AQUA);

  // 构建变换矩阵：将几何体从原点抬高 height/2
  // Cesium.Transforms.eastNorthUpToFixedFrame: 创建以 position 为原点的 ENU 局部坐标系
  // 再沿 Z 轴平移 height/2，使圆柱底部位于 position 处
  const modelMatrix = Cesium.Matrix4.multiplyByTranslation(
    Cesium.Transforms.eastNorthUpToFixedFrame(position),
    new Cesium.Cartesian3(0.0, 0.0, height * 0.5),
    new Cesium.Matrix4()
  );

  // 创建圆柱几何体（顶半径为0 = 圆锥形）
  const cylinderGeometry = new Cesium.CylinderGeometry({
    length: height,
    topRadius: 0.0,      // 顶部缩小为一点（锥形）
    bottomRadius: bottomRadius * 0.7,
    vertexFormat: Cesium.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat,
  });

  const cone = new Cesium.GeometryInstance({
    geometry: cylinderGeometry,
    modelMatrix: modelMatrix,
  });

  // 创建 Primitive，使用自定义着色器实现渐变透明
  const primitive = new Cesium.Primitive({
    geometryInstances: [cone],
    appearance: new Cesium.MaterialAppearance({
      material: new Cesium.Material({
        fabric: {
          type: "VtxfShader1",
          uniforms: { color: color },
          source: /*glsl*/ `
            uniform vec4 color;
            czm_material czm_getMaterial(czm_materialInput materialInput)
            {
              czm_material material = czm_getDefaultMaterial(materialInput);
              vec2 st = materialInput.st;
              // 周期性闪烁时间：0→1 循环（每10帧一个周期）
              float time = fract(czm_frameNumber / 10.0);
              float isAlpha = step(0.5, time);  // 前半周期 isAlpha=0，后半周期 isAlpha=1
              float dis = distance(st, vec2(0.5));  // 当前像素到圆柱中心的纹理距离

              material.diffuse = 1.9 * color.rgb;
              // 透明度：中心不透明 → 边缘透明
              if(isAlpha >= 1.0) {
                material.alpha = color.a * dis * 2.0;   // 后半周期：更透明
              } else {
                material.alpha = color.a * dis * 1.5;   // 前半周期：相对不透明
              }

              return material;
            }
          `,
        },
        translucent: false,  // 不使用 Cesium 默认半透明通道（由着色器控制）
      }),
      faceForward: false,    // 自动翻转法线方向（防止渲染异常）
      closed: true,          // 封闭体（启用背面裁剪，避免看到圆柱内部）
    }),
  })

  return viewer.scene.primitives.add(primitive);
};

// ============================================
// 站点底部圆环效果（发光渐变圆）
//
// 视觉效果：站点底部地面上出现一个发光的圆形光晕
//   从圆心向外：颜色不透明 → 渐隐
//   给人"光柱落在地面"的视觉反馈
// ============================================

/**
 * 创建站点底部发光圆环 Entity
 *
 * @param {Cesium.Viewer} viewer
 * @param {Object} options
 *   - position: Cesium.Cartesian3 圆环中心坐标
 *   - color: Cesium.Color 发光颜色（默认 AQUA）
 *   - bottomRadius: 圆环半径（默认 100 米）
 * @returns {Cesium.Entity} 圆环实体
 */
export const bottomCircle = (viewer, options) => {
  const position = Cesium.defaultValue(
    options.position,
    Cesium.Cartesian3.ZERO
  );
  const color = Cesium.defaultValue(options.color, Cesium.Color.AQUA);
  const bottomRadius = Cesium.defaultValue(options.bottomRadius, 100);

  return viewer.entities.add({
    position: position,
    ellipse: {
      semiMinorAxis: bottomRadius * 2,   // 短半轴（与长半轴等长 = 圆形）
      semiMajorAxis: bottomRadius * 2,   // 长半轴
      height: 0.0,                       // 贴地高度
      material: new ConeGlowBottomCircleMaterialProperty(color),  // 自定义渐变发光材质
    },
  });
};

// ============================================
// 站点渲染（组合：光柱 + 底部圆环）
//
// 全局缓存数组 stations：
//   存储所有已渲染的站点实体引用
//   用于批量控制显隐、删除等操作
//   通过 isCache 参数控制是否加入缓存
// ============================================
const stations = [];

/**
 * 渲染一个完整的站点视觉效果
 * 包含：上方的半透明光柱 + 底部的发光圆环
 *
 * @param {Cesium.Viewer} viewer
 * @param {Object} options
 *   - position: {lng: number, lat: number} 站点经纬度坐标
 *   - name: string 站点名称（用于后续查找和管理）
 *   - color: string 十六进制颜色字符串（如 "#218acd"）
 *   - isCache: boolean 是否加入全局缓存（默认 true，临时场景传 false）
 * @returns {{ conePrimitve, bottomCircleEntity, name }} 站点实体组合
 */
export const renderStation = (viewer, options) => {
  const name = Cesium.defaultValue(options.name, "站点");
  const position = Cesium.defaultValue(options.position, {
    lng: 0,
    lat: 0,
  });
  // 经纬度 → Cesium 笛卡尔坐标
  const positionCar3 = Cesium.Cartesian3.fromDegrees(
    position.lng,
    position.lat
  );

  // 1. 创建上空光柱
  const conePrimitve = coneWithLight(viewer, {
    position: positionCar3,
    height: 300,
    bottomRadius: 30,
    color: Cesium.Color.fromCssColorString(options.color),
  });
  conePrimitve.name = name  // 记录名称便于后续查找

  // 2. 创建底部圆环
  const bottomCircleEntity = bottomCircle(viewer, {
    position: positionCar3,
    bottomRadius: 30,
    color: Cesium.Color.fromCssColorString(options.color),
  });
  bottomCircleEntity.name = name

  const isCache = Cesium.defaultValue(options.isCache, true);
  const target = {
    conePrimitve,          // Primitive 类型（光柱）
    bottomCircleEntity,    // Entity 类型（圆环）
    name
  };

  // 加入全局缓存（路径规划等临时场景 isCache=false 不缓存）
  isCache && stations.push(target);
  return target;
};

// ============================================
// 站点 HTML 标牌渲染
//
// 使用 SimpleLabel（基于 HTML 的 Cesium 标注）
// 支持距离缩放（近大远小）
// 后期可添加点击查询功能
// ============================================
const billboards = [];

/**
 * 渲染站点信息标牌（HTML Billboard）
 *
 * 标牌内容：站点名称标签
 * 距离缩放：1000米内全尺寸 → 20000米外缩小到40%
 * 支持管理器统一管理
 *
 * @param {Cesium.Viewer} viewer
 * @param {Object} options
 *   - position: {lng, lat} 标牌位置
 *   - height: 标牌高度（默认 200）
 *   - name: 站点名称
 *   - show: 是否显示（默认 true）
 *   - color: 标牌颜色
 *   - attr: 附加属性（传递给气泡模板）
 *   - isCache: 是否缓存（默认 true）
 *   - useManager: 是否使用管理器（默认 true）
 * @returns {Promise<{ billControler, billboard, name }>}
 */
export const renderStationBill = async (viewer, options) => {
  const position = Cesium.defaultValue(options.position, {
    lng: 0,
    lat: 0,
  });
  const height = Cesium.defaultValue(options.height, 200);
  const name = Cesium.defaultValue(options.name, "站点");
  const show = Cesium.defaultValue(options.show, true);
  const color = Cesium.defaultValue(options.color, "#ff0000");
  const attr = Cesium.defaultValue(options.attr, {});
  const isCache = Cesium.defaultValue(options.isCache, true);
  const useManager = Cesium.defaultValue(options.useManager, true);

  // 创建 HTML 标注控制器
  const billControler = new SimpleLabel(
    viewer,
    {
      // 经纬度 + 高度 → 笛卡尔坐标
      position: Cesium.Cartesian3.fromDegrees(position.lng, position.lat, height),
      label: name,
      isShow: show,
      color: color,
      // 距离缩放：1000米内 scale=1，20000米外 scale=0.4
      scaleByDistance: new Cesium.NearFarScalar(1000, 1, 20000, 0.4),
      attr: attr,
      type: 'marker',
      managedByManager: useManager
    }
  );
  await billControler.addLabel();

  // 如果启用管理器，将标牌加入管理器统一管理
  if (useManager) {
    const manager = getHtmlMarkerManager(viewer);
    manager.addMarker(billControler);
  }

  const target = {
    billControler,                         // SimpleLabel 实例
    billboard: billControler.vmInstance.el, // 实际的 DOM 元素
    name
  };
  isCache && billboards.push(target);
  return target;
};

// ============================================
// 站点标牌管理
// ============================================

/**
 * 清除所有站点标牌
 * 包括：清除 DOM 元素、移除查询弹窗、清空管理器
 */
export const removeAllBillboards = () => {
  billboards.forEach((item) => {
    const { billControler } = item;
    billControler.removeMarker();
    billControler.queryPopup && billControler.removeQueryPopup();
  });
  // 同时清除管理器中的标记
  if (htmlMarkerManager) {
    htmlMarkerManager.removeAll();
  }
};

/**
 * 根据名称数组控制站点标牌的显示/隐藏
 *
 * @param {string[]} names - 站点名称数组
 * @param {boolean} isShow - true 显示 / false 隐藏
 */
export const changeDisplayBillBoard = (names, isShow) => {
  // 优先使用管理器的方法（更高效）
  if (htmlMarkerManager) {
    htmlMarkerManager.showByName(names, isShow);
  }
  // 同时更新本地缓存的 billboards（兼容性保留）
  const filterBills = billboards.filter(
    (item) => names.indexOf(item.billControler.label) > -1
  );
  filterBills.forEach((item) => {
    const { billboard, billControler } = item;
    billControler.isDisplay = isShow;
    if (billboard && billboard.style) {
      billboard.style.display = isShow ? "block" : "none";
    }
  });
};

// ============================================
// 站点管理操作
// ============================================

/**
 * 按名称删除单个站点（光柱 + 圆环 + 缓存）
 */
export const removeStationByName = (viewer, name) => {
  const target = stations.find((item) => item.name === name);
  if (target) {
    const { conePrimitve, bottomCircleEntity } = target;
    // Primitive 用 scene.primitives.remove()
    viewer.scene.primitives.remove(conePrimitve);
    // Entity 用 viewer.entities.remove()
    viewer.entities.remove(bottomCircleEntity);
    // 从缓存数组中移除
    stations.splice(stations.indexOf(target), 1);
  }
};

/**
 * 按名称数组批量控制站点显示/隐藏
 * 同时控制光柱 + 圆环 + 标牌
 */
export const hideStationByName = (names, isShow) => {
  changeDisplayBillBoard(names, isShow);  // 标牌先处理
  const targets = stations.filter((item) => names.indexOf(item.name) > -1);
  if (targets.length) {
    targets.forEach((target) => {
      const { conePrimitve, bottomCircleEntity } = target;
      conePrimitve.show = isShow;
      bottomCircleEntity.show = isShow;
    });
  }
};

/** 删除所有站点（光柱 + 圆环 + 清空缓存） */
export const removeAllStations = (viewer) => {
  stations.forEach((item) => {
    const { conePrimitve, bottomCircleEntity } = item;
    viewer.scene.primitives.remove(conePrimitve);
    viewer.entities.remove(bottomCircleEntity);
  });
  stations.length = 0;
};

// ============================================
// 地铁线路渲染
//
// 全局缓存数组 lines：存储所有线路实体引用
// 渲染使用 Cesium.PolylineGlowMaterialProperty（泛光线）
// ============================================
const lines = [];

/**
 * 创建一条地铁线路（泛光 Polyline）
 *
 * @param {Cesium.Viewer} viewer
 * @param {Object} options
 *   - positions: Array<{lng, lat}> 路径坐标数组
 *   - color: string 十六进制颜色（默认 '#e9a526' 金色）
 *   - name: string 线路名称
 *   - isCache: boolean 是否加入全局缓存（默认 true）
 * @returns {Cesium.Entity} 线路实体
 */
export const renderLines = (viewer, options) => {
  const positions = Cesium.defaultValue(options.positions, [
    { lng: 0, lat: 0 },
  ]);
  // 将 [{lng,lat}] 展平为 [lng, lat, lng, lat, ...]
  const positionsR = [];
  positions.forEach((path) => {
    positionsR.push(path.lng, path.lat);
  });

  const color = Cesium.defaultValue(options.color, '#e9a526');
  const name = Cesium.defaultValue(options.name, "line");
  const isCache = Cesium.defaultValue(options.isCache, true);

  // 批量转为 Cesium 笛卡尔坐标
  const positionRes = Cesium.Cartesian3.fromDegreesArray(positionsR);

  const lineEnt = viewer.entities.add({
    name,
    polyline: {
      positions: positionRes,
      width: 20,
      // 使用 Cesium 内置的泛光线材质（自动发光 + 光晕）
      material: new Cesium.PolylineGlowMaterialProperty({
        color: new Cesium.Color.fromCssColorString(color),
        glowPower: 0.12,  // 泛光强度（0-1，越大越亮）
      }),
    },
  });

  isCache && lines.push(lineEnt);
  return lineEnt;
};

/** 删除所有地铁线路（从地图 + 缓存中移除） */
export const removeAllLines = (viewer) => {
  lines.forEach((line) => {
    line && viewer.entities.remove(line);
  });
};

// ============================================
// 线路闪烁效果
//
// 原理：周期性切换 glowPower 属性
//   偶数次 → glowPower * 4（高亮）
//   奇数次 → 原始 glowPower（正常）
//   共闪烁 6 次，间隔 600ms
// ============================================

let timerBink;        // 闪烁定时器
let lastActiveRoute;  // 上一次高亮的线路名（防止重复触发）

/**
 * 根据线路名称闪烁线路
 * 同一线路重复点击不会重新闪烁
 *
 * @param {string} name - 线路名称
 */
export const binkLineByName = (name) => {
  const targetEnt = lines.find((item) => item.name === name);
  if (!targetEnt) {
    return;
  }

  // 防抖：如果正在闪烁同一个线路，不重复触发
  if (timerBink && name === lastActiveRoute) {
    return;
  }

  // 如果换了一条线路，先清除之前的闪烁
  if (name !== lastActiveRoute && timerBink) {
    window.clearInterval(timerBink);
    timerBink = null;
  }

  const originGlowPower = targetEnt.polyline.material.glowPower;
  const timeBreak = 600;     // 间隔 600ms
  let binkCount = 6;         // 闪烁 6 次
  let count = 0;

  timerBink = setInterval(() => {
    if (count >= binkCount) {
      // 闪烁完成：恢复原始发光强度，清除定时器
      window.clearInterval(timerBink);
      timerBink = null;
    } else {
      let isBink = count % 2 === 0;
      targetEnt.polyline.material.glowPower = isBink
        ? originGlowPower * 4   // 偶数次 → 高亮 4 倍
        : originGlowPower;      // 奇数次 → 恢复正常
      count++;
    }
  }, timeBreak);
};

// ============================================
// 视角控制
// ============================================

/**
 * 根据线路名称飞到线路质心位置
 * Cesium 会使用实体包围盒自动计算合适的视角
 */
export const flyToLine = (viewer, name) => {
  const targetEnt = lines.find((item) => item.name === name);
  if (!targetEnt) {
    return;
  }
  viewer.flyTo(targetEnt);
};

/** 按名称数组控制线路显示/隐藏 */
export const hideLineByName = (names, isShow) => {
  lines.forEach((line) => {
    if (names.indexOf(line.name) > -1) {
      line.show = isShow;
    }
  });
};

// ============================================
// 批量渲染（核心方法）
//
// 从数据源遍历所有线路，渲染所有线路 + 站点 + 标牌
// isCache=true:  走全局缓存（首页渲染），实体加入 stations/lines/billboards
// isCache=false: 不走缓存（路径规划等临时场景），返回 cacheData 供调用方管理
// ============================================

/**
 * 渲染全部线路和站点的可视化效果
 *
 * @param {Cesium.Viewer} viewer
 * @param {Array} dataSource - 线路数据源 [{ paths, name, color, stationsList }]
 * @param {boolean} isCache - 是否使用全局缓存（默认 true）
 * @returns {Object|undefined} cacheData - 不走缓存时返回 { lineEnts, stationEnts, billboards }
 */
export const renderAll = (viewer, dataSource, isCache = true) => {
  if (dataSource.length) {
    const cacheData = {
      lineEnts: [],
      stationEnts: [],
      billboards: []
    }

    dataSource.forEach((item) => {
      const { paths, name, color, stationsList } = item;

      // 渲染线路
      const lineEnt = renderLines(viewer, {
        positions: paths,
        color,
        name,
        isCache
      });
      !isCache && cacheData.lineEnts.push(lineEnt);

      // 渲染该线路下的所有站点及标牌
      stationsList.forEach(async (station) => {
        const { position, name } = station;

        // 站点（光柱 + 圆环）
        const stationEnt = renderStation(viewer, {
          position,
          name,
          color,
          isCache
        });
        !isCache && cacheData.stationEnts.push(stationEnt);

        // 站点标牌
        const billboard = await renderStationBill(viewer, {
          position,
          name,
          color,
          attr: station,    // 站点完整数据作为attr传给标牌
          isCache
        });
        !isCache && cacheData.billboards.push(billboard);
      });
    });

    return cacheData;
  }
};

// ============================================
// 清除操作
// ============================================

/** 清除全部（线路 + 站点 + 标牌 + 管理器重置） */
export const removeAll = (viewer) => {
  removeAllLines(viewer);
  removeAllStations(viewer);
  removeAllBillboards()
  if (htmlMarkerManager) {
    htmlMarkerManager.destroy();
    htmlMarkerManager = null;
  }
};

/**
 * 按照缓存数据清除实体
 * 用于路径规划等不走全局缓存的场景
 *
 * @param {Cesium.Viewer} viewer
 * @param {Object} cacheData
 *   - lineEnts: Entity[] 线路实体数组
 *   - stationEnts: Object[] 站点实体数组（含 conePrimitve, bottomCircleEntity）
 *   - billboards: Object[] 标牌数组（含 billControler）
 */
export const removeByCacheData = (viewer, cacheData) => {
  if (Object.keys(cacheData).length === 0) {
    return
  }
  const { lineEnts, stationEnts, billboards } = cacheData;

  // 清除线路
  lineEnts.forEach(line => viewer.entities.remove(line))

  // 清除站点（光柱 + 圆环）
  stationEnts.forEach(station => {
    const { conePrimitve, bottomCircleEntity } = station;
    viewer.scene.primitives.remove(conePrimitve);
    viewer.entities.remove(bottomCircleEntity);
  })

  // 清除标牌
  billboards.forEach((item) => {
    const { billControler } = item;
    billControler.removeMarker();
    billControler.removeQueryPopup();
  });
}

/**
 * 通过线路名 + 站点名批量控制显隐
 * 是 hideLineByName + hideStationByName 的组合调用
 */
export const displayByName = (lineNames, stationNames, isShow) => {
  hideLineByName(lineNames, isShow);
  hideStationByName(stationNames, isShow);
};

// ============================================
// 重保活动标记 - 渐变圆柱体
//
// 视觉效果：在活动所在站点位置生成一个高大的半透明圆柱
//   圆柱壁使用渐变材质（WallGradientsMaterialProperty）
//   从上到下颜色渐变为站点标识色
// ============================================
const cones = [];

/**
 * 添加渐变圆柱（重保活动标记）
 *
 * 实现步骤：
 *   1. 生成圆柱底面圆周坐标（generateCirclePoints）
 *   2. 经纬度 → 笛卡尔坐标（pointsToPositions）
 *   3. 创建 Entity.wall（Cesium 墙体类型）
 *   4. 使用 WallGradientsMaterialProperty 渐变材质
 *
 * @param {Cesium.Viewer} viewer
 * @param {Object} options
 *   - position: {lng, lat, height?} 圆柱中心坐标
 *   - height: 圆柱高度（默认 2600 米）
 *   - baseHeight: 圆柱底部高度（默认 0）
 *   - radius: 圆柱半径（默认 200 米）
 *   - color: string 十六进制颜色
 *   - name: string 圆柱标识名
 */
export const addGradientCone = (viewer, options) => {
  const wallColor = Cesium.defaultValue(
    new Cesium.Color.fromCssColorString(options.color),
    Cesium.Color.AQUA
  );
  const name = Cesium.defaultValue(options.name, "");
  const center = Cesium.defaultValue(options.position, {
    lng: 0, lat: 0, height: 0,
  });
  const wallHeight = Cesium.defaultValue(options.height, 2600);
  const baseHeight = Cesium.defaultValue(options.baseHeight, 0);
  const radius = Cesium.defaultValue(options.radius, 200);

  // 生成圆柱底面圆周上的坐标点
  const positions = generateCirclePoints([center.lng, center.lat], radius, baseHeight);
  // 转为 Cesium 笛卡尔坐标
  const wallPositions = pointsToPositions(positions, baseHeight);

  // 构造最小高度和最大高度数组（每个顶点对应一组）
  let minimumHeights = [];
  let maximumHeights = [];
  wallPositions.forEach((position) => {
    minimumHeights.push(baseHeight);
    maximumHeights.push(baseHeight + wallHeight);
  });

  // 创建墙体 Entity（Cesium 的 wall 类型）
  const cone = viewer.entities.add({
    name,
    center: new Cesium.Cartesian3.fromDegrees(
      center.lng,
      center.lat,
      baseHeight
    ),
    wall: {
      positions: wallPositions,        // 底面圆周坐标
      minimumHeights: minimumHeights,  // 每个顶点的最小高度
      maximumHeights: maximumHeights,  // 每个顶点的最大高度
      material: new WallGradientsMaterialProperty(wallColor),  // 渐变材质
    },
  });
  cones.push(cone);
};

/** 删除所有活动圆柱 */
export const removeAllCones = (viewer) => {
  cones.forEach((cone) => {
    cone && viewer.entities.remove(cone);
  });
  cones.length = 0;
};

/**
 * 视角飞到指定名称的活动圆柱
 * 相机偏移：航向40°，俯视-40°，距目标5000米
 */
export const flyToCone = (viewer, name) => {
  const targetCone = cones.find((item) => item.name === name);
  if (!targetCone) {
    return;
  }
  viewer.flyTo(targetCone, {
    offset: new Cesium.HeadingPitchRange(
      Cesium.Math.toRadians(40),
      Cesium.Math.toRadians(-40),
      5000
    )
  });
};

/**
 * 飞到武汉默认俯瞰视角
 * 目标：(113.95°E, 30.19°N, 34000m高度)
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

// ============================================
// 站点查找与聚焦
// ============================================

/**
 * 通过名称查找对应的站点标牌和站点实体
 *
 * 查找顺序：
 *   1. 优先查找传入的 cacheData（组件级缓存）
 *   2. 如果没找到，查找全局缓存（stations/billboards）
 *   3. 如果还没找到，尝试从 HtmlMarkerManager 中查找
 *
 * @param {string} name - 站点名称
 * @param {Object} cacheData - 可选，组件级缓存数据
 * @returns {{ billboard, station }}
 */
export const findyBillboardByName = (name, cacheData) => {
  let billboardsData = billboards
  let stationsData = stations

  // 如果传入了组件级缓存，使用组件级数据
  if (cacheData) {
    const { billboards, stationEnts } = cacheData
    billboardsData = billboards
    stationsData = stationEnts
  }

  const targetBillboard = billboardsData.find(
    (item) => item.billControler.label === name
  );

  // 如果在缓存中没找到，尝试从管理器中查找
  if (!targetBillboard && htmlMarkerManager) {
    const marker = htmlMarkerManager.findByName(name);
    if (marker) {
      return {
        billboard: {
          billControler: marker,
          billboard: marker.vmInstance?.el
        },
        station: stationsData.find((item) => item.name === name),
      };
    }
  }

  const stationEnt = stationsData.find((item) => item.name === name);
  return {
    billboard: targetBillboard,
    station: stationEnt,
  }
}

let lastFocusStation  // 上一次聚焦的站点标牌（用于关闭旧弹窗）

/**
 * 聚焦到站点并显示查询信息弹窗
 *
 * 流程：
 *   1. 查找站点和标牌
 *   2. 关闭上一次的查询弹窗
 *   3. 相机飞到站点圆环位置
 *   4. 显示查询弹窗
 *
 * @param {Cesium.Viewer} viewer
 * @param {string} name - 站点名称
 * @param {Object} cacheData - 组件级缓存（路径规划场景传入）
 */
export const focusOnStation = (viewer, name, cacheData) => {
  const target = findyBillboardByName(name, cacheData);
  const { billboard: { billControler }, station } = target

  // 关闭上一次的弹窗
  if (lastFocusStation) {
    const { billControler } = lastFocusStation
    billControler.removeQueryPopup()
  }

  if (station && billControler) {
    const { bottomCircleEntity } = station
    // 飞到站点的圆环位置
    viewer.flyTo(bottomCircleEntity, {
      offset: new Cesium.HeadingPitchRange(
        Cesium.Math.toRadians(40),
        Cesium.Math.toRadians(-40),
        5000
      )
    });
    // 显示查询弹窗
    billControler.showQueryPopup()
    lastFocusStation = target.billboard
  }
}

/**
 * 通过站线名称飞到站线质心点
 *
 * @param {Cesium.Viewer} viewer
 * @param {string} lineName - 线路名称
 * @param {Array} linesData - 可选，自定义线路数据源（默认使用全局缓存 lines）
 */
export const flyToLineCenter = (viewer, lineName, linesData) => {
  let lineEnt
  let dataSource = linesData ? linesData : lines
  lineEnt = dataSource.find(item => item.name === lineName)
  viewer.flyTo(lineEnt, {
    offset: new Cesium.HeadingPitchRange(
      Cesium.Math.toRadians(40),
      Cesium.Math.toRadians(-40),
      20000
    )
  })
}

// ============================================
// 热力图渲染（站点拥挤度）
//
// 使用 cesiumHeatMap 插件在地球表面叠加热力图
// ============================================

/**
 * 渲染站点拥挤度热力图
 *
 * @param {Cesium.Viewer} viewer
 * @param {Array<{x: number, y: number, value: number}>} dataSource
 *   - x: 经度
 *   - y: 纬度
 *   - value: 拥挤度值（越高越红）
 * @returns {Function} destroyHeat - 清除热力图的函数
 */
export const renderHeat = (viewer, dataSource) => {
  // 将热力图数据存到 localStorage（备用）
  window.localStorage.setItem('heatMapData', JSON.stringify(dataSource))

  const CesiumHeat = getCesiumHeat(Cesium);
  let heat = new CesiumHeat(
    viewer,
    {
      autoMaxMin: true,  // 自动计算最大最小值（决定颜色映射范围）
      data: dataSource,  // 数据数组，每个包含 x(经度), y(纬度), value(热力值)
    },
    // 热力图边界范围（武汉市区）：限定在此范围内显示，避免全球都有模糊热力点
    [114.03, 30.2, 114.45, 30.9]
  );

  const destroyHeat = () => {
    heat.destory();
  };
  return destroyHeat;  // 返回清除函数
};

// ============================================
// 鼠标事件注册
//
// 支持左键点击和右键点击
// 使用 Cesium.ScreenSpaceEventHandler 处理屏幕空间事件
// ============================================

/**
 * 注册 Cesium 鼠标点击事件
 *
 * @param {Cesium.Viewer} viewer
 * @param {string} type - "leftClick" | "rightClick"
 * @param {Function} clickCallBack - 回调函数，参数为事件对象 e
 * @returns {Cesium.ScreenSpaceEventHandler} handler 实例（用于后续注销）
 */
export const registerMouseEvent = (viewer, type, clickCallBack) => {
  viewer._element.style.cursor = "pointer";  // 鼠标变为手型
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

  switch (type) {
    case "leftClick":
      handler.setInputAction((e) => {
        clickCallBack && clickCallBack(e);
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      break;

    case "rightClick":
      handler.setInputAction((e) => {
        clickCallBack && clickCallBack(e);
      }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
      break;

    default:
      break;
  }

  return handler;
};
