/*
 * @Description: 
 * @Author: your name
 * @version: 
 * @Date: 2024-11-07 14:33:15
 * @LastEditors: your name
 * @LastEditTime: 2024-11-07 14:34:22
 */
import * as Cesium from 'cesium'
/**
 * @private
 */
function TimelineHighlightRange(color, heightInPx, base) {
  this._color = color;
  this._height = heightInPx;
  this._base = Cesium.defaultValue(base, 0);
}

TimelineHighlightRange.prototype.getHeight = function () {
  return this._height;
};

TimelineHighlightRange.prototype.getBase = function () {
  return this._base;
};

TimelineHighlightRange.prototype.getStartTime = function () {
  return this._start;
};

TimelineHighlightRange.prototype.getStopTime = function () {
  return this._stop;
};

TimelineHighlightRange.prototype.setRange = function (start, stop) {
  this._start = start;
  this._stop = stop;
};

TimelineHighlightRange.prototype.render = function (renderState) {
  let range = "";
  if (this._start && this._stop && this._color) {
    const highlightStart = Cesium.JulianDate.secondsDifference(
      this._start,
      renderState.epochJulian
    );
    let highlightLeft = Math.round(
      renderState.timeBarWidth * renderState.getAlpha(highlightStart)
    );
    const highlightStop = Cesium.JulianDate.secondsDifference(
      this._stop,
      renderState.epochJulian
    );
    let highlightWidth =
      Math.round(
        renderState.timeBarWidth * renderState.getAlpha(highlightStop)
      ) - highlightLeft;
    if (highlightLeft < 0) {
      highlightWidth += highlightLeft;
      highlightLeft = 0;
    }
    if (highlightLeft + highlightWidth > renderState.timeBarWidth) {
      highlightWidth = renderState.timeBarWidth - highlightLeft;
    }
    if (highlightWidth > 0) {
      range = `<span class="cesium-timeline-highlight" style="left: ${highlightLeft.toString()}px; width: ${highlightWidth.toString()}px; bottom: ${this._base.toString()}px; height: ${
        this._height
      }px; background-color: ${this._color};"></span>`;
    }
  }
  return range;
};
export default TimelineHighlightRange;
