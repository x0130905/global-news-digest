# 世界脉搏：全球新闻专题软件与日报邮件系统

这是一个可以直接部署到 GitHub Pages 与 GitHub Actions 的 Node.js 20 项目。它每天汇总过去 24 小时的 GDELT 与公开 RSS，去重、分类、评分并更新深色响应式 Web 软件，也可以通过 Gmail SMTP 发送日报。无 AI Key 时自动使用规则摘要，不会中断。

Web 软件支持手机与电脑、自适应布局、左侧搜索与分类导航、日期选择、永久历史和 PWA 安装。每篇新闻都显示可打开的来源，并可添加“红色·重点、蓝色·跟进、绿色·已读”三类个人标签；标签保存在当前浏览器中，可通过左侧对应分类筛选，再点一次已选标签即可取消。每天自动轮换“全球治理、中国、美国、经济金融、军事安全、科技能源、气候公共安全”七个专题，并至少发布21条合格新闻。英文新闻采用双栏排版：电脑端左英文、右中文，手机端英文在上、中文在下。

> 系统不抓取付费墙正文，不绕过网站限制，只处理公开标题、RSS/公开摘要、来源、时间和链接。`npm run dry-run` 如果实时来源全部不可用，会使用带 `sampleData: true` 标记的内置模拟数据，仅用于验证页面，不会冒充真实新闻或发送邮件。

## 一、最快本地验证

先安装 [Node.js 20 LTS](https://nodejs.org/)；打开“终端/PowerShell”，进入项目目录后依次运行：

```bash
npm install
npm test
npm run dry-run
npm run update-site
npm run preview
```

然后访问 `http://127.0.0.1:4173` 查看成品软件。`npm run update-site` 更新 `public/data`，`npm run preview` 启动本地网站。邮件预览仍位于 `output/latest.html`。`npm start` 是正式发送命令；未配置邮箱时会明确报错，不会声称已发送。

## 二、部署成手机和电脑都能访问的网站

1. 按下一节把项目上传到 GitHub 私有仓库。
2. 打开仓库 **Settings → Pages**。
3. 在 **Build and deployment → Source** 选择 **GitHub Actions**。
4. 打开 **Actions → 更新并部署新闻软件 → Run workflow**，专题留空会自动轮换。
5. 完成后回到 **Settings → Pages**，页面会显示网站地址，通常为 `https://用户名.github.io/仓库名/`。
6. 手机浏览器打开该地址：iPhone Safari 使用“分享 → 添加到主屏幕”；Android Chrome 使用菜单中的“安装应用”。电脑 Chrome/Edge 可点击地址栏右侧安装图标。

以后 GitHub Actions 每天北京时间 08:15 自动抓取、测试并发布。网站不需要邮箱 Secret；只有使用邮件功能时才需要 Gmail 配置。

## 三、创建 GitHub 私有仓库并上传

1. 登录 GitHub，右上角点 **+ → New repository**。
2. Repository name 填 `global-news-digest`，选择 **Private**，不要勾选初始化 README，点 **Create repository**。
3. 在本项目目录打开终端，按 GitHub 新页面的 “push an existing repository” 命令操作，通常是：

```bash
git init
git add .
git commit -m "Initial global news digest"
git branch -M main
git remote add origin https://github.com/你的用户名/global-news-digest.git
git push -u origin main
```

上传前确认 `.env` 没有被提交：运行 `git status` 时不应看到 `.env`。

## 四、准备 Gmail 应用专用密码（仅邮件功能需要）

1. 登录用于发信的 Google 账号，打开 **Google 账号 → 安全性**。
2. 在“您如何登录 Google”中开启 **两步验证**，按页面提示绑定手机或安全密钥。
3. 开启后，在 Google 账号页面搜索 **应用专用密码（App passwords）**。工作/学校账号若被管理员禁用，此入口可能不存在，应改用允许 SMTP 的个人 Gmail 或联系管理员。
4. 新建名称 `Global News Digest`，复制生成的 16 位密码。它不是 Gmail 登录密码，只显示一次。

## 五、添加 GitHub Secrets

进入仓库 **Settings → Secrets and variables → Actions → Secrets → New repository secret**，逐一添加：

| Secret | 必需 | 填写内容 |
|---|---:|---|
| `EMAIL_USER` | 是 | 完整 Gmail 地址，例如 `name@gmail.com` |
| `EMAIL_APP_PASSWORD` | 是 | 上一步的 16 位应用专用密码（空格可去掉） |
| `EMAIL_TO` | 是 | 一个或多个收件人；多个用英文逗号分隔 |
| `GEMINI_API_KEY` | 英文翻译建议必填 | Google AI Studio 创建的 Key |
| `GROQ_API_KEY` | 可作为翻译备用 | Groq Console 创建的 Key |

申请 AI Key：访问 Google AI Studio 或 Groq Console，登录后进入 **API keys → Create API key**，只把 Key 放入 GitHub Secret。免费额度和可用地区可能变化。为保证英文新闻右栏有中文译文，至少配置一个 Key。两个都不填时系统仍可运行，但会诚实显示“等待可靠翻译”，绝不会把英文原样冒充中文翻译；AI 返回非中文结果时也会被校验并拒绝。

## 六、首次手动运行邮件任务

1. 打开仓库 **Actions → 全球新闻日报 → Run workflow**。
2. 第一次保持 **dry_run = true**，点绿色 **Run workflow**。
3. 运行完成后点开该次任务，在页面底部 **Artifacts** 下载 `global-news-digest-*`，检查 HTML、TXT、JSON。
4. 确认内容后再次 **Run workflow**，把 **dry_run** 改为 `false`。只有这次会实际发送。

失败时点开红色任务，展开失败步骤查看脱敏日志；无论成功失败，上传步骤都会尽量保存已生成文件。常见 Gmail 错误是把普通登录密码误当应用专用密码。

## 七、专题、网站更新与邮件时间

网站工作流 `.github/workflows/deploy-site.yml` 默认每天北京时间 08:15 更新。专题按日期自动轮换；编辑 `config/topics.json` 可以增删专题、关键词、颜色与 GDELT 查询。手动运行网站工作流时可填写专题 slug，例如 `technology-energy`。也可以配置变量 `REPORT_TOPIC` 固定专题；留空为自动轮换。

邮件工作流 `.github/workflows/daily-news.yml` 默认每天北京时间 08:00 运行。

工作流已在 `.github/workflows/daily-news.yml` 启用：

```yaml
- cron: "0 0 * * *"
```

这是每天 `00:00 UTC`，即北京时间 `08:00`。GitHub 定时任务可能延后几分钟。仓库必须启用 Actions；私有仓库长期无活动时也应偶尔确认定时任务状态。

修改时间：cron 永远按 UTC。例如北京时间 09:30 对应 `30 1 * * *`。修改 `REPORT_TIMEZONE` 只影响日报日期和每日锁，**不会自动改 cron**，两者应同时调整。

进入 **Settings → Secrets and variables → Actions → Variables → New repository variable** 可以覆盖：

| Variable | 默认值 | 用途 |
|---|---|---|
| `REPORT_TIMEZONE` | `Asia/Shanghai` | 日报日期与发送幂等锁时区 |
| `REPORT_LANGUAGE` | `zh-CN` | 报告语言预留配置 |
| `MAX_GLOBAL_NEWS` | `10` | 全球焦点上限（1–20） |
| `MAX_CHINA_NEWS` | `5` | 中国重点上限（1–10） |
| `MAX_US_NEWS` | `5` | 美国重点上限（1–10） |
| `MIN_DAILY_NEWS` | `21` | 网站每天必须发布的最低新闻数；不足时停止发布并保留上一版 |
| `AI_REQUEST_DELAY_MS` | `6500` | AI 翻译请求间隔，避免免费额度触发限流 |

修改收件人只需更新 Secret `EMAIL_TO`。启用/禁用来源、添加 RSS 请编辑 `config/sources.json`；可靠性权重在 `config/source-reliability.json`；分类词在 `config/keywords.json`。

## 八、安全、稳定性与历史机制

- HTTP 15 秒超时、最多 3 次指数退避、默认并发 5；任一 RSS 或 GDELT 查询失败均被隔离。
- URL 仅允许 HTTP/HTTPS；邮件模板执行 HTML 转义，不含 JavaScript。
- AI 系统提示明确把新闻内容视为不可信数据，只允许依据输入材料生成固定 JSON；返回值还会校验。AI 失败自动降级。
- 每次正式发送成功后才创建 `output/send-lock-YYYY-MM-DD.json`。同一天再次运行会在发信前退出。GitHub Actions 使用并发组避免同一分支重叠运行，并将锁提交回私有仓库。
- `data/history.json` 只保存最近 7 天事件指纹、标题和摘要长度，不含邮箱或密钥。完全重复事件跳过；有新增标题/摘要信息的事件可再次进入日报，并显示【持续关注】和“本次新增进展”。
- `public/data/archive/` 按日期永久保存公开新闻快照，`index.json` 维护日期索引；没有自动删除时间，不包含任何邮箱或密钥。
- 密钥只从环境变量读取，日志会对密码、Key、Token 字段脱敏。

## 九、项目命令与结构

```bash
npm install       # 安装并生成/更新 package-lock.json
npm test          # 运行全部单元与集成测试
npm run dry-run   # 仅生成 output 成品，绝不发信
npm run update-site # 抓取并更新 public/data 网站数据
npm run preview   # 在 http://127.0.0.1:4173 预览软件
npm start         # 正式运行；按 DRY_RUN 决定是否发信
```

源码按 `fetchers`、`processing`、`summarizers`、`email` 和 `utils` 分层；配置集中在 `config`；测试位于 `tests`；工作流位于 `.github/workflows/daily-news.yml`。仓库同时包含 `pnpm-lock.yaml` 供 GitHub Actions 冻结依赖版本；普通用户仍可使用上面的 npm 命令。

## 十、免责声明

自动摘要可能遗漏语境。突发、战争、外交争议信息应打开交叉来源核验。日报不构成投资、法律、医疗或安全决策建议。
