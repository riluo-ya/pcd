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
                <li>整体对齐上游最新架构：曲库列表 + 谱面工作区双栏布局。</li>
                <li>新增手机端专属布局，移动端浏览与下载体验重构。</li>
                <li>新增 RPE 谱面格式转换（可在设置中开启）。</li>
                <li>新增 GitHub 令牌鉴权，降低资源请求被限流的概率。</li>
                <li>新增修复版谱面提示、资源错误自动提醒与重试。</li>
                <li>保留本站功能：批量下载面板、分享卡片、歌曲特效、频谱可视化、多加速源切换。</li>
                <li>保留本站功能：答题鉴权与导航中心。</li>
            </ul>
        `
    },
	{
        date: "v2.0.2",
        content: `
            <ul class="list-disc list-inside space-y-1">
                <li>为谱面导出按钮添加了发光效果。</li>
                <li>新增「自动播放音频」选项，开启后自动播放。</li>
                <li>更新了歌曲别名。</li>
            </ul>
        `
    },
	{
        date: "v2.0.1",
        content: `
            <ul class="list-disc list-inside space-y-1">
                <li>改进了单文件表格。</li>
                <li>重新调整了背景色深浅。</li>
                <li>为谱面和单个文件增加了文件大小预览。</li>
            </ul>
        `
    },
	{
        date: "v2.0.0",
        content: `
            <ul class="list-disc list-inside space-y-1">
                <li>界面与下载流程完全重新设计。</li>
                <li>新增关闭模糊效果的选项。</li>
                <li>新增可选的 GitHub 访问令牌设置。</li>
            </ul>
        `
    },
    {
        date: "2026-03-08",
        content: `
            <ul class="list-disc list-inside space-y-1">
                <li>在歌曲选择器中添加了排序按钮。</li>
                <li>添加了「高级信息模式」设置，可查看更详细的信息和提示。</li>
                <li>添加了「批量下载模式」以批量导出资源。（开发中）</li>
            </ul>
        `
    },
    {
        date: "2026-02-28",
        content: `
            <ul class="list-disc list-inside space-y-1">
                <li>在下拉菜单中搜索歌曲时添加了防抖时间。</li>
                <li>修复了移动端提示框渲染到屏幕外的问题。</li>
                <li>整体性能优化。</li>
            </ul>
        `
    },
    {
        date: "2026-02-25",
        content: `
            <ul class="list-disc list-inside space-y-1">
                <li>添加了控制导出谱面中曲绘类型的设置。</li>
                <li>导出谱面时在难度选择中添加了谱面定数。</li>
                <li>改进了音频播放器在获取歌曲时的功能。</li>
                <li>优化了选择歌曲后检查可用谱面难度的逻辑。</li>
            </ul>
        `
    },
    {
        date: "2026-01-22",
        content: `
            <ul class="list-disc list-inside space-y-1">
                <li>添加了将设置重置为默认值的按钮。</li>
                <li>为大量歌曲添加了缺失的别名/缩写。</li>
                <li>修复了横屏移动设备上的「关于」菜单。</li>
            </ul>
        `
    },
    {
        date: "2026-01-19",
        content: `
            <ul class="list-disc list-inside space-y-1">
                <li>在文件表格中添加了模糊和低分辨率曲绘。</li>
                <li>添加了查看所有图片类型分辨率的提示框。</li>
                <li>更改了常见问题页面的内容。</li>
                <li>修复了歌曲 ID 提示框渲染到音频播放器下方的问题。</li>
            </ul>
        `
    },
    {
        date: "2026-01-18",
        content: `
            <ul class="list-disc list-inside space-y-1">
                <li>添加了「关于」页面，包含信息和更新/版本历史。</li>
                <li>添加了查看/复制所选歌曲 ID 的提示框。</li>
                <li>添加了「彩」的 IN 谱面导致 Phira 崩溃的警告。</li>
                <li>为 DESTRUCTION 3,2,1 和 Aleph-0 添加了歌曲专属特效。</li>
                <li>在「info.txt」和「info.yml」中添加了正确的难度定数。</li>
                <li>在设置中启用「歌曲专属特效」时，为带有特效的歌曲添加了指示器。</li>
                <li>改进了 Luminescence 在 iOS 上的烟花着色器。</li>
                <li>更改了某些设置的依赖项和要求。</li>
                <li>更改了设置的默认值。</li>
                <li>修复了文本的语法/格式。</li>
            </ul>
        `
    },
];
//<li></li>
