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

1. **quiz.html（答题页）**：答对5道题后，生成 `access_token` 存入 localStorage，格式为 `base64("时间戳|随机uid|djb2签名")`，有效期 1 小时。
2. **home.html / philzy.html / pmth.html**：页面加载时验证 token，无效则显示「访问受限」弹窗，点击「返回答题页」清除 token 并跳转 quiz.html。
3. **Download/（谱面下载器）**：通过 `AuthGate` 组件验证 token，无效则显示全屏受限页面，点击「前往答题页」跳转 quiz.html。

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
