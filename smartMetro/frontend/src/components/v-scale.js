/**
 * @Description: 大屏自适应缩放组件 - v-scale-screen
 *
 * 功能：将指定宽高（默认1920×1080）的内容区域等比缩放，使其在任何分辨率屏幕上完整显示
 *
 * 核心原理：
 *   1. 根据设计稿尺寸（width × height）创建一个固定尺寸的 DOM 容器
 *   2. 监听窗口 resize 事件，计算当前浏览器窗口与设计稿的比例
 *   3. 使用 CSS transform: scale() 将容器等比缩放
 *   4. 使用 margin 将缩放后的容器居中显示
 *
 * Props:
 *   - width/height: 设计稿基准尺寸（默认 1920×1080）
 *   - fullScreen: 是否强制铺满全屏（默认 false，等比缩放）
 *   - autoScale: 自动缩放开关（默认 true）
 *   - delay: resize 防抖延迟（毫秒，默认 500）
 *   - bodyOverflowHidden: 是否隐藏 body 滚动条（默认 true）
 *   - boxStyle/wrapperStyle: 自定义外层和内容容器样式
 *
 * Events:
 *   - onSizeChange: 缩放比例变化时触发，回传当前 scale 值
 *
 * @Date: 2024-09-02
 */
import {
  defineComponent,
  h,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  ref,
} from "vue";

import _ from "lodash";

export default defineComponent({
  name: "VScaleScreen",

  props: {
    /** 设计稿宽度（px） */
    width: {
      type: [String, Number],
      default: 1920,
    },
    /** 设计稿高度（px） */
    height: {
      type: [String, Number],
      default: 1080,
    },
    /** 是否强制铺满全屏（X和Y方向分别缩放到窗口大小） */
    fullScreen: {
      type: Boolean,
      default: false,
    },
    /**
     * 自动缩放配置
     * boolean: true/false 控制启用/禁用
     * object: { x, y } 控制是否在X轴/Y轴上居中
     */
    autoScale: {
      type: [Object, Boolean],
      default: true,
    },
    /** resize 事件防抖延迟（毫秒） */
    delay: {
      type: Number,
      default: 500,
    },
    /** 外层容器自定义样式 */
    boxStyle: {
      type: Object,
      default: () => ({}),
    },
    /** 内容层容器自定义样式 */
    wrapperStyle: {
      type: Object,
      default: () => ({}),
    },
    /** 是否隐藏 body 的滚动条 */
    bodyOverflowHidden: {
      type: Boolean,
      default: true,
    }
  },

  setup(props, { slots, emit }) {
    // 保存 body 原始的 overflow 样式，卸载时恢复
    let bodyOverflowHidden;

    // 状态管理
    const state = reactive({
      width: 0,            // 当前容器宽度
      height: 0,           // 当前容器高度
      originalWidth: 0,    // 屏幕原始宽度
      originalHeight: 0,   // 屏幕原始高度
      observer: null,      // MutationObserver 实例
    });

    // 容器基础样式
    const styles = {
      box: {
        overflow: "hidden",
        backgroundSize: `100% 100%`,
        background: `#000`,
        width: `100vw`,
        height: `100vh`,
      },
      wrapper: {
        transitionProperty: `all`,
        transitionTimingFunction: `cubic-bezier(0.4, 0, 0.2, 1)`,
        transitionDuration: `500ms`,
        position: `relative`,
        overflow: `hidden`,
        zIndex: 100,
        transformOrigin: `left top`,  // 缩放原点设在左上角
      },
    };

    const el = ref();        // 内容容器的 DOM 引用
    const scaleRef = ref(1)  // 当前缩放比例

    /**
     * 初始化大屏容器尺寸
     * 优先使用 props 传入的宽高，否则使用容器的 clientWidth/Height
     */
    const initSize = () => {
      return new Promise((resolve) => {
        nextTick(() => {
          // 获取大屏设计尺寸
          if (props.width && props.height) {
            state.width = props.width;
            state.height = props.height;
          } else {
            state.width = el.value?.clientWidth;
            state.height = el.value?.clientHeight;
          }

          // 获取屏幕物理尺寸
          if (!state.originalHeight || !state.originalWidth) {
            state.originalWidth = window.screen.width;
            state.originalHeight = window.screen.height;
          }
          resolve();
        });
      });
    };

    /**
     * 初始化 body 样式：隐藏滚动条（可选）
     */
    function initBodyStyle() {
      if (props.bodyOverflowHidden) {
        bodyOverflowHidden = document.body.style.overflow;
        document.body.style.overflow = "hidden";
      }
    }

    /**
     * 更新容器尺寸：将容器的 width/height 设置为设计稿尺寸
     */
    const updateSize = () => {
      if (state.width && state.height) {
        el.value.style.width = `${state.width}px`;
        el.value.style.height = `${state.height}px`;
      } else {
        el.value.style.width = `${state.originalWidth}px`;
        el.value.style.height = `${state.originalHeight}px`;
      }
    };

    /**
     * 应用缩放变换
     * 使用 CSS transform: scale() 缩放容器
     * 使用 margin 将缩放后的容器居中
     */
    const autoScale = (scale) => {
      if (!props.autoScale) return;

      const domWidth = el.value.clientWidth;
      const domHeight = el.value.clientHeight;
      const currentWidth = document.body.clientWidth;
      const currentHeight = document.body.clientHeight;

      // 应用缩放
      el.value.style.transform = `scale(${scale},${scale})`;

      // 计算居中边距
      let mx = Math.max((currentWidth - domWidth * scale) / 2, 0);   // 水平居中偏移
      let my = Math.max((currentHeight - domHeight * scale) / 2, 0); // 垂直居中偏移

      // 如果 autoScale 是对象，可以禁用某一轴方向的居中
      if (typeof props.autoScale === "object") {
        !props.autoScale.x && (mx = 0);
        !props.autoScale.y && (my = 0);
      }

      el.value.style.margin = `${my}px ${mx}px`;
      scaleRef.value = scale
    };

    /**
     * 更新缩放比例
     * 计算逻辑：取窗口宽高与设计稿宽高的最小比例，确保内容完全可见
     */
    const updateScale = () => {
      // 获取当前视口尺寸
      const currentWidth = document.body.clientWidth;
      const currentHeight = document.body.clientHeight;

      // 获取目标尺寸
      const realWidth = state.width || state.originalWidth;
      const realHeight = state.height || state.originalHeight;

      // 计算缩放比例
      const widthScale = currentWidth / +realWidth;
      const heightScale = currentHeight / +realHeight;

      // 全屏模式：X和Y各自缩放（可能变形）
      if (props.fullScreen) {
        el.value.style.transform = `scale(${widthScale},${heightScale})`;
        return false;
      }

      // 正常模式：取宽高最小比例（保持宽高比，不会变形）
      const scale = Math.min(widthScale, heightScale);
      autoScale(scale);
    };

    /**
     * 窗口大小变化处理（带防抖）
     * 流程：重新读取尺寸 → 更新容器大小 → 重新计算缩放
     */
    const onResize = _.debounce(async () => {
      await initSize();
      updateSize();
      updateScale();
      emit('onSizeChange', scaleRef.value)  // 触发事件通知父组件
    }, props.delay);

    /**
     * 初始化 MutationObserver
     * 监听容器自身 style 属性变化，自动触发 resize 重新计算
     * 用于处理某些情况下容器样式被外部修改的场景
     */
    const initMutationObserver = () => {
      const observer = (state.observer = new MutationObserver(() => {
        onResize();
      }));
      observer.observe(el.value, {
        attributes: true,
        attributeFilter: ["style"],
        attributeOldValue: true,
      });
    };

    onMounted(() => {
      initBodyStyle();
      nextTick(async () => {
        await initSize();          // 1. 初始化尺寸
        updateSize();              // 2. 设置容器固定大小
        updateScale();             // 3. 计算并应用缩放
        emit('onSizeChange', scaleRef.value)
        window.addEventListener("resize", onResize);   // 4. 监听窗口变化
        initMutationObserver();    // 5. 监听样式变化
      });
    });

    onUnmounted(() => {
      // 清理：移除事件监听和观察器
      window.removeEventListener("resize", onResize);
      state.observer?.disconnect();
      // 恢复 body 原始样式
      if (props.bodyOverflowHidden) {
        document.body.style.overflow = bodyOverflowHidden;
      }
    });

    /**
     * 渲染函数
     * 结构：外层 box（100vw×100vh 遮罩层） > 内层 wrapper（设计稿尺寸，可缩放）
     */
    return () => {
      return h(
        "div",
        {
          className: "v-screen-box",
          style: { ...styles.box, ...props.boxStyle },
        },
        [
          h(
            "div",
            {
              className: "screen-wrapper",
              style: { ...styles.wrapper, ...props.wrapperStyle },
              ref: el,
            },
            slots.default?.()   // 插槽内容
          ),
        ]
      );
    };
  },
});
