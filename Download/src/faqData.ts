export interface FAQEntry {
  question: string;
  // Fix: Changed answer type from React.ReactNode to string to avoid JSX in a .ts file.
  answer: string;
}
export const faqData: FAQEntry[] = [
    {
        question: "如何下载谱面以在 Phira 或 RPE 中使用？",
        answer: "从左侧列表选择一首歌曲，选好难度（EZ / HD / IN / AT），然后点「导出为谱面」即可。不指定难度时会导出这首歌的全部难度。",
    },
    {
        question: "哪些程序可以使用这些文件？",
        answer: "游玩方面，Phira 有不错的支持，但在某些谱面中可能会出现视觉 bug。编辑方面，RPE 有不错的支持；只是不要尝试保存谱面，否则它会尝试转换为体积很大的 RPE json。其他编辑器如 phichain 也可能支持官方格式。",
    },
    {
        question: "什么是 PEZ 文件？",
        answer: "PEZ 文件是 Phi Edit ZIP（PEZ），本质上就是一个 ZIP 包。大多数程序都能识别处理，也可以在设置里把导出扩展名改成通用的 ZIP。",
    },
    {
        question: "为什么较新的歌曲没有出现在这里？",
        answer: "本网站依赖第三方 GitHub 仓库。如果上游还没有收录较新的内容，这里就不会显示。",
    },
    {
        question: "网站坏了，无法正常工作。",
        answer: "确保可以访问 GitHub，且没有被限流或封锁。同时检查浏览器扩展，如广告拦截器和隐私保护工具，它们可能会阻止 GitHub 原始文件。也可以试试在设置里切换加速源。",
    },
    {
        question: "为什么没有愚人节谱面和旧版（Legacy）谱面？",
        answer: "这类谱面已经有不少专门的获取渠道，比如",
        links: [
                { text: "这个 Google 云端硬盘文件夹", url: "https://drive.google.com/drive/folders/1LcJ2Ublu6TNNTqUph61ItzGwJTqG-IQu" }
        ],
    }
];
