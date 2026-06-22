/**
 * @Description: Video.js FLV 流媒体支持插件
 *
 * 将 flv.js 集成到 Video.js 中，使 Video.js 播放器能够播放 FLV 格式的直播流。
 * FLV 是 RTMP 直播常用的格式，通过 HTTP-FLV 方式传输。
 *
 * 工作原理：
 *   1. 继承 Video.js 的 Html5 Tech
 *   2. 重写 setSrc() → 使用 flvjs.createPlayer() 创建 FLV 播放器
 *   3. 将 flv.js 播放器附加到 video 元素上
 *   4. 注册支持 'video/flv' 和 'video/x-flv' MIME 类型
 *
 * 使用方式：
 *   Video.js 的 techOrder 配置中包含 'flvjs' 即可自动启用
 *
 * 参考：
 *   https://github.com/mister-ben/videojs-flvjs
 *   https://github.com/videojs/videojs-youtube
 *
 * @Date: 2024-05-10
 */

import videojs from 'video.js'

// 获取 Video.js 内置的 HTML5 技术基础类
const Html5 = videojs.getTech('Html5')

/**
 * FLV 技术类 - 在 Video.js 中支持 FLV 格式播放
 */
export class FlvJsTech extends Html5 {
  /** flv.js 播放器实例 */
  flvPlayer = null

  constructor(options, ready) {
    super(options, ready)
  }

  /**
   * 设置视频源并开始播放
   * 核心方法：创建 flv.js 播放器实例并附加到 video 元素
   */
  setSrc(src) {
    // 如果已有播放器实例，先销毁
    this.flvPlayer?.detachMediaElement()
    this.flvPlayer?.destroy()

    // 创建新的 flv.js 播放器（type: 'flv'）
    this.flvPlayer = flvjs.createPlayer({ url: src, type: 'flv' }, this.options_)
    // 附加到 HTML5 video 元素上
    this.flvPlayer.attachMediaElement(this.el_)
    // 开始加载
    this.flvPlayer.load()
  }

  /** 销毁：清理 flv.js 播放器实例 */
  dispose() {
    this.flvPlayer?.detachMediaElement()
    this.flvPlayer?.destroy()
    super.dispose()
  }

  /** 支持的 MIME 类型映射 */
  static formats = {
    'video/flv': 'FLV',
    'video/x-flv': 'FLV'
  }

  /** 检查浏览器是否支持 FLV 播放 */
  static isSupported = function () {
    return flvjs.isSupported()
  }

  /** 判断是否能播放指定的 MIME 类型 */
  static canPlayType = function (type) {
    return FlvJsTech.isSupported() && type in FlvJsTech.formats ? 'maybe' : ''
  }

  /** 判断是否能播放指定的视频源 */
  static canPlaySource = function (source) {
    return FlvJsTech.isSupported() && source.src.endsWith('.flv') ? 'maybe' : ''
  }
}
