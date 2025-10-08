# Notion API 530 错误修复指南

## 问题描述

遇到以下错误：
```
NotionAPI collectionQuery error Response code 530 (undefined)
HTTPError: Response code 530 (undefined)
```

这是因为 Notion 加强了 API 访问限制，需要配置访问令牌。

## 解决方案

### 方案 1: 配置 NOTION_ACCESS_TOKEN（推荐）

1. **获取 Notion Token**
   - 打开浏览器，访问 https://www.notion.so
   - 登录你的 Notion 账号
   - 按 F12 打开开发者工具
   - 切换到 Application (或 存储) 标签
   - 在左侧找到 Cookies -> https://www.notion.so
   - 找到名为 `token_v2` 的 cookie，复制它的值

2. **配置环境变量**

   **Vercel 部署：**
   - 进入 Vercel 项目设置
   - 找到 Environment Variables (环境变量)
   - 添加新变量：
     - Name: `NOTION_ACCESS_TOKEN`
     - Value: 粘贴你复制的 token_v2 值
   - 保存后重新部署

   **本地开发：**
   - 在项目根目录创建 `.env.local` 文件
   - 添加以下内容：
     ```
     NOTION_ACCESS_TOKEN=你的token_v2值
     ```

3. **重新部署**
   - Vercel: 在 Deployments 页面点击 Redeploy
   - 本地: 重启开发服务器

### 方案 2: 确保 Notion 数据库公开访问

如果不想配置 token，确保你的 Notion 数据库是公开的：

1. 打开你的 Notion 数据库页面
2. 点击右上角的 "Share" 按钮
3. 开启 "Share to web" 选项
4. 复制链接并确认可以在无痕模式下访问

## 代码改进说明

本次修复对 `lib/notion/getPostBlocks.js` 做了以下改进：

1. **增加了 activeUser 参数处理**：当使用 token 时，正确配置 NotionAPI
2. **改进了重试延迟机制**：
   - 第一次重试：延迟 1.5 秒
   - 第二次重试：延迟 3 秒
   - 第三次重试：延迟 4.5 秒
   - 递增的延迟时间可以更好地应对 Notion 的速率限制

3. **保持了缓存机制**：失败时仍会尝试从缓存读取

## 注意事项

1. **Token 安全性**：
   - 不要将 token_v2 提交到 Git 仓库
   - 定期更换 token（当你修改 Notion 密码时，token 会失效）
   - 只在环境变量中配置

2. **Token 有效期**：
   - token_v2 有效期通常为 1 年
   - 如果突然无法访问，可能需要重新获取

3. **备选方案**：
   - 考虑迁移到 Notion 官方 API (需要较大改动)
   - 使用官方 Integration token (更安全，但需要修改较多代码)

## 相关链接

- GitHub Issue: https://github.com/tangly1024/NotionNext/issues/3563
- Notion 官方 API 文档: https://developers.notion.com/

## 测试

修复后，你应该能看到：
- 日志中显示 `[响应成功]` 而不是 `[响应异常]`
- 网站正常加载 Notion 内容
- 不再出现 530 错误
