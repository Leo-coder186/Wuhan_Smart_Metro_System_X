/**
 * @Description: Axios HTTP 请求封装 - 全局请求实例
 *
 * 功能：
 *   1. 创建统一的 axios 实例，配置 baseURL、headers、超时时间
 *   2. 请求拦截器：在发送前处理请求配置
 *   3. 响应拦截器：统一处理响应数据，code === 200 或 info === 'OK' 才放行
 *
 * 配置说明：
 *   - baseURL: 从环境变量 VITE_BASE_URL 读取
 *   - Content-Type: application/json;charset=UTF-8
 *   - timeout: 30 秒超时
 *
 * 使用方式：其他模块 import api from "./request"，调用 api.get/post 等方法
 * @Date: 2024-05-08
 */

import axios from "axios";

// 创建 axios 实例
const api = axios.create({
  baseURL: import.meta.env.VITE_BASE_URL,  // 所有请求的基础 URL（如 http://127.0.0.1/api/v1）
  headers: { "Content-Type": "application/json;charset=UTF-8" },  // 请求头
  timeout: 30000,  // 请求超时时间 30 秒
});

// ============================================
// 请求拦截器
// 在请求发送前执行，可用于添加 token、日志等
// ============================================
api.interceptors.request.use(
  (config) => {
    // config 包含请求的所有信息（URL、headers、params、data等）
    // 必须返回 config，否则请求不会发出
    return config;
  },
  (err) => {
    // 请求配置出错时的处理
    Promise.reject(err);
  }
);

// ============================================
// 响应拦截器
// 在收到响应后执行，统一判断业务状态码
// ============================================
api.interceptors.response.use(
  (response) => {
    const data = response.data;
    console.log(data);  // 调试日志

    // 业务状态码为 200 或高德 API 返回 info === 'OK' 时，正常返回
    if (data.code === 200 || data.info === 'OK') {
      return data;
    } else {
      // 业务异常：将错误向下传递到调用方的 catch
      return Promise.reject(data);
    }
  },
  (err) => {
    // HTTP 错误（网络异常、状态码 4xx/5xx 等）
    return Promise.reject(err.response);
  }
);

export default api;
