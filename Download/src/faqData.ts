export interface FAQEntry {
  question: string;
  // Fix: Changed answer type from React.ReactNode to string to avoid JSX in a .ts file.
  answer: string;
}
export const faqData: FAQEntry[] = [
  {
    question: "如何下载谱面以在 Phira 或 RPE 中使用？",
    answer: "首先，从下拉菜单中选择一首歌曲。其次，选择一个可用的难度（EZ、HD、IN 或 AT）。第三，点击「导出为谱面」按钮。",
  },
   {
    question: "哪些程序可以使用这些文件？",
    answer: "游玩方面，Phira 有不错的支持，但在某些谱面中可能会出现视觉 bug。如果你不介意的话，phi-sim 有完美的支持，但它只能在网页浏览器中运行且非常老旧。编辑方面，RPE 有不错的支持；只是不要尝试保存谱面，否则它会尝试将其转换为 100MB 的 RPE json。其他编辑器如 phichain 也可能支持官方格式。",
  },
  {
    question: "什么是 PEZ 文件？",
    answer: "PEZ 文件是 Phi Edit ZIP（PEZ）；本质上就是一个简单的 ZIP 文件。大多数程序应该能检测并处理这种文件类型，但你可以在设置中将导出的文件扩展名改为通用的 ZIP。",
  },
  {
    question: "为什么较新的歌曲没有出现在这里？",
    answer: "本网站依赖于第三方 GitHub 仓库。如果他们没有添加较新的内容，这里就不会显示。",
  },
  {
    question: "网站坏了，无法正常工作。",
    answer: '确保你可以访问 GitHub，并且没有被限流或封锁。同时检查任何浏览器扩展，如广告拦截器和隐私保护工具，它们可能会阻止 GitHub 原始文件。',
  },
    {
    question: "为什么没有愚人节或 Legacy 谱面？",
    answer: '本项目旨在与最新版本的 Phigros 同步。此外，愚人节谱面的歌曲 ID 等通常很奇怪，将它们整合到本网站中会很麻烦。',
  },
];
