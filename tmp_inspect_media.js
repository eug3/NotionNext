const { NotionAPI } = require('notion-client')

async function main() {
  const pageId = 'c2f9a06b-4e9b-4d35-9c8a-2c25b46e9d2b'
  const api = new NotionAPI({})
  const recordMap = await api.getPage(pageId)
  const blocks = recordMap.block || {}
  const keys = Object.keys(blocks)
  let count = 0

  for (const id of keys) {
    const entry = blocks[id]
    const value = entry?.value?.value || entry?.value
    const type = value?.type
    if (['image', 'file', 'video', 'pdf', 'embed', 'external_object_instance'].includes(type)) {
      count++
      const src = value?.properties?.source?.[0]?.[0]
      const display = value?.format?.display_source
      const fileIds = value?.file_ids
      console.log('---')
      console.log('id:', id)
      console.log('type:', type)
      if (src) console.log('source:', src)
      if (display) console.log('display_source:', display)
      if (fileIds) console.log('file_ids:', JSON.stringify(fileIds))
      console.log('keys:', Object.keys(value || {}).slice(0, 30).join(','))
    }
  }

  console.log('media-like blocks:', count)
}

main().catch(err => {
  console.error('ERR', err?.message)
})
