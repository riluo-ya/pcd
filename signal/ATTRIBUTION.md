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

除此之外**未改动任何原始文件**（`studio.js`、`engine.js`、`design.js`、
`config.js`、`default-settings.js`、`editor-data.js`、`screen-curve.js`、
`frame-export.js`、`styles.css`、`assets/` 均保持原样），以便后续跟随上游更新。

## 上游同步建议

上游更新时，只需覆盖 `dist/` 下的原始文件，然后重新在 `index.html` 中
补上「① 闸门脚本 ② 底部署名」这两处注入即可。原始文件本身无需差异合并。

## 归属与免责

- 本目录代码的著作权归原作者 Lylighte 所有，依 MIT 许可证使用。
- MIT 要求保留版权声明与许可声明，上方「来源」表与 `LICENSE-SIGNAL.md`
  即为履行该义务，请勿删除。
- PCD 与 signal-replica 原作者不存在授权、合作或运营关系。
