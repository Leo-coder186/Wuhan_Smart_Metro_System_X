/**
 * @Description: Cesium 核心工具函数 - 坐标转换 + 几何计算
 *
 * 功能集合：
 *   1. 坐标转换：笛卡尔坐标 ↔ 经纬度、二维点 → 三维点
 *   2. 几何计算：生成圆形边缘坐标、计算路径距离和时间
 *   3. 数据处理：展平坐标数组、格式化路径坐标
 *
 * 使用场景：
 *   - sceneManager.js: 水面坐标转换、路径坐标处理
 *   - CurrentRoute.vue: 列车路径时间计算
 *   - effectController.js: 圆柱体圆形边缘生成
 *
 * @Date: 2024-05-15
 */
import * as Cesium from "cesium";

/**
 * 将 Cesium 笛卡尔坐标（世界坐标）转为经纬度和高度
 *
 * @param {Cesium.Cartesian3} position - 世界空间中的 3D 坐标
 * @returns {[number, number, number]} [经度(度), 纬度(度), 高度(米)]
 */
export function cartesian3ToDegreesHeight(position) {
  let c = Cesium.Cartographic.fromCartesian(position);
  return [
    Cesium.Math.toDegrees(c.longitude),
    Cesium.Math.toDegrees(c.latitude),
    c.height,
  ];
}

/**
 * 生成一个圆形边缘的坐标点数组
 * 用于创建圆柱体/圆锥体的底面轮廓
 *
 * @param {[number, number]} center - 圆心经纬度 [lng, lat]
 * @param {number} radius - 半径（米）
 * @returns {Array<[number, number]>} 圆周上的坐标点数组（每2度一个点）
 */
export const generateCirclePoints = (center, radius) => {
  let points = [];
  for (let i = 0; i <= 360; i += 2) {
    points.push(getCirclePoint(center[0], center[1], i, radius));
  }
  return points;
};

/**
 * 根据圆心、角度和半径计算圆周上某一点的经纬度
 *
 * 原理：
 *   1. 在地球椭球面上将半径分解为经度方向和纬度方向的偏移量
 *   2. 考虑了地球的椭球形状（赤道半径 6378137m，极半径 6356725m）
 *   3. ec = 该纬度处的椭球曲率半径（南北方向）
 *   4. ed = ec * cos(lat)（东西方向的等效半径）
 *
 * @param {number} lon - 圆心经度（度）
 * @param {number} lat - 圆心纬度（度）
 * @param {number} angle - 角度（度，从正北顺时针）
 * @param {number} radius - 半径（米）
 * @returns {[number, number]} 圆周上该点的经纬度 [lng, lat]
 */
const getCirclePoint = (lon, lat, angle, radius) => {
  // 经度方向的偏移（米）
  let dx = radius * Math.sin((angle * Math.PI) / 180.0);
  // 纬度方向的偏移（米）
  let dy = radius * Math.cos((angle * Math.PI) / 180.0);

  // 该纬度处的地球曲率半径（考虑地球椭球形状）
  let ec = 6356725 + ((6378137 - 6356725) * (90.0 - lat)) / 90.0;
  // 东西方向等效半径 = ec * cos(纬度)
  let ed = ec * Math.cos((lat * Math.PI) / 180);

  // 将米转为经纬度偏移
  let newLon = ((dx / ed + (lon * Math.PI) / 180.0) * 180.0) / Math.PI;
  let newLat = ((dy / ec + (lat * Math.PI) / 180.0) * 180.0) / Math.PI;

  return [newLon, newLat];
};

/**
 * 二维经纬度点数组 → 三维笛卡尔坐标数组
 * 用于将圆弧上的经纬度点转为 Cesium 可用坐标
 *
 * @param {Array<[number, number]>} points - 经纬度点数组 [[lng, lat], ...]
 * @param {number} height - 统一高度（米）
 * @returns {Array<Cesium.Cartesian3>}
 */
export const pointsToPositions = (points, height) => {
  let positions = [];
  points.map((item) => {
    positions.push(Cesium.Cartesian3.fromDegrees(item[0], item[1], height));
  });
  return positions;
};

/**
 * 将 [{lng, lat}] 格式的路径展平为一维数组 [lng, lat, lng, lat, ...]
 * 用于 Cesium.Cartesian3.fromDegreesArray() 的输入
 *
 * @param {Array<{lng: number, lat: number}>} paths
 * @returns {number[]} [lng1, lat1, lng2, lat2, ...]
 */
export const flattenPositions = (paths) => {
  const result = [];
  paths.forEach((path) => {
    result.push(path.lng, path.lat);
  });
  return result;
};

/**
 * 将 [{lng, lat}] 格式的路径转为 Cartesian3 数组
 *
 * @param {Array<{lng: number, lat: number}>} paths
 * @param {number} defaultHeight - 默认高度（米，默认 0）
 * @returns {Array<Cesium.Cartesian3>}
 */
export const getPositions = (paths, defaultHeight = 0) => {
  return paths.map(path => {
    const { lng, lat } = path
    return Cesium.Cartesian3.fromDegrees(lng, lat, defaultHeight)
  })
};

/**
 * 计算路径上每个点位的到达时间和总时间
 *
 * 用于列车轨迹动画中，根据速度和路径计算每个采样点的时间偏移
 *
 * @param {Array<Cesium.Cartesian3>} pArr - 路径点数组（3D坐标）
 * @param {number} speed - 速度（米/秒）
 * @returns {{ timeSum: number, siteTimes: number[] }}
 *   - timeSum: 总时间（秒）
 *   - siteTimes: 到达每个点的时间（秒，第0个点为0）
 */
export const getSiteTimes = (pArr, speed) => {
  let timeSum = 0;          // 累计总时间
  let times = [];           // 每个点的时间

  for (var i = 0; i < pArr.length; i++) {
    if (i == 0) {
      times.push(0);        // 起点时间为 0
      continue;
    }

    // 计算当前段距离开销的时间：距离 / 速度
    timeSum += spaceDistance([pArr[i - 1], pArr[i]]) / speed;
    times.push(timeSum);
  }

  return {
    timeSum: timeSum,
    siteTimes: times,
  };
};

/**
 * 计算路径总距离（所有相邻点距离之和）
 *
 * @param {Array<Cesium.Cartesian3>} positions - 路径点数组
 * @returns {string} 距离字符串（保留2位小数）
 */
export const spaceDistance = (positions) => {
  let distance = 0;
  for (let i = 0; i < positions.length - 1; i++) {
    // Cesium 内置的笛卡尔空间距离计算
    let s = Cesium.Cartesian3.distance(positions[i], positions[i + 1])
    distance = distance + s;
  }
  return distance.toFixed(2);
};
