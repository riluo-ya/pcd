export interface UpdateLog {
    date: string;
    content: string;
}
export const projectDescription = "Phigros 谱面下载器是一个按曲目浏览 Phigros 资源的项目。此外，它还具备将资源直接导出为可在 Phira 或 RPE 中游玩的谱面文件的实用功能。它还配有简洁易用的用户界面，以及音频播放器（开发中）和特定曲目的异常特效。";
export const updateLogs: UpdateLog[] = [
    {
        date: "2026-10-17",
        content: `

            <ul class="list-disc list-inside space-y-1">
                <li>界面与上游项目对齐</li>
                <li>- 整体结构改为全高应用外壳：顶栏 / 左侧曲库 / 右侧工作区 / 底栏，页面不再整体滚动</li>
                <li>- 歌曲列表从下拉改为常驻面板，搜索框常驻顶部，列表项显示曲名与曲师</li>
                <li>- 难度选择改为四格卡片（EZ/HD/IN/AT），缺失难度置灰显示 N/A</li>
                <li>- 顶栏新增版本状态胶囊，加载失败可点击重试</li>
                <li>- 导出按钮、文件表格、滚动条等细节统一为新的视觉规范</li>
                <li>下载站</li>
                <li>- 修复分享卡片一直卡在「正在生成」的问题：曲绘加载增加超时，网络挂起时不再无限等待</li>
                <li>- 卡片生成失败时显示原因并提供重试，不再一片空白</li>
                <li>- 错误提示改为站内弹窗，不再调用浏览器原生弹窗</li>
                <li>- 未指定难度时导出全部难度，每个难度一个谱面包</li>
                <li>- 访问凭证有效期延长至 12 小时</li>
                <li>- 扫码进入并完成答题后，会回到原来的歌曲链接而不是导航页</li>
                <li>分享卡片</li>
                <li>- 新增「指定定数」筛选，可填 17、17.6 这类精确值，多个用逗号分隔</li>
                <li>- 没有 AT 难度的歌曲不再渲染 AT 行</li>
                <li>- 物量显示改为 Notes，主题增至 17 套并新增浅色主题</li>
                <li>- 卡片内的显示项可在设置中逐项开关</li>
                <li>- 超长曲名自动调整字号与行数，不再被截断</li>
                <li>批量下载</li>
                <li>- 界面重做：筛选 → 勾选 → 打包，支持关键词、定数、难度、谱师、曲师、BPM、时长、物量、判定线</li>
                <li>- 打包方式改为每个难度一个独立谱面包</li>
                <li>- 开始前显示数量、包数与预计耗时，命中黑名单时提前确认</li>
                <li>- 结束后可只重试失败的曲目</li>
                <li>谱面工坊</li>
                <li>- 适配 Phigros 新增的「噪域」结构，统计区显示噪域数量、遮挡/挖洞构成与跨度</li>
                <li>- 支持直接上传下载站导出的压缩包，自动识别其中的多首歌曲与多个难度</li>
                <li>- 修复导出的文件扩展名错误（.pez 被写成 .json）</li>
                <li>- 谱面信息同步写入 info.txt 与 info.yml</li>
                <li>- 输出文件名改为「曲名 + 标识」，如 ALL TAP、ALL HOLD、RANDOM、MIXTURE</li>
                <li>- 下拉与复选框改为站内自绘控件，配色与整体统一</li>
            </ul>
        `
    },
    {
        date: "2026-10-01",
        content: `

            <ul class="list-disc list-inside space-y-1">
                <li>国庆节快乐(🇨🇳^‿^)/🎉</li>
                <li>优化了筛选的逻辑，可以指定难度啦</li>
            </ul>
        `
    },
    {
        date: "2026-09-29",
        content: `

            <ul class="list-disc list-inside space-y-1">
                <li>完善并优化批量下载功能</li>
                <li>优化了选歌的逻辑</li>
                <li>优化了交互逻辑</li>
                <li>修复了批量下载的筛选错误的bug</li>
            </ul>
        `
    },
    {
        date: "2026-09-28",
        content: `

            <ul class="list-disc list-inside space-y-1">
                <li>增加了卡片分享功能</li>
                <li>优化了设置的显示逻辑</li>
            </ul>
        `
    },
    {
        date: "2026-09-27",
        content: `

            <ul class="list-disc list-inside space-y-1">
                <li>增加了“清除缓存”功能按钮</li>
                <li>增加了四条CDN线路</li>
                <li>优化了更新日志的展示逻辑（可以让我更好的更改了）</li>
                <li>增加了免责声明</li>
            </ul>
        `
    },
    {
        date: "2026-09-27",
        content: `

            <ul class="list-disc list-inside space-y-1">
                <li>更新日志改为读取外部 changelog.json，改完推送即可生效</li>
                <li>顶部新增「清除缓存」按钮，清理后自动刷新页面</li>
            </ul>
        `
    },
    {
        date: "2026-03-08",
        content: `

            <ul class="list-disc list-inside space-y-1">
                <li>在歌曲选择器中添加了排序按钮</li>
                <li>添加了「高级信息模式」设置</li>
                <li>添加了「批量下载模式」（开发中）</li>
            </ul>
        `
    },
    {
        date: "2026-02-28",
        content: `

            <ul class="list-disc list-inside space-y-1">
                <li>搜索歌曲时添加了防抖时间</li>
                <li>修复了移动端提示框渲染到屏幕外的问题</li>
                <li>整体性能优化</li>
            </ul>
        `
    },
    {
        date: "2026-02-25",
        content: `

            <ul class="list-disc list-inside space-y-1">
                <li>添加了控制导出谱面中曲绘类型的设置</li>
                <li>导出时难度选择中显示谱面定数</li>
                <li>改进了音频播放器获取歌曲的功能</li>
            </ul>
        `
    },
    {
        date: "2026-01-22",
        content: `

            <ul class="list-disc list-inside space-y-1">
                <li>添加了将设置重置为默认值的按钮</li>
                <li>为大量歌曲添加了缺失的别名</li>
                <li>修复了横屏移动设备上的「关于」菜单</li>
            </ul>
        `
    },
    {
        date: "2026-01-19",
        content: `

            <ul class="list-disc list-inside space-y-1">
                <li>文件表格中添加了模糊和低分辨率曲绘</li>
                <li>添加了查看图片分辨率的提示框</li>
                <li>更改了常见问题页面的内容</li>
            </ul>
        `
    },
    {
        date: "2026-01-18",
        content: `

            <ul class="list-disc list-inside space-y-1">
                <li>添加了「关于」页面</li>
                <li>添加了查看/复制歌曲 ID 的提示框</li>
                <li>为 DESTRUCTION 3,2,1 和 Aleph-0 添加了歌曲专属特效</li>
                <li>在 info.txt 和 info.yml 中添加了正确的难度定数</li>
            </ul>
        `
    }
];
//<li></li>
