/**
 * @Description: Vite 构建配置文件 - 前端项目的打包、编译和开发服务器配置
 *
 * 核心功能：
 *   1. Vue 3 SFC 编译（@vitejs/plugin-vue）
 *   2. CesiumJS 外部化（vite-plugin-externals）- 避免打包巨大 Cesium 库
 *   3. 动态注入 Cesium 脚本和样式（vite-plugin-insert-html）
 *   4. 静态资源复制（vite-plugin-static-copy）
 *   5. Gzip 压缩（vite-plugin-compression）
 *   6. CSS 加载顺序修正（自定义插件）
 *   7. SCSS 全局变量注入
 *   8. 3D 模型代理（/models 路径代理到模型服务器）
 *
 * 环境模式：
 *   - 开发（development）：Cesium 从 node_modules 复制使用，3D 模型从 locahost:666 加载
 *   - 生产（production）：Cesium 从 CDN 加载，压缩优化，移除 console
 *
 * @Date: 2023-02-07
 */
import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "url";
import vue from "@vitejs/plugin-vue";
import { viteExternalsPlugin } from "vite-plugin-externals";
import { insertHtml, h } from "vite-plugin-insert-html";
import { viteStaticCopy } from "vite-plugin-static-copy";
import compress from "vite-plugin-compression";

/**
 * 自定义 Vite 插件：确保主应用 CSS 在 Cesium CSS 之后加载
 *
 * 问题背景：
 *   Cesium Widgets.css 中定义了大量全局样式（如 .cesium-widget）。
 *   如果主应用 CSS 在 Cesium CSS 之前加载，可能导致样式被覆盖或顺序错乱。
 *
 * 解决方案：
 *   在打包阶段，找到 index.html 中的 CSS 引用顺序，
 *   强制主应用 CSS 排在 Cesium widgets.css 之后。
 */
const cssOrderPlugin = () => {
  return {
    name: "css-order-plugin",
    generateBundle(options, bundle) {
      const htmlFile = Object.values(bundle).find(
        (file) => file.type === "asset" && file.fileName === "index.html"
      );
      if (htmlFile && htmlFile.source) {
        let html = htmlFile.source;

        // 找到主应用 CSS 链接
        const mainCssMatch = html.match(
          /<link[^>]*rel="stylesheet"[^>]*href="[^"]*index-[^"]*\.css"[^>]*>/
        );
        if (mainCssMatch) {
          const mainCssLink = mainCssMatch[0];
          // 先移除
          html = html.replace(mainCssLink, "");
          // 再插入到 Cesium CSS 之后
          html = html.replace(
            /(<link[^>]*rel="stylesheet"[^>]*href="[^"]*widgets\.css"[^>]*>)/,
            `$1\n    ${mainCssLink}`
          );
          htmlFile.source = html;
        }
      }
    },
  };
};

/**
 * Vite 配置工厂函数
 * 根据 mode 返回不同的配置
 */
const config = (context) => {
  const mode = context.mode;                        // 'development' | 'production'
  const envDir = "env";                             // 环境变量文件夹
  const isProd = mode === "production";

  // 加载 .env 环境变量
  const env = loadEnv(mode, envDir);

  // Cesium 基础 URL（CDN 或本地）
  const cesiumBaseUrl = env["VITE_CESIUM_BASE_URL"]
    || "https://cesium.com/downloads/cesiumjs/releases/1.97/Build/Cesium/";

  // 应用基础路径（根路径）
  const base = "/";

  // ============================================
  // 插件配置
  // ============================================
  const plugins = [
    // Vue 3 单文件组件编译
    vue(),

    /**
     * 将 Cesium 外部化（不参与 Vite 打包）
     *
     * 原因：CesiumJS 库体积巨大（~50MB），打包会极慢且浪费。
     * 外部化后通过 <script> 标签全局引入（window.Cesium），
     * 显著减少打包体积和构建时间。
     *
     * 开发环境不启用（disableInServe: true）：
     *   开发时通过 viteStaticCopy 复制本地 Cesium 文件。
     */
    viteExternalsPlugin(
      {
        cesium: "Cesium",  // import * as Cesium → 全局 window['Cesium']
      },
      {
        disableInServe: true,
      }
    ),

    /**
     * 动态注入 <script> 和 <link> 到 HTML head
     *
     * 生产模式：从 CDN 加载 Cesium
     * 开发模式：从本地 libs/cesium/ 目录加载（由 viteStaticCopy 复制）
     */
    insertHtml({
      head: [
        // Cesium 主库 JS
        h("script", {
          src: isProd
            ? `${cesiumBaseUrl}Cesium.js`         // CDN
            : `${base}libs/cesium/Cesium.js`,      // 本地
        }),
        // Cesium CSS（Widgets 样式）
        h("link", {
          rel: "stylesheet",
          href: isProd
            ? `${cesiumBaseUrl}Widgets/widgets.css`  // CDN
            : `${base}libs/cesium/Widgets/widgets.css`, // 本地
        }),
      ],
    }),
  ];

  // ============================================
  // 开发环境额外配置：复制 Cesium 依赖到 dist
  // ============================================
  if (!isProd) {
    const cesiumLibraryRoot = "node_modules/cesium/Build/CesiumUnminified/";
    const cesiumLibraryCopyToRootPath = "libs/cesium/"; // 相对于打包后的路径

    // Cesium 的静态资源目录（Assets/ThirdParty/Workers/Widgets）
    const cesiumStaticSourceCopyOptions = [
      "Assets", "ThirdParty", "Workers", "Widgets",
    ].map((dirName) => {
      return {
        src: `${cesiumLibraryRoot}${dirName}/*`,   // 复制整个目录
        dest: `${cesiumLibraryCopyToRootPath}${dirName}`,
      };
    });

    plugins.push(
      viteStaticCopy({
        targets: [
          // Cesium 主库 JS 文件（非压缩版，开发调试用）
          {
            src: `${cesiumLibraryRoot}Cesium.js`,
            dest: cesiumLibraryCopyToRootPath,
          },
          ...cesiumStaticSourceCopyOptions,
        ],
      })
    );
  }

  // ============================================
  // 静态资源复制（开发 + 生产共用）
  // 将 assets 目录中的资源复制到 dist
  // ============================================
  plugins.push(
    viteStaticCopy({
      targets: [
        { src: "src/assets/model/*",            dest: "assets/model" },
        { src: "src/assets/materialResources/*", dest: "assets/materialResources" },
        { src: "src/assets/uiResources/*",       dest: "assets/uiResources" },
        { src: "src/assets/wuhan/*",            dest: "assets/wuhan" },
        { src: "src/assets/*.jpg",              dest: "assets" },
        { src: "src/assets/*.png",              dest: "assets" },
        { src: "src/assets/*.json",             dest: "assets" },
        { src: "src/assets/*.flv",              dest: "assets" },
        { src: "src/assets/*.jpeg",             dest: "assets" },
      ],
    })
  );

  // ============================================
  // Gzip 压缩插件
  // threshold: 10KB 以下的文件不压缩（小文件压缩得不偿失）
  // ============================================
  plugins.push(
    compress({
      threshold: 10 * 1024,
    })
  );

  // ============================================
  // 路径别名：@ → src/
  // ============================================
  const resolve = {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  };

  // ============================================
  // SCSS 全局变量注入
  // 每个 Vue 组件的 <style> 中自动注入 @use '@/assets/style/mixin.scss'
  // ============================================
  const css = {
    preprocessorOptions: {
      scss: {
        additionalData: '@use "@/assets/style/mixin.scss";',
        implementation: require("sass"),
      },
    },
  };

  // ============================================
  // 资源类型声明
  // ============================================
  const assetsInclude = [
    "**/*.png", "**/*.jpg", "**/*.jpeg", "**/*.gif",
    "**/*.svg", "**/*.webp", "**/*.flv", "**/*.json",
  ];

  // ============================================
  // 开发服务器代理
  // /models 路径代理到模型文件服务器
  // ============================================
  const proxy = {};

  return {
    base,            // 应用部署的基础路径
    envDir,          // 环境变量文件夹
    mode,            // 当前模式
    plugins,         // 插件列表
    resolve,         // 路径解析
    css,             // CSS 配置
    assetsInclude,   // 静态资源声明

    build: {
      rollupOptions: {
        output: {
          // 控制资源文件命名
          assetFileNames: (assetInfo) => {
            if (assetInfo.name && assetInfo.name.endsWith(".css")) {
              return "assets/[name]-[hash][extname]";
            }
            return "assets/[name]-[hash][extname]";
          },
        },
        // 生产模式使用 CSS 顺序修正插件
        plugins: isProd ? [cssOrderPlugin()] : [],
      },
      // 生产模式：Terser 压缩 + 移除 console 和 debugger
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: isProd,
          drop_debugger: isProd,
        },
      },
    },

    server: {
      proxy: {
        // /models 路径代理到 3D 模型服务（端口根据 VITE_SERVER_IP 配置）
        "/models": {
          target: `http://${env["VITE_SERVER_IP"] || "47.121.123.123"}`,
          changeOrigin: true,  // 修改请求头中的 Origin 为目标地址
          secure: false,       // 允许自签名证书
        },
      },
    },
  };
};

export default defineConfig(config);
