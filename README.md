# PCD 项目完整包（汉化 + Token 鉴权）

## 项目结构

```
pcd/
├── quiz.html          # 答题页（答对后生成 token，跳转 home.html）
├── home.html          # 导航中心（验证 token，展示卡片链接）
├── philzy.html        # 蓝奏云网盘下载页（验证 token）
├── pmth.html          # Phigros Chart Studio 谱面工坊（验证 token）
├── pcd.data           # 题库加密文件（答题页使用，需自行放入）
├── dl.data            # 导航中心数据加密文件（需自行放入）
├── lz.data            # 蓝奏云数据加密文件（需自行放入）
├── CNAME              # GitHub Pages 自定义域名（可选）
├── Download/          # Vite 项目：Phigros 谱面下载器（已汉化 + 鉴权）
│   ├── src/
│   │   ├── components/AuthGate.tsx   # 访问权限验证组件
│   │   ├── utils/auth.ts              # Token 验证工具
│   │   └── ...                        # 其他汉化后的组件
│   ├── vite.config.ts                 # 已配置输出到 ../dist
│   └── package.json                   # 已配置 build + copy-static
└── .github/workflows/deploy.yml       # GitHub Actions 自动部署
```

## Token 鉴权机制

所有页面共用同一套 token 验证逻辑：

1. **quiz.html（答题页）**：答对5道题后，生成 `access_token` 存入 localStorage，格式为 `base64("时间戳|随机uid|djb2签名")`，有效期 12 小时。
2. **home.html / philzy.html / pmth.html**：页面加载时验证 token，无效则显示「访问受限」弹窗，点击「返回答题页」清除 token 并跳转 quiz.html。
3. **Download/（谱面下载器）**：通过 `AuthGate` 组件验证 token，无效则显示全屏受限页面，点击「前往答题页」跳转 quiz.html。

### 验证后返回原页面

被拦截时，页面会把当前地址通过 `?return_to=` 传给答题页，答完后自动跳回去，
而不是一律落到导航中心。典型场景：扫码打开 `https://pcd.bot.cd/?song=xxx` →
凭证失效被拦 → 答完题直接回到那首歌的下载页。

**例外**：下载站只在带 `?song=` 的分享链接时才原路返回。直接访问下载站首页
被拦的话，答完题会去导航中心（从那里能进谱面下载器，不会停在空白曲库上）。
其他受保护页面（导航中心、蓝奏云、谱面工坊）无论有没有参数都照常回跳。

- 只看当前链接的 `?return_to=`，不读任何本地存储：地址栏里没有就当作没有，不会出现残留的跳转目标。
- 只接受同源、且属于白名单页面（`index.html` / `home.html` / `philzy.html` / `pmth.html`）的返回地址，答题页自身不在其中，避免「弹回 → 答完 → 再弹回」死循环。
- 新增受保护页面时，需同步 `quiz.html` 里的 `ALLOWED_PATHS`。

## 主页选歌筛选

选歌按钮右侧的漏斗图标可按 **难度 / 谱师 / 曲师** 筛选曲库：

- **必须含难度**：可多选 EZ / HD / IN / AT，需同时满足
- **定数区间**：任一难度落在区间内即命中
- **谱师 / 曲师**：从下拉里选，选项带作品数，按作品数降序

按钮上有角标显示生效了几项筛选；下拉顶部会显示当前筛选条件，可一键清除。
筛选与关键词搜索是叠加关系（先在筛选结果里搜）。

> 谱师/曲师的作品数按「歌曲」计，不按「难度条目」计 —— 同一首歌的多个难度
> 都是同一位谱师时只算一首，避免下拉显示 37 却只筛出 24 首。

## 批量下载

在设置里开启「批量下载模式」后，主界面会换成批量面板：先筛选，再勾选，最后打包。

**筛选条件**

| 分类 | 条件 |
|---|---|
| 基础 | 关键词（曲名 / ID / 作曲家 / 谱师）、作曲家包含、谱师包含 |
| 定数 | 区间筛选，可作用于「任一难度 / 最高难度 / 指定难度」 |
| 难度 | 必须含哪些难度（可多选） |
| 安全 | 排除含黑名单谱面的曲目（默认开启） |
| 谱面数据 | BPM、时长、物量、判定线（需解析谱面，勾选后才启用） |

**其他改进**

- 曲目列表可逐条勾选，也可「全选筛选结果」；被筛掉的曲目会自动从选中集合移除
- 支持分批打包（每包 N 首），避免单个巨型压缩包
- 开始前显示摘要：选中多少首、几个包、约多少次请求、预计耗时
- 若选中曲目含黑名单谱面，开始前会统一提示确认，而不是逐首弹窗
- 结束后列出失败文件，可「仅重试失败的曲目」

**注意**：每首歌约 8 次请求（3 张曲绘 + 音频 + 4 个难度谱面）。
GitHub 有非官方限流（约 5000 次/小时），建议保留 0.5 秒以上的歌曲间延迟（默认 0.6 秒）。

## 本地预览

### 方式一：完整打包预览（推荐，模拟线上环境）

```bash
cd Download
npm install
npm run build          # 编译下载器 + 复制所有HTML/data到 ../dist
cd ../dist
npx serve .            # 启动静态服务器
```

访问地址：
- 答题页：`http://localhost:3000/quiz.html`
- 导航中心：`http://localhost:3000/home.html`
- 蓝奏云下载：`http://localhost:3000/philzy.html`
- 谱面工坊：`http://localhost:3000/pmth.html`
- 谱面下载器：`http://localhost:3000/`

### 方式二：开发模式（仅调试下载器）

```bash
cd Download
npm install
npm run dev            # Vite 开发服务器，端口 3000
```

> 注意：开发模式下只有下载器页面，其他HTML页面需要放到 `Download/public/` 目录才能访问。

## 部署到 GitHub Pages

1. 将整个项目推送到 GitHub 仓库
2. 仓库 Settings → Pages → Source 选择 `GitHub Actions`
3. 推送代码到 `main` 分支，自动触发 `.github/workflows/deploy.yml` 构建部署
4. 如有自定义域名，修改 `CNAME` 文件内容

## 注意事项

1. **.data 文件**：`pcd.data`、`dl.data`、`lz.data` 是加密的题库/数据文件，本包未包含，请自行放入项目根目录。
2. **答题页密码**：管理员密码为 `riluoya`（MD5 校验），用于冻结解锁和强制换题。
3. **题库解密密码**：`riluoya`（AES-GCM 解密，PBKDF2 派生密钥，100000 次迭代）。
4. **所有页面必须通过 HTTP 服务器访问**，不能直接双击打开（file:// 协议会禁用 Web Crypto API，导致解密和鉴权失效）。
