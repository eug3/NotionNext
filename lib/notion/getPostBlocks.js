import BLOG from '@/blog.config'
import { getDataFromCache, setDataToCache } from '@/lib/cache/cache_manager'
import { deepClone, delay } from '../utils'
import { NotionAPI } from 'notion-client'

const authToken = BLOG.NOTION_ACCESS_TOKEN || BLOG.NOTION_TOKEN_V2 || null
const activeUser = BLOG.NOTION_ACTIVE_USER || null
const apiBaseUrl = BLOG.NOTION_API_BASE_URL || undefined

// 调试信息
console.log('🔑 [Token Debug] NOTION_ACCESS_TOKEN:', BLOG.NOTION_ACCESS_TOKEN ? '已设置' : '未设置')
console.log('🔑 [Token Debug] NOTION_TOKEN_V2:', BLOG.NOTION_TOKEN_V2 ? `已设置 (长度: ${BLOG.NOTION_TOKEN_V2.length}, 前缀: ${BLOG.NOTION_TOKEN_V2.substring(0, 10)}...)` : '未设置')
console.log('🔑 [Token Debug] 实际使用的 authToken:', authToken ? `已设置 (长度: ${authToken.length}, 前缀: ${authToken.substring(0, 10)}...)` : 'null')
console.log('🔑 [Token Debug] activeUser:', activeUser || '未设置')
console.log('🔑 [Token Debug] apiBaseUrl:', apiBaseUrl || '使用默认值 (https://www.notion.so/api/v3)')

// 使用环境变量配置的 API URL (如果设置)
// 用于绕过 Notion/Cloudflare DNS 530 错误 - https://github.com/NotionX/react-notion-x/issues/669
const api = new NotionAPI({
  ...(apiBaseUrl && { apiBaseUrl }),
  authToken,
  activeUser
})

export async function getPostBlocks(id, from, slice) {
  const cacheKey = 'page_block_' + id
  let pageBlock = await getDataFromCache(cacheKey)
  if (pageBlock) {
    console.log('[命中缓存]:', `from:${from}`, cacheKey)
    return filterPostBlocks(id, pageBlock, slice)
  }

  const start = new Date().getTime()
  pageBlock = await getPageWithRetry(id, from)
  const end = new Date().getTime()
  console.log('[API耗时]', `${end - start}ms`)

  if (pageBlock) {
    await setDataToCache(cacheKey, pageBlock)
    return filterPostBlocks(id, pageBlock, slice)
  }
  return pageBlock
}

/**
 * 调用接口，失败会重试
 * @param {*} id
 * @param {*} retryAttempts
 */
export async function getPageWithRetry(id, from, retryAttempts = 3) {
  if (retryAttempts && retryAttempts > 0) {
    console.log('[请求API]', `from:${from}`, `id:${id}`, retryAttempts < 3 ? `剩余重试次数:${retryAttempts}` : '')
    try {
      const start = new Date().getTime()
      const pageData = await api.getPage(id)
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

/**
 * 获取到的blockMap删除不需要的字段
 * @param {*} id 页面ID
 * @param {*} pageBlock 页面元素
 * @param {*} slice 截取数量
 * @returns
 */
function filterPostBlocks(id, pageBlock, slice) {
  const clonePageBlock = deepClone(pageBlock)
  let count = 0

  for (const i in clonePageBlock?.block) {
    const b = clonePageBlock?.block[i]
    if (slice && slice > 0 && count > slice) {
      delete clonePageBlock?.block[i]
      continue
    }
    count++
    // 处理 c++、c#、汇编等语言名字映射
    if (b?.value?.type === 'code') {
      if (b?.value?.properties?.language?.[0][0] === 'C++') {
        b.value.properties.language[0][0] = 'cpp'
      }
      if (b?.value?.properties?.language?.[0][0] === 'C#') {
        b.value.properties.language[0][0] = 'csharp'
      }
      if (b?.value?.properties?.language?.[0][0] === 'Assembly') {
        b.value.properties.language[0][0] = 'asm6502'
      }
    }

    delete b?.role
    delete b?.value?.version
    delete b?.value?.created_by_table
    delete b?.value?.created_by_id
    delete b?.value?.last_edited_by_table
    delete b?.value?.last_edited_by_id
    delete b?.value?.space_id
  }

  // 去掉不用的字段
  if (id === BLOG.NOTION_PAGE_ID) {
    return clonePageBlock
  }
  return clonePageBlock
}
