/**
 * @Description: 工具列表配置 - 定义右侧浮动工具栏的可用工具
 *
 * 工具列表：
 *   - 鼠标位置：在地图左上角显示当前鼠标指向的经纬度坐标
 *   - 图层控制：弹窗面板控制各条地铁线路的显示/隐藏
 *   - 全屏控件：切换页面全屏模式
 *
 * icon 值对应 iconfont 图标的 class 名称
 * @Date: 2024-05-10
 */
const toolList = [
    {
        title: '鼠标位置',       // 工具名称（tooltip）
        icon: 'metro-zhizhen'    // 图标 class
    },
    {
        title: '图层控制',
        icon: 'metro-layer'
    },
    {
        title: '全屏控件',
        icon: 'metro-quanping_o'
    }
]

export default toolList
