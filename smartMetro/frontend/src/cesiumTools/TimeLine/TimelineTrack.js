/*
 * @Description: 
 * @Author: your name
 * @version: 
 * @Date: 2024-11-07 14:34:44
 * @LastEditors: your name
 * @LastEditTime: 2024-11-07 14:35:59
 */
import * as Cesium from 'cesium'

/**
 * @private
 */
function TimelineTrack(interval, pixelHeight, color, backgroundColor) {
  this.interval = interval;
  this.height = pixelHeight;
  this.color = color || new Cesium.Color(0.5, 0.5, 0.5, 1.0);
  this.backgroundColor = backgroundColor || new Cesium.Color(0.0, 0.0, 0.0, 0.0);
}

TimelineTrack.prototype.render = function (context, renderState) {
  const startInterval = this.interval.start;
  const stopInterval = this.interval.stop;

  const spanStart = renderState.startJulian;
  const spanStop = Cesium.JulianDate.addSeconds(
    renderState.startJulian,
    renderState.duration,
    new Cesium.JulianDate()
  );

  if (
    Cesium.JulianDate.lessThan(startInterval, spanStart) &&
    Cesium.JulianDate.greaterThan(stopInterval, spanStop)
  ) {
    //The track takes up the entire visible span.
    context.fillStyle = this.color.toCssColorString();
    context.fillRect(0, renderState.y, renderState.timeBarWidth, this.height);
  } else if (
    Cesium.JulianDate.lessThanOrEquals(startInterval, spanStop) &&
    Cesium.JulianDate.greaterThanOrEquals(stopInterval, spanStart)
  ) {
    //The track only takes up some of the visible span, compute that span.
    let x;
    let start, stop;
    for (x = 0; x < renderState.timeBarWidth; ++x) {
      const currentTime = Cesium.JulianDate.addSeconds(
        renderState.startJulian,
        (x / renderState.timeBarWidth) * renderState.duration,
        new Cesium.JulianDate()
      );
      if (
        !Cesium.defined(start) &&
        Cesium.JulianDate.greaterThanOrEquals(currentTime, startInterval)
      ) {
        start = x;
      } else if (
        !Cesium.defined(stop) &&
        Cesium.JulianDate.greaterThanOrEquals(currentTime, stopInterval)
      ) {
        stop = x;
      }
    }

    context.fillStyle = this.backgroundColor.toCssColorString();
    context.fillRect(0, renderState.y, renderState.timeBarWidth, this.height);

    if (Cesium.defined(start)) {
      if (!Cesium.defined(stop)) {
        stop = renderState.timeBarWidth;
      }
      context.fillStyle = this.color.toCssColorString();
      context.fillRect(
        start,
        renderState.y,
        Math.max(stop - start, 1),
        this.height
      );
    }
  }
};
export default TimelineTrack;
