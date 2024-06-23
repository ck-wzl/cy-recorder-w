/* eslint-disable no-console */
import { onMessage } from 'webext-bridge/background'
import type { Runtime, Tabs, WebNavigation } from 'webextension-polyfill'
import CodeOperation from '~/helper/codeOperation'
import { handleCreateBlock, handleUrlEvent, handleVisitEvent } from '~/helper/codeGenerator'
import { ActionState, EventType, RecState } from '~/constants'
import type { ParsedEvent } from '~/interface'
import { recStatus } from '~/storage'

// only on dev mode
if (import.meta.hot) {
  // @ts-expect-error for background HMR
  import('/@vite/client')
  import('./contentScriptHMR')
}

let lastURL = ''

let originalHost = ''

let activePort: Runtime.Port | null = null

const oper = new CodeOperation()

console.log('background recStatus', recStatus.value)
watch(() => recStatus.value, () => {
  console.log('background recStatus 改变了', recStatus.value)
})

// 处理即将发生导航时触发事件，断开之前的端口连接
const handleBeforeNavigateEvent = (details?: WebNavigation.OnBeforeNavigateDetailsType): void => {
  if (activePort && (!details || details.frameId === 0)) {
    activePort.disconnect()
    activePort = null
  }
}

// 处理导航提交时的触发事件
const handleCommitNavigationEvent = (details: WebNavigation.OnCommittedDetailsType): void => {
  const isMainFrame = details.frameId === 0
  const isDifferentHost = !details.url.includes(originalHost ?? '')
  const isFromForwardBack = details.transitionQualifiers.includes('forward_back')
  const isFromAddressBar = details.transitionQualifiers.includes('from_address_bar')
  if (isMainFrame && (isDifferentHost || isFromForwardBack || isFromAddressBar)) {
    stopRecord()
  } else if (!isDifferentHost) {
    if (recStatus.value !== RecState.On) {
      console.log('[onCommitted]当前已经暂停录制')
      return
    }
    const urlBlock = handleUrlEvent(details.url)
    oper.addCodeBlock(urlBlock)
  }
}

// 处理当页面的DOM已完全构建时触发事件
const handleDOMLoadedEvent = (details?: WebNavigation.OnDOMContentLoadedDetailsType): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!details || details.frameId === 0) {
      browser.tabs.query({ active: true, currentWindow: true }).then(([tab]: Tabs.Tab[]) => {
        browser.scripting.executeScript({
          target: { tabId: details?.tabId ?? tab.id ?? activePort?.sender?.tab?.id ?? 0 },
          files: ['dist/contentScripts/index.global.js']
        }).then(() => {
          if (browser.runtime.lastError) {
            console.error('[cypress-recorder][background]注入脚本报错：', browser.runtime.lastError)
            reject(browser.runtime.lastError)
          } else {
            console.log('[cypress-recorder][background]注入脚本成功')
            resolve()
          }
        })
      })
    } else {
      resolve()
    }
  })
}

// 处理事件监听
const handleEventMessage = async (event: ParsedEvent) => {
  if (recStatus.value !== RecState.On) {
    console.log('当前已经暂停录制')
    return
  }

  try {
    const block = await handleCreateBlock(event)
    if (block !== null) {
      if (event.action === EventType.DblClick) {
        await oper.popTwoCodeBlock()
        await oper.addCodeBlock(block)
      } else {
        await oper.addCodeBlock(block)
      }
    }
  } catch (err) {
    console.error('处理事件时出错:', err)
  }
}

const startRecord = async () => {
  try {
    await handleDOMLoadedEvent()
    await oper.updateState(RecState.On)
    await browser.action.setBadgeText({ text: 'rec' })
  } catch (err) {
    console.error('开始录制时出错:', err)
  }
}

const stopRecord = async () => {
  try {
    await handleBeforeNavigateEvent()
    browser.webNavigation.onDOMContentLoaded.removeListener(handleDOMLoadedEvent)
    browser.webNavigation.onCommitted.removeListener(handleCommitNavigationEvent)
    browser.webNavigation.onBeforeNavigate.removeListener(handleBeforeNavigateEvent)
    await oper.updateState(RecState.Paused)
    activePort = null
    originalHost = ''
    await browser.action.setBadgeText({ text: 'wait' })
  } catch (err) {
    console.error('停止录制时出错:', err)
  }
}

const resetRecord = async () => {
  try {
    lastURL = ''
    await oper.resetState()
    await browser.action.setBadgeText({ text: '' })
  } catch (err) {
    console.error('重置录制时出错:', err)
  }
}

const clearUp = async () => {
  try {
    await handleBeforeNavigateEvent()
  } catch (err) {
    console.error('清理时出错:', err)
  }
}

browser.runtime.onInstalled.addListener(() => { console.log('Extension installed') })

browser.runtime.onConnect.addListener((port: Runtime.Port) => {
  activePort = port
  activePort.onMessage.addListener(handleEventMessage)

  if (recStatus.value !== RecState.On) {
    originalHost = port.name

    browser.webNavigation.onBeforeNavigate.addListener(handleBeforeNavigateEvent)
    browser.webNavigation.onCommitted.addListener(handleCommitNavigationEvent)
    browser.webNavigation.onDOMContentLoaded.addListener(handleDOMLoadedEvent)

    if (port.sender && port.sender.url && lastURL !== port.sender.url) {
      lastURL = port.sender.url
      if (recStatus.value === RecState.Paused) {
        console.log('[onConnect]当前已经暂停录制')
        return
      }

      const visitBlock = handleVisitEvent(port.sender.url)
      oper.addCodeBlock(visitBlock)
    }
  }
})

// 接受来自popup的popup-action-message消息
onMessage<ActionState, 'popup-action-message'>('popup-action-message', async (message) => {
  console.log('[cypress-recorder][background]接受来自popup的action消息: ', message)

  const actionData = message.data
  switch (actionData) {
    case ActionState.Start:
    case ActionState.Resume:
      await startRecord()
      break

    case ActionState.Pause:
      await stopRecord()
      break

    case ActionState.Reset:
      await resetRecord()
      break

    default:
      console.error(`[cypress-recorder][background]未捕获的操作：${actionData}`)
      break
  }
})

clearUp()