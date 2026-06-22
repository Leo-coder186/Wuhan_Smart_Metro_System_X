/**
 * @Description: 地铁线路相关 API 接口
 *
 * 接口列表：
 *   - getLine():       获取地铁线路数据（线路坐标、站点信息）
 *   - getLinePlan():   路径规划（起点→终点换乘方案）
 *   - getStationInfo(): 站点详细信息查询
 *   - getWeather():    天气数据（使用高德地图天气 API）
 *
 * 坐标转换说明：
 *   后端返回的是 GCJ-02（火星坐标系）坐标，
 *   需要在 Cesium 中使用 WGS-84 坐标，
 *   因此通过 CoordTransform.GCJ02ToWGS84() 进行转换
 *
 * @Date: 2024-05-09
 */

import api from "./request";
import { lineColors } from "@/store/staticData";
import { CoordTransform } from '@/cesiumTools/mapPlugin.js'

/**
 * 获取所有地铁线路数据
 * 数据处理步骤：
 *   1. 从后端获取原始线路坐标（xs: 经度字符串, ys: 纬度字符串）
 *   2. 坐标从 GCJ-02（火星坐标系）转为 WGS-84（GPS坐标）
 *   3. 合并为 paths 数组 [{lng, lat}, ...]
 *   4. 为每条线路分配颜色
 *   5. 处理站点列表的坐标
 *
 * @param {Object} params - 查询参数（可选）
 * @returns {Array} 线路数据数组 [{id, name, color, checked, paths, stationsList}]
 */
export const getLine = async (params) => {
  try {
    const { data, code } = await api.get(`/getLine`, { params });
    if (code === 200) {
      // 对每条线路的数据进行加工处理
      const result = data.map((item, index) => {
        const { xs, ys, stationsList } = item;

        // 按顺序分配颜色（循环使用 lineColors 数组）
        const colorIndex = index % lineColors.length;
        const color = lineColors[colorIndex];
        item.color = color;
        item.checked = true;  // 默认显示

        // 解析坐标字符串（逗号分隔的经纬度字符串）
        const xpos = xs.split(",").map((item) => parseFloat(item));  // 经度数组
        const ypos = ys.split(",").map((item) => parseFloat(item));  // 纬度数组

        // 转换为 WGS-84 坐标并合并为路径数组
        let positions = [];
        if (xpos.length === ypos.length) {
          xpos.forEach((item, index) => {
            // GCJ-02 → WGS-84 坐标转换
            const [lng, lat] = CoordTransform.GCJ02ToWGS84(
              item,
              ypos[index]
            );
            positions.push({ lng, lat });
          });
        }
        item.paths = positions;

        // 处理站点列表：转换每个站点的坐标
        if (stationsList.length) {
          item.stationsList = stationsList.map(station => {
            const { xy_coords, ...rest } = station
            // 站点坐标格式："经度;纬度"
            const [lng, lat] = xy_coords.split(";").map(item => Number(item))
            // GCJ-02 → WGS-84
            const [lngWgs84, latWgs84] = CoordTransform.GCJ02ToWGS84(lng, lat);
            return { position: { lng: lngWgs84, lat: latWgs84 }, ...rest }
          })
        }

        return item;
      });
      return result;
    } else {
      return [];
    }
  } catch (error) {
    console.log(error);
  }
};

/**
 * 路径规划 API - 获取起点到终点的换乘方案
 * @param {Object} params - { origin: "lng,lat", destination: "lng,lat" }
 * @returns {Object} { code, data: { distance, segments } }
 */
export const getLinePlan = (params) => api.get(`/getLinePlan`, { params });

/**
 * 站点详细信息查询
 * @param {Object} params - 查询参数
 * @returns {Object} 站点详细信息
 */
export const getStationInfo = (params) =>
  api.get(`/getStationInfo`, { params });

/**
 * 获取实时天气数据 - 使用高德地图天气 API
 * 接口地址：https://restapi.amap.com/v3/weather/weatherInfo
 *
 * @returns {Object|null} 天气数据 { lives: [{ weather, temperature }] }
 *                       请求失败返回 null，不阻塞后续流程
 */
export const getWeather = async () => {
  try {
    const params = {
      key: '934bdde4c3d4738b0abd16bdffd0b8f7',  // 高德 API Key
      city: '420100'                              // 武汉市行政区划代码
    }

    // 直接调用高德 API（不走后端代理）
    const data = await api.get('https://restapi.amap.com/v3/weather/weatherInfo', { params })
    return data
  } catch (error) {
    console.warn('天气API请求失败，跳过:', error?.message || error);
    return null;  // 非阻塞：天气数据获取失败不影响主功能
  }
}
