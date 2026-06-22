/**
 * @Description: Cesium 地图插件 - 自定义底图影像提供器 + 坐标转换工具
 *
 * 包含：
 *   1. CoordTransform: 中国常用坐标系互转（WGS84 ↔ GCJ02 ↔ BD09）
 *   2. TencentImageryProvider: 腾讯地图瓦片服务适配器
 *   3. GoogleImageryProvider: Google 地图瓦片服务适配器
 *
 * 背景知识（中国地图坐标系）：
 *   - WGS-84: 国际标准 GPS 坐标（Cesium 内部使用）
 *   - GCJ-02: 中国国测局坐标系（"火星坐标系"），国内互联网地图必须使用
 *   - BD-09: 百度坐标系，在 GCJ-02 基础上再次加密
 *
 * 适配原理：
 *   Cesium 使用 WGS-84 投影，而腾讯/Google 中国地图使用 GCJ-02 偏移。
 *   通过 GCJMercatorTilingScheme 在 Cesium 的投影环节注入坐标偏移，
 *   使地图瓦片与 Cesium 的 WGS-84 位置正确对齐。
 *
 * @Date: 2024-02-06
 */
import * as Cesium from "cesium";

// ============================================
// 坐标转换常量
// ============================================
const BD_FACTOR = (3.14159265358979324 * 3000.0) / 180.0;  // 百度坐标转换因子
const PI = 3.1415926535897932384626;                        // 圆周率
const RADIUS = 6378245.0;                                   // 地球椭球半径（米）
const EE = 0.00669342162296594323;                          // 椭球偏心率平方

/**
 * 坐标转换工具类 - 静态方法，无需实例化
 *
 * 主要使用 GCJ02ToWGS84() 方法：
 *   后端返回的线路/站点坐标是 GCJ-02（高德/腾讯地图坐标系）
 *   Cesium 需要 WGS-84 坐标才能正确显示
 */
class CoordTransform {
  /**
   * BD-09（百度坐标）→ GCJ-02（火星坐标）
   * @param {number} lng - 百度经度
   * @param {number} lat - 百度纬度
   * @returns {[number, number]} [GCJ-02经度, GCJ-02纬度]
   */
  static BD09ToGCJ02(lng, lat) {
    let x = +lng - 0.0065;
    let y = +lat - 0.006;
    let z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * BD_FACTOR);
    let theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * BD_FACTOR);
    let gg_lng = z * Math.cos(theta);
    let gg_lat = z * Math.sin(theta);
    return [gg_lng, gg_lat];
  }

  /**
   * GCJ-02（火星坐标）→ BD-09（百度坐标）
   */
  static GCJ02ToBD09(lng, lat) {
    lat = +lat;
    lng = +lng;
    let z = Math.sqrt(lng * lng + lat * lat) + 0.00002 * Math.sin(lat * BD_FACTOR);
    let theta = Math.atan2(lat, lng) + 0.000003 * Math.cos(lng * BD_FACTOR);
    let bd_lng = z * Math.cos(theta) + 0.0065;
    let bd_lat = z * Math.sin(theta) + 0.006;
    return [bd_lng, bd_lat];
  }

  /**
   * WGS-84 → GCJ-02（GPS坐标 → 火星坐标）
   * 用于将 Cesium 中的坐标转换后请求国内地图服务
   */
  static WGS84ToGCJ02(lng, lat) {
    lat = +lat;
    lng = +lng;
    if (this.out_of_china(lng, lat)) {
      return [lng, lat];  // 在中国境外不转换
    } else {
      let d = this.delta(lng, lat);  // 计算偏移量
      return [lng + d[0], lat + d[1]];
    }
  }

  /**
   * GCJ-02 → WGS-84（火星坐标 → GPS坐标）
   * **这是项目中最常用的方法**
   *
   * 原理：利用偏移量反向计算
   *   WGS84 = GCJ02 - delta(GCJ02) ≈ 2 * GCJ02 - (GCJ02 + delta(GCJ02))
   */
  static GCJ02ToWGS84(lng, lat) {
    lat = +lat;
    lng = +lng;
    if (this.out_of_china(lng, lat)) {
      return [lng, lat];
    } else {
      let d = this.delta(lng, lat);
      let mgLng = lng + d[0];   // 这个点的 WGS84 → GCJ02 的结果
      let mgLat = lat + d[1];
      // 反向公式：WGS84 ≈ 2*GCJ02 - (GCJ02 + delta)
      return [lng * 2 - mgLng, lat * 2 - mgLat];
    }
  }

  /**
   * 计算坐标偏移量（核心算法）
   *
   * 这是中国国家测绘局定义的坐标加密算法，
   * 使用多项式 + 正弦函数在经纬度上叠加非线性偏移
   *
   * @returns {[number, number]} [经度偏移, 纬度偏移]
   */
  static delta(lng, lat) {
    let dLng = this.transformLng(lng - 105, lat - 35);
    let dLat = this.transformLat(lng - 105, lat - 35);
    const radLat = (lat / 180) * PI;
    let magic = Math.sin(radLat);
    magic = 1 - EE * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    dLng = (dLng * 180) / ((RADIUS / sqrtMagic) * Math.cos(radLat) * PI);
    dLat = (dLat * 180) / (((RADIUS * (1 - EE)) / (magic * sqrtMagic)) * PI);
    return [dLng, dLat];
  }

  /** 经度偏移计算函数 */
  static transformLng(lng, lat) {
    lat = +lat;
    lng = +lng;
    let ret = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
    ret += ((20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0) / 3.0;
    ret += ((20.0 * Math.sin(lng * PI) + 40.0 * Math.sin((lng / 3.0) * PI)) * 2.0) / 3.0;
    ret += ((150.0 * Math.sin((lng / 12.0) * PI) + 300.0 * Math.sin((lng / 30.0) * PI)) * 2.0) / 3.0;
    return ret;
  }

  /** 纬度偏移计算函数 */
  static transformLat(lng, lat) {
    lat = +lat;
    lng = +lng;
    let ret = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
    ret += ((20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0) / 3.0;
    ret += ((20.0 * Math.sin(lat * PI) + 40.0 * Math.sin((lat / 3.0) * PI)) * 2.0) / 3.0;
    ret += ((160.0 * Math.sin((lat / 12.0) * PI) + 320 * Math.sin((lat * PI) / 30.0)) * 2.0) / 3.0;
    return ret;
  }

  /**
   * 判断坐标是否在中国境外
   * 境外坐标不需要进行 GCJ-02 转换
   */
  static out_of_china(lng, lat) {
    lat = +lat;
    lng = +lng;
    return !(lng > 73.66 && lng < 135.05 && lat > 3.86 && lat < 53.55);
  }
}

// ============================================
// 火星坐标投影方案（GCJ Mercator Tiling Scheme）
//
// 核心思路：在 Cesium 的 WebMercator 投影中注入 GCJ-02 偏移
//   project:   WGS84 → 投影坐标 的中间插入 WGS84 → GCJ02
//   unproject: 投影坐标 → WGS84 的中间插入 GCJ02 → WGS84
//
// 效果：Cesium 按 WGS-84 请求瓦片，但腾讯/Google 服务器返回的是 GCJ-02 瓦片，
//       通过投影注入偏移，让两者在地理位置上正确对齐。
// ============================================

class GCJMercatorTilingScheme extends Cesium.WebMercatorTilingScheme {
  constructor(options) {
    super(options);
    let projection = new Cesium.WebMercatorProjection();

    // 重写 project：WGS84 经纬度 → 瓦片投影坐标
    this._projection.project = function (cartographic, result) {
      // 1. WGS-84 → GCJ-02
      result = CoordTransform.WGS84ToGCJ02(
        Cesium.Math.toDegrees(cartographic.longitude),
        Cesium.Math.toDegrees(cartographic.latitude)
      );
      // 2. GCJ-02 → WebMercator 投影坐标
      result = projection.project(
        new Cesium.Cartographic(
          Cesium.Math.toRadians(result[0]),
          Cesium.Math.toRadians(result[1])
        )
      );
      return new Cesium.Cartesian2(result.x, result.y);
    };

    // 重写 unproject：瓦片投影坐标 → WGS84 经纬度
    this._projection.unproject = function (cartesian, result) {
      // 1. WebMercator 投影坐标 → GCJ-02 经纬度
      let cartographic = projection.unproject(cartesian);
      // 2. GCJ-02 → WGS-84
      result = CoordTransform.GCJ02ToWGS84(
        Cesium.Math.toDegrees(cartographic.longitude),
        Cesium.Math.toDegrees(cartographic.latitude)
      );
      return new Cesium.Cartographic(
        Cesium.Math.toRadians(result[0]),
        Cesium.Math.toRadians(result[1])
      );
    };
  }
}

// ============================================
// 腾讯地图瓦片 URL 模板
// ============================================
const IMG_URL =
  "https://p{s}.map.gtimg.com/sateTiles/{z}/{sx}/{sy}/{x}_{reverseY}.jpg?version=400&key=d84d6d83e0e51e481e50454ccbe8986b";

const ELEC_URL =
  "https://rt{s}.map.gtimg.com/tile?z={z}&x={x}&y={reverseY}&styleid={style}&scene=0&version=347&key=d84d6d83e0e51e481e50454ccbe8986b";

/**
 * 腾讯地图影像提供器
 *
 * 支持 style 参数：
 *   - 'img': 卫星影像
 *   - 其他/数字: 电子地图（矢量地图/路网）
 *
 * 自动使用 GCJMercatorTilingScheme 进行坐标适配
 */
class TencentImageryProvider extends Cesium.UrlTemplateImageryProvider {
  constructor(options = {}) {
    let url = options.style === "img" ? IMG_URL : ELEC_URL;
    options["url"] = url.replace("{style}", options.style || 1);

    if (!options.subdomains || !options.subdomains.length) {
      options["subdomains"] = ["0", "1", "2"];  // 多子域名加速
    }

    if (options.style === "img") {
      // 卫星影像的特殊瓦片编号计算
      options["customTags"] = {
        sx: (imageryProvider, x, y, level) => {
          return x >> 4;  // 等价于 Math.floor(x / 16)
        },
        sy: (imageryProvider, x, y, level) => {
          return ((1 << level) - y) >> 4;
        },
      };
    }

    // 默认使用 WGS84 → 自动应用 GCJ 偏移投影
    options.crs = options.crs || "WGS84";
    if (options.crs === "WGS84") {
      options["tilingScheme"] = new GCJMercatorTilingScheme(options);
    }

    super(options);
  }
}

// ============================================
// Google 地图瓦片 URL 模板
// ============================================
const TILE_URL = {
  img: 'https://gac-geo.googlecnapps.cn/maps/vt?lyrs=s&x={x}&y={y}&z={z}',       // 卫星图
  elec: 'https://gac-geo.googlecnapps.cn/maps/vt?lyrs=m&x={x}&y={y}&z={z}',      // 电子地图
  cva: 'https://gac-geo.googlecnapps.cn/maps/vt?lyrs=h&x={x}&y={y}&z={z}',       // 等高线
  ter: 'https://gac-geo.googlecnapps.cn/maps/vt?lyrs=t@131,r&x={x}&y={y}&z={z}', // 地形
  img_cva: 'https://gac-geo.googlecnapps.cn/maps/vt?lyrs=y&x={x}&y={y}&z={z}',   // 卫星+等高线混合
}

/**
 * Google 地图影像提供器
 * 默认使用电子地图（elec）
 * 支持 crs='GCJ02' 进行火星坐标适配
 */
class GoogleImageryProvider extends Cesium.UrlTemplateImageryProvider {
  constructor(options = {}) {
    options['url'] =
      options.url ||
      [options.protocol || '', TILE_URL[options.style] || TILE_URL['elec']].join('')

    // 如果指定了 GCJ02 投影 → 使用火星坐标瓦片方案
    if (options.crs === 'GCJ02') {
      options['tilingScheme'] = new GCJMercatorTilingScheme()
    }

    super(options)
  }
}

export {
  CoordTransform,
  TencentImageryProvider,
  GoogleImageryProvider
};
