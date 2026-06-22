/**
 * @Description: 工具栏功能函数 - 全屏切换相关
 *
 * 函数列表：
 *   - fullScreen(element):   进入全屏模式
 *   - cancelFullscreen():    退出全屏模式
 *
 * 兼容性：覆盖标准 API + 各浏览器私有前缀
 *   - requestFullscreen:      标准 W3C API
 *   - mozRequestFullScreen:   Firefox
 *   - msRequestFullscreen:    IE/Edge
 *   - webkitRequestFullscreen: Chrome/Safari
 * @Date: 2024-05-10
 */

/**
 * 进入全屏模式
 * @param {HTMLElement} element - 要全屏显示的 DOM 元素
 * @returns {Promise} 全屏请求的结果
 */
export const fullScreen = (element) => {
  // Firefox 特殊处理：检测是否禁用了全屏模式
  if (document.mozFullScreenEnabled) {
    return Promise.reject(new Error("全屏模式被禁用"));
  }

  let result = null;
  // 按优先级尝试不同浏览器的全屏 API
  if (element.requestFullscreen) {
    result = element.requestFullscreen();          // W3C 标准
  } else if (element.mozRequestFullScreen) {
    result = element.mozRequestFullScreen();        // Firefox
  } else if (element.msRequestFullscreen) {
    result = element.msRequestFullscreen();         // IE/Edge
  } else if (element.webkitRequestFullscreen) {
    result = element.webkitRequestFullScreen();     // Chrome/Safari
  }

  // 如果所有 API 都不存在，返回 rejected Promise
  return result || Promise.reject(new Error("不支持全屏"));
};

/**
 * 退出全屏模式
 */
export const cancelFullscreen = () => {
  if (document.exitFullscreen) {
    document.exitFullscreen();          // W3C 标准
  } else if (document.msExitFullscreen) {
    document.msExitFullscreen();        // IE/Edge
  } else if (document.mozCancelFullScreen) {
    document.mozCancelFullScreen();     // Firefox
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();    // Chrome/Safari
  }
};
