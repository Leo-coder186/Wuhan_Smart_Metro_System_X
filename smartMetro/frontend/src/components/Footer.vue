<!--
 * @Description: 底部导航栏组件 - 页面切换导航
 *
 * 功能：
 *   1. 渲染底部导航菜单（从 menuData.js 读取配置）
 *   2. 使用 <router-link> 实现 Vue Router 导航
 *   3. 监听路由变化，高亮当前选中菜单项
 *   4. 首页项有特殊的 .home 样式（向上偏移）
 *
 * 菜单项包括：首页、实时轨迹、重点活动、发展历程、站点管理
 * @Date: 2024-05-08
-->
<template>
    <div id="footer">
      <ul>
          <!-- 遍历菜单数据，渲染导航链接 -->
          <li v-for="item in menus">
              <!--
                router-link: Vue Router 内置导航组件
                :to="item.path" → 点击跳转到对应路由
                :class 动态绑定：
                  - active-item: 当前路由匹配时高亮
                  - home: 首页按钮特殊样式
              -->
              <router-link :to="item.path"
              :class="[item.isActive?'active-item':'',item.name==='首页'?'home':'']">{{item.name}}</router-link>
          </li>
      </ul>
    </div>
</template>

<script setup>
import router from '@/router'
import menusData from '@/store/menuData'  // 菜单配置数据
import { ref, watch } from 'vue'

// 响应式菜单数据（会动态修改 isActive 状态）
const menus = ref(menusData)

// 监听路由变化，自动更新菜单高亮状态
watch(router.currentRoute, (value) => {
    menus.value = menus.value.map(n => {
        // 当前路径与菜单项路径匹配时 → 高亮
        if (n.path === value.path) {
            n.isActive = true
        } else {
            n.isActive = false
        }
        return n
    })
})
</script>

<style scoped>
/* 底部导航栏 - 使用 footer.png 背景 */
#footer {
    width: 100%;
    height: 73px;
    position: absolute;
    z-index: 200;
    left: 50%;
    bottom: 0.521vw;
    transform: translateX(-50%);     /* 水平居中 */
    background: url('../assets/uiResources/footer.png');
    background-size: cover;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: all;             /* 允许点击 */
}

/* 当前激活的菜单项 - 金色高亮 */
#footer ul .active-item {
    color: #ec9b02;
    font-size: 12px;
}

/* 导航列表容器 */
#footer ul {
    width: 28%;
    display: flex;
    align-items: center;
    justify-content: space-around;   /* 菜单项均匀分布 */
    list-style: none;
    margin-top: 24px;
}

/* 菜单链接基础样式 */
#footer ul a {
    color: #fff;
    font-size: 12px;
    text-decoration: none;           /* 去掉下划线 */
}

#footer ul li {
    color: #fff;
    cursor: pointer;
}

/* 悬停效果 */
#footer ul a:hover {
    color: rgb(97, 89, 89);
}

/* 首页按钮特殊样式 - 向上偏移 */
#footer ul .home {
    display: inline-block;
    transform: translateY(-3px);
}
</style>
