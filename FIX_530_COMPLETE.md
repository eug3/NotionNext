# Notion 530 错误完整修复方案

## 问题分析

530 错误是 Notion API 的 `collectionQuery` 请求失败，原因是：
1. **Notion API 访问策略变更**：需要使用 token 认证
2. **项目缺少全局 NotionAPI 单例**：官方项目使用统一的 API 实例
3. **Token 配置错误**：需要使用 `NOTION_TOKEN_V2` 而不是 `NOTION_ACCESS_TOKEN`

## 修复步骤

### ✅ 1. 创建全局 NotionAPI 实例

创建文件：`lib/notion/getNotionAPI.js`

```javascript
import { NotionAPI as NotionLibrary } from 'notion-client'
import BLOG from '@/blog.config'

const notionAPI = getNotionAPI()

function getNotionAPI() {
  return new NotionLibrary({
    activeUser: BLOG.NOTION_ACTIVE_USER || null,
    authToken: BLOG.NOTION_ACCESS_TOKEN || BLOG.NOTION_TOKEN_V2 || null,
    userTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  })
}

export default notionAPI
```

### ✅ 2. 更新 `blog.config.js`

添加 NOTION_TOKEN_V2 配置：

```javascript
  // 开发相关
  NOTION_ACCESS_TOKEN: process.env.NOTION_ACCESS_TOKEN || '',
  NOTION_TOKEN_V2: process.env.NOTION_TOKEN_V2 || '', // Notion token v2 用于访问私有数据库
  NOTION_ACTIVE_USER: process.env.NOTION_ACTIVE_USER || '',
  DEBUG: process.env.NEXT_PUBLIC_DEBUG || false,
```

### ✅ 3. 更新 `lib/notion/getPostBlocks.js`

使用全局 notionAPI 实例：

```javascript
// 修改 import
import notionAPI from '@/lib/notion/getNotionAPI'

// 修改 getPageWithRetry 函数
export async function getPageWithRetry(id, from, retryAttempts = 3) {
  if (retryAttempts && retryAttempts > 0) {
    console.log('[请求API]', `from:${from}`, `id:${id}`, retryAttempts < 3 ? `剩余重试次数:${retryAttempts}` : '')
    try {
      const start = new Date().getTime()
      const pageData = await notionAPI.getPage(id)
      const end = new Date().getTime()
      console.info('[响应成功]:', `耗时:${end - start}ms`, `from:${from}`)
      return pageData
    } catch (e) {
      console.warn('[响应异常]:', e)
      // 增加延迟时间，根据剩余重试次数递增延迟
      const delayTime = (4 - retryAttempts) * 1500
      await delay(delayTime)
      const cacheKey = 'page_block_' + id
      const pageBlock = await getDataFromCache(cacheKey)
      if (pageBlock) {
        console.log('[重试缓存]', `from:${from}`, `id:${id}`)
        return pageBlock
      }
      return await getPageWithRetry(id, from, retryAttempts - 1)
    }
  } else {
    console.error('[请求失败]:', `from:${from}`, `id:${id}`)
    return null
  }
}
```

### ✅ 4. 更新 `lib/notion/getPageProperties.js`

使用全局 notionAPI 实例：

```javascript
// 修改 import
import notionAPI from '@/lib/notion/getNotionAPI'

// 修改 person 类型处理
case 'person': {
  const rawUsers = val.flat()
  const users = []

  for (let i = 0; i < rawUsers.length; i++) {
    if (rawUsers[i][0][1]) {
      const userId = rawUsers[i][0]
      const res = await notionAPI.getUsers(userId)
      // ...
    }
  }
}
```

### ✅ 5. 配置环境变量

#### 方式一：使用 token_v2 (推荐)

在 `.env.local` 中：

```bash
NOTION_TOKEN_V2=你的token_v2值
```

获取 token_v2:
1. 访问 https://www.notion.so 并登录
2. F12 → Application → Cookies → https://www.notion.so
3. 复制 `token_v2` 的值

#### 方式二：使用 NOTION_ACCESS_TOKEN

如果你使用的是官方 Integration Token：

```bash
NOTION_ACCESS_TOKEN=secret_xxx你的官方token
```

## 对比官方方案

### 官方项目特点：
1. ✅ 使用全局 NotionAPI 单例 (`lib/notion/getNotionAPI.js`)
2. ✅ 支持 `NOTION_TOKEN_V2` 和 `NOTION_ACCESS_TOKEN`
3. ✅ 统一的时区配置
4. ✅ 更完善的错误处理和重试机制

### 我们的修复：
1. ✅ 创建了全局 NotionAPI 实例
2. ✅ 添加了 NOTION_TOKEN_V2 支持
3. ✅ 改进了重试延迟机制（递增延迟）
4. ✅ 保持向后兼容

## 测试

重启开发服务器：

```powershell
# 停止当前服务（Ctrl+C）
pnpm dev
```

成功的标志：
- ✅ 看到 `[响应成功]` 日志
- ✅ 不再出现 530 错误  
- ✅ 页面正常加载 Notion 内容

## 常见问题

### Q1: 仍然出现 530 错误？

检查:
1. Token 是否正确复制（不要有多余空格）
2. Notion 数据库是否设置为公开或已授权
3. Token 是否过期（重新登录 Notion 获取新 token）

### Q2: ReferenceError: NotionAPI is not defined？

确保：
1. `lib/notion/getNotionAPI.js` 文件已创建
2. 所有引用都改为 `import notionAPI from '@/lib/notion/getNotionAPI'`
3. 重启开发服务器

### Q3: Token 多久过期？

- `token_v2`: 通常 1 年
- 修改 Notion 密码后会立即失效
- 官方 Integration Token: 不过期（除非手动撤销）

## 总结

本次修复的核心改进：

1. **架构层面**：引入全局 NotionAPI 单例，符合官方最佳实践
2. **配置层面**：支持 NOTION_TOKEN_V2，解决认证问题
3. **容错层面**：递增延迟重试，提高成功率
4. **兼容层面**：向后兼容，支持多种配置方式

参考：
- 官方项目：https://github.com/tangly1024/NotionNext
- Issue #3563: https://github.com/tangly1024/NotionNext/issues/3563
