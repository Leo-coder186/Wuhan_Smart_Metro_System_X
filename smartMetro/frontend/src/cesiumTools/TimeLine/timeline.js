/**
 * @Description: 自定义 Cesium 时间轴控件
 *
 * 为什么要自定义：
 *   Cesium 默认时间轴在底部，与项目的底部导航栏重叠。
 *   自定义时间轴位置在屏幕右上方（通过 CSS .cesium-viewer-timelineContainer 定位），
 *   专门用于列车轨迹动画的时间播放控制。
 *
 * 功能：
 *   1. 可视化时间范围导览
 *   2. 支持鼠标拖拽调整时间刻度
 *   3. 支持鼠标滚轮缩放时间范围
 *   4. 高亮当前播放时间位置
 *   5. 触发 "settime" 事件通知外部（用于列车轨迹暂停/跳转）
 *
 * 组件组成：
 *   - TimelineTrack: 时间轨道（主时间标尺）
 *   - TimelineHighlightRange: 高亮时间范围覆盖层
 *
 * 使用：
 *   sceneManager.resetTimeLine() 创建并绑定到 viewer
 *
 * @Date: 2024-05-08
 */
import * as Cesium from 'cesium'
import TimelineHighlightRange from "./TimelineHighlightRange.js";
import TimelineTrack from "./TimelineTrack.js";

function getElement(element) {
    if (typeof element === "string") {
      const foundElement = document.getElementById(element);

      //>>includeStart('debug', pragmas.debug);
      if (foundElement === null) {
        throw new Cesium.DeveloperError(
          `Element with id "${element}" does not exist in the document.`
        );
      }
      //>>includeEnd('debug');

      element = foundElement;
    }
    return element;
}

let timelineWheelDelta = 1e12;

const timelineMouseMode = {
  none: 0,
  scrub: 1,
  slide: 2,
  zoom: 3,
  touchOnly: 4,
};
const timelineTouchMode = {
  none: 0,
  scrub: 1,
  slideZoom: 2,
  singleTap: 3,
  ignore: 4,
};

const timelineTicScales = [
  0.001,
  0.002,
  0.005,
  0.01,
  0.02,
  0.05,
  0.1,
  0.25,
  0.5,
  1.0,
  2.0,
  5.0,
  10.0,
  15.0,
  30.0,
  60.0, // 1min
  120.0, // 2min
  300.0, // 5min
  600.0, // 10min
  900.0, // 15min
  1800.0, // 30min
  3600.0, // 1hr
  7200.0, // 2hr
  14400.0, // 4hr
  21600.0, // 6hr
  43200.0, // 12hr
  86400.0, // 24hr
  172800.0, // 2days
  345600.0, // 4days
  604800.0, // 7days
  1296000.0, // 15days
  2592000.0, // 30days
  5184000.0, // 60days
  7776000.0, // 90days
  15552000.0, // 180days
  31536000.0, // 365days
  63072000.0, // 2years
  126144000.0, // 4years
  157680000.0, // 5years
  315360000.0, // 10years
  630720000.0, // 20years
  1261440000.0, // 40years
  1576800000.0, // 50years
  3153600000.0, // 100years
  6307200000.0, // 200years
  12614400000.0, // 400years
  15768000000.0, // 500years
  31536000000.0, // 1000years
];

const timelineMonthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * The Timeline is a widget for displaying and controlling the current scene time.
 * @alias Timeline
 * @constructor
 * @param {Cesium.Viewer} viewer
 * @param {Element} container The parent HTML container node for this widget.
 * @param {Cesium.Clock} clock The clock to use.
 */
function Timeline(viewer, container, clock) {
  //>>includeStart('debug', pragmas.debug);
  if (!Cesium.defined(container)) {
    throw new Cesium.DeveloperError("container is required.");
  }
  if (!Cesium.defined(clock)) {
    throw new Cesium.DeveloperError("clock is required.");
  }
  //>>includeEnd('debug');

  container = getElement(container);

  const ownerDocument = container.ownerDocument;
  // 传一个 viewer，用来控制是否暂停动画
  this.viewer = viewer

  this.container = container;

  const topDiv = ownerDocument.createElement("div");
  topDiv.className = "cesium-timeline-main";
  container.appendChild(topDiv);
  this._topDiv = topDiv;

  this._endJulian = undefined;
  this._epochJulian = undefined;
  this._lastXPos = undefined;
  this._scrubElement = undefined;
  this._startJulian = undefined;
  this._timeBarSecondsSpan = undefined;
  this._clock = clock;
  this._scrubJulian = clock.currentTime;
  this._mainTicSpan = -1;
  this._mouseMode = timelineMouseMode.none;
  this._touchMode = timelineTouchMode.none;
  this._touchState = {
    centerX: 0,
    spanX: 0,
  };
  this._mouseX = 0;
  this._timelineDrag = 0;
  this._timelineDragLocation = undefined;
  this._lastHeight = undefined;
  this._lastWidth = undefined;

  this._topDiv.innerHTML =
    '<div class="cesium-timeline-bar"></div><div class="cesium-timeline-trackContainer">' +
    '<canvas class="cesium-timeline-tracks" width="10" height="1">' +
    '</canvas></div><div class="cesium-timeline-needle"></div><span class="cesium-timeline-ruler"></span>';
  this._timeBarEle = this._topDiv.childNodes[0];
  this._trackContainer = this._topDiv.childNodes[1];
  this._trackListEle = this._topDiv.childNodes[1].childNodes[0];
  this._needleEle = this._topDiv.childNodes[2];
  this._rulerEle = this._topDiv.childNodes[3];
  this._context = this._trackListEle.getContext("2d");

  this._trackList = [];
  this._highlightRanges = [];

  this.zoomTo(clock.startTime, clock.stopTime);

  this._onMouseDown = createMouseDownCallback(this);
  this._onMouseUp = createMouseUpCallback(this);
  this._onMouseMove = createMouseMoveCallback(this);
  this._onMouseWheel = createMouseWheelCallback(this);
  this._onTouchStart = createTouchStartCallback(this);
  this._onTouchMove = createTouchMoveCallback(this);
  this._onTouchEnd = createTouchEndCallback(this);

  const timeBarEle = this._timeBarEle;
  ownerDocument.addEventListener("mouseup", this._onMouseUp, false);
  ownerDocument.addEventListener("mousemove", this._onMouseMove, false);
  timeBarEle.addEventListener("mousedown", this._onMouseDown, false);
  timeBarEle.addEventListener("DOMMouseScroll", this._onMouseWheel, false); // Mozilla mouse wheel
  timeBarEle.addEventListener("mousewheel", this._onMouseWheel, false);
  timeBarEle.addEventListener("touchstart", this._onTouchStart, false);
  timeBarEle.addEventListener("touchmove", this._onTouchMove, false);
  timeBarEle.addEventListener("touchend", this._onTouchEnd, false);
  timeBarEle.addEventListener("touchcancel", this._onTouchEnd, false);

  this._topDiv.oncontextmenu = function () {
    return false;
  };

  clock.onTick.addEventListener(this.updateFromClock, this);
  this.updateFromClock();
}

Timeline.prototype.addEventListener = function (type, listener, useCapture) {
  this._topDiv.addEventListener(type, listener, useCapture);
};

Timeline.prototype.removeEventListener = function (type, listener, useCapture) {
  this._topDiv.removeEventListener(type, listener, useCapture);
};

Timeline.prototype.isDestroyed = function () {
  return false;
};

Timeline.prototype.destroy = function () {
  this._clock.onTick.removeEventListener(this.updateFromClock, this);

  const doc = this.container.ownerDocument;
  doc.removeEventListener("mouseup", this._onMouseUp, false);
  doc.removeEventListener("mousemove", this._onMouseMove, false);

  const timeBarEle = this._timeBarEle;
  timeBarEle.removeEventListener("mousedown", this._onMouseDown, false);
  timeBarEle.removeEventListener("DOMMouseScroll", this._onMouseWheel, false); // Mozilla mouse wheel
  timeBarEle.removeEventListener("mousewheel", this._onMouseWheel, false);
  timeBarEle.removeEventListener("touchstart", this._onTouchStart, false);
  timeBarEle.removeEventListener("touchmove", this._onTouchMove, false);
  timeBarEle.removeEventListener("touchend", this._onTouchEnd, false);
  timeBarEle.removeEventListener("touchcancel", this._onTouchEnd, false);
  this.container.removeChild(this._topDiv);
  Cesium.destroyObject(this);
};

Timeline.prototype.addHighlightRange = function (color, heightInPx, base) {
  const newHighlightRange = new TimelineHighlightRange(color, heightInPx, base);
  this._highlightRanges.push(newHighlightRange);
  this.resize();
  return newHighlightRange;
};

Timeline.prototype.addTrack = function (interval, heightInPx, color, backgroundColor) {
  const newTrack = new TimelineTrack(interval, heightInPx, color, backgroundColor);
  this._trackList.push(newTrack);
  this._lastHeight = undefined;
  this.resize();
  return newTrack;
};

Timeline.prototype.zoomTo = function (startTime, stopTime) {
  //>>includeStart('debug', pragmas.debug);
  if (!Cesium.defined(startTime)) {
    throw new Cesium.DeveloperError("startTime is required.");
  }
  if (!Cesium.defined(stopTime)) {
    throw new Cesium.DeveloperError("stopTime is required");
  }
  if (Cesium.JulianDate.lessThanOrEquals(stopTime, startTime)) {
    throw new Cesium.DeveloperError("Start time must come before end time.");
  }
  //>>includeEnd('debug');

  this._startJulian = startTime;
  this._endJulian = stopTime;
  this._timeBarSecondsSpan = Cesium.JulianDate.secondsDifference(stopTime, startTime);

  // If clock is not unbounded, clamp timeline range to clock.
  if (this._clock && this._clock.clockRange !== Cesium.ClockRange.UNBOUNDED) {
    const clockStart = this._clock.startTime;
    const clockEnd = this._clock.stopTime;
    const clockSpan = Cesium.JulianDate.secondsDifference(clockEnd, clockStart);
    const startOffset = Cesium.JulianDate.secondsDifference(clockStart, this._startJulian);
    const endOffset = Cesium.JulianDate.secondsDifference(clockEnd, this._endJulian);

    if (this._timeBarSecondsSpan >= clockSpan) {
      this._timeBarSecondsSpan = clockSpan;
      this._startJulian = this._clock.startTime;
      this._endJulian = this._clock.stopTime;
    } else if (startOffset > 0) {
      this._endJulian = Cesium.JulianDate.addSeconds(this._endJulian, startOffset, new Cesium.JulianDate());
      this._startJulian = clockStart;
      this._timeBarSecondsSpan = Cesium.JulianDate.secondsDifference(this._endJulian, this._startJulian);
    } else if (endOffset < 0) {
      this._startJulian = Cesium.JulianDate.addSeconds(this._startJulian, endOffset, new Cesium.JulianDate());
      this._endJulian = clockEnd;
      this._timeBarSecondsSpan = Cesium.JulianDate.secondsDifference(this._endJulian, this._startJulian);
    }
  }

  this._makeTics();

  const evt = document.createEvent("Event");
  evt.initEvent("setzoom", true, true);
  evt.startJulian = this._startJulian;
  evt.endJulian = this._endJulian;
  evt.epochJulian = this._epochJulian;
  evt.totalSpan = this._timeBarSecondsSpan;
  evt.mainTicSpan = this._mainTicSpan;
  this._topDiv.dispatchEvent(evt);
};

Timeline.prototype.zoomFrom = function (amount) {
  let centerSec = Cesium.JulianDate.secondsDifference(this._scrubJulian, this._startJulian);
  if (amount > 1 || centerSec < 0 || centerSec > this._timeBarSecondsSpan) {
    centerSec = this._timeBarSecondsSpan * 0.5;
  } else {
    centerSec += centerSec - this._timeBarSecondsSpan * 0.5;
  }
  const centerSecFlip = this._timeBarSecondsSpan - centerSec;
  this.zoomTo(
    Cesium.JulianDate.addSeconds(this._startJulian, centerSec - centerSec * amount, new Cesium.JulianDate()),
    Cesium.JulianDate.addSeconds(this._endJulian, centerSecFlip * amount - centerSecFlip, new Cesium.JulianDate())
  );
};

function twoDigits(num) {
  return num < 10 ? `0${num.toString()}` : num.toString();
}

Timeline.prototype.makeLabel = function (time) {
  const gregorian = Cesium.JulianDate.toGregorianDate(time);
  const millisecond = gregorian.millisecond;
  let millisecondString = " UTC";
  if (millisecond > 0 && this._timeBarSecondsSpan < 3600) {
    millisecondString = Math.floor(millisecond).toString();
    while (millisecondString.length < 3) {
      millisecondString = `0${millisecondString}`;
    }
    millisecondString = `.${millisecondString}`;
  }

  return `${timelineMonthNames[gregorian.month - 1]} ${gregorian.day} ${gregorian.year} ${twoDigits(gregorian.hour)}:${twoDigits(gregorian.minute)}:${twoDigits(gregorian.second)}${millisecondString}`;
};

Timeline.prototype.smallestTicInPixels = 7.0;

Timeline.prototype._makeTics = function () {
  const timeBar = this._timeBarEle;

  const seconds = Cesium.JulianDate.secondsDifference(this._scrubJulian, this._startJulian);
  const xPos = Math.round((seconds * this._topDiv.clientWidth) / this._timeBarSecondsSpan);
  const scrubX = xPos - 8;
  let tic;
  const widget = this;

  this._needleEle.style.left = `${xPos.toString()}px`;

  let tics = "";

  const minimumDuration = 0.01;
  const maximumDuration = 31536000000.0; // ~1000 years
  const epsilon = 1e-10;

  let minSize = 0;

  let duration = this._timeBarSecondsSpan;
  if (duration < minimumDuration) {
    duration = minimumDuration;
    this._timeBarSecondsSpan = minimumDuration;
    this._endJulian = Cesium.JulianDate.addSeconds(this._startJulian, minimumDuration, new Cesium.JulianDate());
  } else if (duration > maximumDuration) {
    duration = maximumDuration;
    this._timeBarSecondsSpan = maximumDuration;
    this._endJulian = Cesium.JulianDate.addSeconds(this._startJulian, maximumDuration, new Cesium.JulianDate());
  }

  let timeBarWidth = this._timeBarEle.clientWidth;
  if (timeBarWidth < 10) {
    timeBarWidth = 10;
  }
  const startJulian = this._startJulian;

  const epsilonTime = Math.min((duration / timeBarWidth) * 1e-5, 0.4);

  let epochJulian;
  const gregorianDate = Cesium.JulianDate.toGregorianDate(startJulian);
  if (duration > 315360000) {
    epochJulian = Cesium.JulianDate.fromDate(new Date(Date.UTC(Math.floor(gregorianDate.year / 100) * 100, 0)));
  } else if (duration > 31536000) {
    epochJulian = Cesium.JulianDate.fromDate(new Date(Date.UTC(Math.floor(gregorianDate.year / 10) * 10, 0)));
  } else if (duration > 86400) {
    epochJulian = Cesium.JulianDate.fromDate(new Date(Date.UTC(gregorianDate.year, 0)));
  } else {
    epochJulian = Cesium.JulianDate.fromDate(new Date(Date.UTC(gregorianDate.year, gregorianDate.month, gregorianDate.day)));
  }

  const startTime = Cesium.JulianDate.secondsDifference(
    this._startJulian,
    Cesium.JulianDate.addSeconds(epochJulian, epsilonTime, new Cesium.JulianDate())
  );
  let endTime = startTime + duration;
  this._epochJulian = epochJulian;

  function getStartTic(ticScale) {
    return Math.floor(startTime / ticScale) * ticScale;
  }

  function getNextTic(tic, ticScale) {
    return Math.ceil(tic / ticScale + 0.5) * ticScale;
  }

  function getAlpha(time) {
    return (time - startTime) / duration;
  }

  function remainder(x, y) {
    return x - y * Math.round(x / y);
  }

  this._rulerEle.innerHTML = this.makeLabel(
    Cesium.JulianDate.addSeconds(this._endJulian, -minimumDuration, new Cesium.JulianDate())
  );
  let sampleWidth = this._rulerEle.offsetWidth + 20;
  if (sampleWidth < 30) {
    sampleWidth = 180;
  }

  const origMinSize = minSize;
  minSize -= epsilon;

  const renderState = {
    startTime: startTime,
    startJulian: startJulian,
    epochJulian: epochJulian,
    duration: duration,
    timeBarWidth: timeBarWidth,
    getAlpha: getAlpha,
  };
  this._highlightRanges.forEach(function (highlightRange) {
    tics += highlightRange.render(renderState);
  });

  let mainTic = 0.0, subTic = 0.0, tinyTic = 0.0;
  let idealTic = sampleWidth / timeBarWidth;
  if (idealTic > 1.0) {
    idealTic = 1.0;
  }
  idealTic *= this._timeBarSecondsSpan;
  let ticIndex = -1, smallestIndex = -1;

  const ticScaleLen = timelineTicScales.length;
  let i;
  for (i = 0; i < ticScaleLen; ++i) {
    const sc = timelineTicScales[i];
    ++ticIndex;
    mainTic = sc;
    if (sc > idealTic && sc > minSize) {
      break;
    }
    if (smallestIndex < 0 && timeBarWidth * (sc / this._timeBarSecondsSpan) >= this.smallestTicInPixels) {
      smallestIndex = ticIndex;
    }
  }
  if (ticIndex > 0) {
    while (ticIndex > 0) {
      --ticIndex;
      if (Math.abs(remainder(mainTic, timelineTicScales[ticIndex])) < 0.00001) {
        if (timelineTicScales[ticIndex] >= minSize) {
          subTic = timelineTicScales[ticIndex];
        }
        break;
      }
    }

    if (smallestIndex >= 0) {
      while (smallestIndex < ticIndex) {
        if (Math.abs(remainder(subTic, timelineTicScales[smallestIndex])) < 0.00001 && timelineTicScales[smallestIndex] >= minSize) {
          tinyTic = timelineTicScales[smallestIndex];
          break;
        }
        ++smallestIndex;
      }
    }
  }

  minSize = origMinSize;
  if (minSize > epsilon && tinyTic < 0.00001 && Math.abs(minSize - mainTic) > epsilon) {
    tinyTic = minSize;
    if (minSize <= mainTic + epsilon) {
      subTic = 0.0;
    }
  }

  let lastTextLeft = -999999, textWidth;
  if (timeBarWidth * (tinyTic / this._timeBarSecondsSpan) >= 3.0) {
    for (tic = getStartTic(tinyTic); tic <= endTime; tic = getNextTic(tic, tinyTic)) {
      tics += `<span class="cesium-timeline-ticTiny" style="left: ${Math.round(timeBarWidth * getAlpha(tic)).toString()}px;"></span>`;
    }
  }
  if (timeBarWidth * (subTic / this._timeBarSecondsSpan) >= 3.0) {
    for (tic = getStartTic(subTic); tic <= endTime; tic = getNextTic(tic, subTic)) {
      tics += `<span class="cesium-timeline-ticSub" style="left: ${Math.round(timeBarWidth * getAlpha(tic)).toString()}px;"></span>`;
    }
  }
  if (timeBarWidth * (mainTic / this._timeBarSecondsSpan) >= 2.0) {
    this._mainTicSpan = mainTic;
    endTime += mainTic;
    tic = getStartTic(mainTic);
    const leapSecond = Cesium.JulianDate.computeTaiMinusUtc(epochJulian);
    while (tic <= endTime) {
      let ticTime = Cesium.JulianDate.addSeconds(startJulian, tic - startTime, new Cesium.JulianDate());
      if (mainTic > 2.1) {
        const ticLeap = Cesium.JulianDate.computeTaiMinusUtc(ticTime);
        if (Math.abs(ticLeap - leapSecond) > 0.1) {
          tic += ticLeap - leapSecond;
          ticTime = Cesium.JulianDate.addSeconds(startJulian, tic - startTime, new Cesium.JulianDate());
        }
      }
      const ticLeft = Math.round(timeBarWidth * getAlpha(tic));
      const ticLabel = this.makeLabel(ticTime);
      this._rulerEle.innerHTML = ticLabel;
      textWidth = this._rulerEle.offsetWidth;
      if (textWidth < 10) {
        textWidth = sampleWidth;
      }
      const labelLeft = ticLeft - (textWidth / 2 - 1);
      if (labelLeft > lastTextLeft) {
        lastTextLeft = labelLeft + textWidth + 5;
        tics +=
          `<span class="cesium-timeline-ticMain" style="left: ${ticLeft.toString()}px;"></span>` +
          `<span class="cesium-timeline-ticLabel" style="left: ${labelLeft.toString()}px;">${ticLabel}</span>`;
      } else {
        tics += `<span class="cesium-timeline-ticSub" style="left: ${ticLeft.toString()}px;"></span>`;
      }
      tic = getNextTic(tic, mainTic);
    }
  } else {
    this._mainTicSpan = -1;
  }

  tics += `<span class="cesium-timeline-icon16" style="left:${scrubX}px;bottom:0;background-position: 0 0;"></span>`;
  timeBar.innerHTML = tics;
  this._scrubElement = timeBar.lastChild;

  this._context.clearRect(0, 0, this._trackListEle.width, this._trackListEle.height);

  renderState.y = 0;
  this._trackList.forEach(function (track) {
    track.render(widget._context, renderState);
    renderState.y += track.height;
  });
};

Timeline.prototype.updateFromClock = function () {
  this._scrubJulian = this._clock.currentTime;
  const scrubElement = this._scrubElement;
  if (Cesium.defined(this._scrubElement)) {
    const seconds = Cesium.JulianDate.secondsDifference(this._scrubJulian, this._startJulian);
    const xPos = Math.round((seconds * this._topDiv.clientWidth) / this._timeBarSecondsSpan);

    if (this._lastXPos !== xPos) {
      this._lastXPos = xPos;

      scrubElement.style.left = `${xPos - 8}px`;
      this._needleEle.style.left = `${xPos}px`;
    }
  }
  if (Cesium.defined(this._timelineDragLocation)) {
    this._setTimeBarTime(
      this._timelineDragLocation,
      (this._timelineDragLocation * this._timeBarSecondsSpan) / this._topDiv.clientWidth
    );
    this.zoomTo(
      Cesium.JulianDate.addSeconds(this._startJulian, this._timelineDrag, new Cesium.JulianDate()),
      Cesium.JulianDate.addSeconds(this._endJulian, this._timelineDrag, new Cesium.JulianDate())
    );
  }
};

Timeline.prototype._setTimeBarTime = function (xPos, seconds) {
  xPos = Math.round(xPos);
  this._scrubJulian = Cesium.JulianDate.addSeconds(this._startJulian, seconds, new Cesium.JulianDate());
  if (this._scrubElement) {
    const scrubX = xPos - 8;
    this._scrubElement.style.left = `${scrubX.toString()}px`;
    this._needleEle.style.left = `${xPos.toString()}px`;
  }

  const evt = document.createEvent("Event");
  evt.initEvent("settime", true, true);
  evt.clientX = xPos;
  evt.timeSeconds = seconds;
  evt.timeJulian = this._scrubJulian;
  evt.clock = this._clock;
  this._topDiv.dispatchEvent(evt);
};

function createMouseDownCallback(timeline) {
  return function (e) {
    if (timeline._mouseMode !== timelineMouseMode.touchOnly) {
      if (e.button === 0) {
        timeline._mouseMode = timelineMouseMode.scrub;
        if (timeline._scrubElement) {
          timeline._scrubElement.style.backgroundPosition = "-16px 0";
        }
        timeline._onMouseMove(e);
      } else {
        timeline._mouseX = e.clientX;
        if (e.button === 2) {
          timeline._mouseMode = timelineMouseMode.zoom;
        } else {
          timeline._mouseMode = timelineMouseMode.slide;
        }
      }
    }
    e.preventDefault();
  };
}

function createMouseUpCallback(timeline) {
  return function (e) {
    timeline._clock.shouldAnimate = true
    timeline._mouseMode = timelineMouseMode.none;
    if (timeline._scrubElement) {
      timeline._scrubElement.style.backgroundPosition = "0 0";
    }
    timeline._timelineDrag = 0;
    timeline._timelineDragLocation = undefined;
  };
}

function createMouseMoveCallback(timeline) {
  return function (e) {
    let dx;
    if (timeline._mouseMode === timelineMouseMode.scrub) {
      e.preventDefault();
      const x = e.clientX - timeline._topDiv.getBoundingClientRect().left;

      if (x < 0) {
        timeline._timelineDragLocation = 0;
        timeline._timelineDrag = -0.01 * timeline._timeBarSecondsSpan;
      } else if (x > timeline._topDiv.clientWidth) {
        timeline._timelineDragLocation = timeline._topDiv.clientWidth;
        timeline._timelineDrag = 0.01 * timeline._timeBarSecondsSpan;
      } else {
        timeline._timelineDragLocation = undefined;
        timeline._setTimeBarTime(x, (x * timeline._timeBarSecondsSpan) / timeline._topDiv.clientWidth);
      }
    } else if (timeline._mouseMode === timelineMouseMode.slide) {
      dx = timeline._mouseX - e.clientX;
      timeline._mouseX = e.clientX;
      if (dx !== 0) {
        const dsec = (dx * timeline._timeBarSecondsSpan) / timeline._topDiv.clientWidth;
        timeline.zoomTo(
          Cesium.JulianDate.addSeconds(timeline._startJulian, dsec, new Cesium.JulianDate()),
          Cesium.JulianDate.addSeconds(timeline._endJulian, dsec, new Cesium.JulianDate())
        );
      }
    } else if (timeline._mouseMode === timelineMouseMode.zoom) {
      dx = timeline._mouseX - e.clientX;
      timeline._mouseX = e.clientX;
      if (dx !== 0) {
        timeline.zoomFrom(Math.pow(1.01, dx));
      }
    }
  };
}

function createMouseWheelCallback(timeline) {
  return function (e) {
    let dy = e.wheelDeltaY || e.wheelDelta || -e.detail;
    timelineWheelDelta = Math.max(Math.min(Math.abs(dy), timelineWheelDelta), 1);
    dy /= timelineWheelDelta;
    timeline.zoomFrom(Math.pow(1.05, -dy));
  };
}

function createTouchStartCallback(timeline) {
  return function (e) {
    const len = e.touches.length;
    let seconds, xPos;
    const leftX = timeline._topDiv.getBoundingClientRect().left;
    e.preventDefault();
    timeline._mouseMode = timelineMouseMode.touchOnly;
    if (len === 1) {
      seconds = Cesium.JulianDate.secondsDifference(timeline._scrubJulian, timeline._startJulian);
      xPos = Math.round((seconds * timeline._topDiv.clientWidth) / timeline._timeBarSecondsSpan + leftX);
      if (Math.abs(e.touches[0].clientX - xPos) < 50) {
        timeline._touchMode = timelineTouchMode.scrub;
        if (timeline._scrubElement) {
          timeline._scrubElement.style.backgroundPosition = len === 1 ? "-16px 0" : "0 0";
        }
      } else {
        timeline._touchMode = timelineTouchMode.singleTap;
        timeline._touchState.centerX = e.touches[0].clientX - leftX;
      }
    } else if (len === 2) {
      timeline._touchMode = timelineTouchMode.slideZoom;
      timeline._touchState.centerX = (e.touches[0].clientX + e.touches[1].clientX) * 0.5 - leftX;
      timeline._touchState.spanX = Math.abs(e.touches[0].clientX - e.touches[1].clientX);
    } else {
      timeline._touchMode = timelineTouchMode.ignore;
    }
  };
}

function createTouchEndCallback(timeline) {
  return function (e) {
    const len = e.touches.length;
    if (timeline._touchMode === timelineTouchMode.singleTap) {
      timeline._touchMode = timelineTouchMode.scrub;
      timeline._onTouchMove(e);
    } else if (timeline._touchMode === timelineTouchMode.scrub) {
      timeline._onTouchMove(e);
    }
    timeline._mouseMode = timelineMouseMode.touchOnly;
    if (len !== 1) {
      timeline._touchMode = len > 0 ? timelineTouchMode.ignore : timelineTouchMode.none;
    } else if (timeline._touchMode === timelineTouchMode.slideZoom) {
      timeline._touchState.centerX = e.touches[0].clientX - leftX;
    }
    if (timeline._scrubElement) {
      timeline._scrubElement.style.backgroundPosition = "0 0";
    }
  };
}

function createTouchMoveCallback(timeline) {
  return function (e) {
    let dx, x, len, newCenter, newSpan, newStartTime, zoom = 1;
    const leftX = timeline._topDiv.getBoundingClientRect().left;
    if (timeline._touchMode === timelineTouchMode.singleTap) {
      timeline._touchMode = timelineTouchMode.slideZoom;
    }
    timeline._mouseMode = timelineMouseMode.touchOnly;
    if (timeline._touchMode === timelineTouchMode.scrub) {
      e.preventDefault();
      if (e.changedTouches.length === 1) {
        x = e.changedTouches[0].clientX - leftX;
        if (x >= 0 && x <= timeline._topDiv.clientWidth) {
          timeline._setTimeBarTime(x, (x * timeline._timeBarSecondsSpan) / timeline._topDiv.clientWidth);
        }
      }
    } else if (timeline._touchMode === timelineTouchMode.slideZoom) {
      len = e.touches.length;
      if (len === 2) {
        newCenter = (e.touches[0].clientX + e.touches[1].clientX) * 0.5 - leftX;
        newSpan = Math.abs(e.touches[0].clientX - e.touches[1].clientX);
      } else if (len === 1) {
        newCenter = e.touches[0].clientX - leftX;
        newSpan = 0;
      }

      if (Cesium.defined(newCenter)) {
        if (newSpan > 0 && timeline._touchState.spanX > 0) {
          zoom = timeline._touchState.spanX / newSpan;
          newStartTime = Cesium.JulianDate.addSeconds(
            timeline._startJulian,
            (timeline._touchState.centerX * timeline._timeBarSecondsSpan - newCenter * timeline._timeBarSecondsSpan * zoom) / timeline._topDiv.clientWidth,
            new Cesium.JulianDate()
          );
        } else {
          dx = timeline._touchState.centerX - newCenter;
          newStartTime = Cesium.JulianDate.addSeconds(
            timeline._startJulian,
            (dx * timeline._timeBarSecondsSpan) / timeline._topDiv.clientWidth,
            new Cesium.JulianDate()
          );
        }

        timeline.zoomTo(
          newStartTime,
          Cesium.JulianDate.addSeconds(newStartTime, timeline._timeBarSecondsSpan * zoom, new Cesium.JulianDate())
        );
        timeline._touchState.centerX = newCenter;
        timeline._touchState.spanX = newSpan;
      }
    }
  };
}

Timeline.prototype.resize = function () {
  const width = this.container.clientWidth;
  const height = this.container.clientHeight;

  if (width === this._lastWidth && height === this._lastHeight) {
    return;
  }

  this._trackContainer.style.height = `${height}px`;

  let trackListHeight = 1;
  this._trackList.forEach(function (track) {
    trackListHeight += track.height;
  });
  this._trackListEle.style.height = `${trackListHeight.toString()}px`;
  this._trackListEle.width = this._trackListEle.clientWidth;
  this._trackListEle.height = trackListHeight;
  this._makeTics();

  this._lastXPos = undefined;
  this._lastWidth = width;
  this._lastHeight = height;
};

export default Timeline;
