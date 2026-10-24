# SIGNAL — 二次开发说明

本目录是 **第三方项目的二次开发版本**，不是 PCD 原创。

## 来源

| 项 | 内容 |
|---|---|
| 原项目 | [Lylighte/signal-replica](https://github.com/Lylighte/signal-replica) |
| 原作者 | Lylighte |
| 原许可证 | MIT（见 `LICENSE-SIGNAL.md`） |
| 字体 | Saira，SIL Open Font License 1.1（见 `assets/OFL.txt`） |
| 原 README | 见 `README-SIGNAL.md` |

## PCD 做了哪些改动（二改内容）

1. **接入答题验证**
   在 `index.html` 的 `<head>` 内同步注入一段校验脚本，验证 `access_token`
   （时间戳 + djb2 签名，12 小时有效，算法与 `home.html` / `philzy.html` /
   `pmth.html` / 下载站完全一致）。未通过时显示「访问受限」遮罩，并提供
   「前往答题」（带 `?return_to=` 原路返回）与「返回导航中心」两个出口。

2. **页面底部署名**
   右下角固定显示来源：原项目仓库链接 + 「由 PCD 二次开发并接入验证」。
   原先指向原仓库的 GitHub 链接保留未动。

3. **答题页白名单同步**
   `quiz.html` 的回跳白名单新增 `/signal/` 与 `/signal/index.html`，
   并修正了子目录页面会被误判成「下载站首页」的问题（详见该文件注释）。

4. **导航中心新增入口**
   `dl.data`（导航数据）中新增一条指向 `./signal/` 的卡片。

5. **新增 MP4 导出（本次新增）**
   原项目只能导出 PNG 帧序列 ZIP。为满足「直接拿到带声音的视频」，新增两个文件：

   | 文件 | 作用 |
   |---|---|
   | `mp4-muxer.js` | 把 H.264 / AAC 裸流封装成标准 MP4（ISO BMFF），纯本地、无第三方依赖 |
   | `video-export.js` | 用 WebCodecs 把画面编成 H.264、音轨编成 AAC，再交给 muxer 封装 |

   均为**新增文件，未修改原导出逻辑**，`frame-export.js`（PNG 序列）原样保留。
   为了挂载这两个新模块，`index.html` 与 `studio.js` 各有一处小改动：
   前者在导出对话框增加「导出格式 / 包含音频 / 视频码率」三个控件，
   后者按格式分发到 `exportVideo` 或 `exportFrameZip`。

   实现要点：
   - 全程浏览器本地编码，不上传任何数据
   - 每秒一个关键帧，拖动进度条可快速定位
   - 音轨按导出区间裁剪，与画面对齐
   - **运行时探测 AAC 编码能力**：并非所有 Chromium 构建都带 AAC 编码器，
     不支持时会禁用「包含音频」并给出说明，而不是悄悄导出无声视频

未改动的其他原始文件（`engine.js`、`design.js`、`config.js`、
`default-settings.js`、`editor-data.js`、`screen-curve.js`、
`frame-export.js`、`assets/`）均保持原样，以便后续跟随上游更新。

## 上游同步建议

上游更新时，只需覆盖 `dist/` 下的原始文件，然后重新补上这几处注入即可：

1. `index.html`：闸门脚本、底部署名、导出对话框的三个新控件
2. `studio.js`：`exportVideo` 的 import 与按格式分发

新增的 `mp4-muxer.js` 与 `video-export.js` 是 PCD 自己的文件，不受上游覆盖影响。
原始文件本身无需差异合并。

## 归属与免责

- 本目录代码的著作权归原作者 Lylighte 所有，依 MIT 许可证使用。
- MIT 要求保留版权声明与许可声明，上方「来源」表与 `LICENSE-SIGNAL.md`
  即为履行该义务，请勿删除。
- PCD 与 signal-replica 原作者不存在授权、合作或运营关系。
