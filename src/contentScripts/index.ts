/* eslint-disable no-console */
import type { Runtime } from 'webextension-polyfill'
import { finder, Options } from '@medv/finder'
import { EventType } from '~/constants'
import type { ParsedEvent } from '~/interface'
import { curSelectors, optionList } from '~/storage'

let curPort: Runtime.Port

// 生成格式化的数据
const getFormattedValue = (event: Event): Promise<ParsedEvent> => {
  return new Promise((resolve) => {
    let curSelector = ""

    // 当前的选择器，一个一个的遍历selectorList
    for (const item of curSelectors.value) {
      if ((event.target as Element).hasAttribute(item)) {
        curSelector = `[${item}=${(event.target as Element).getAttribute(item)}]`
        break
      }
    }

    // 如果没有上面的自定义选择器，就使用finder来生成
    if (!curSelector) {
      const finderConfig: Options = {
        root: document.body,
        idName: () => true,
        className: () => true,
        tagName: () => true,
        attr: (name) => optionList.value.includes(name),
        seedMinLength: 1,
        optimizedMinLength: 2,
        threshold: 1_000,
        maxNumberOfTries: 10_000,
        timeoutMs: void 0,
      }

      curSelector = finder(event.target as Element, finderConfig)
    }

    const parsedEvent: ParsedEvent = {
      selector: curSelector,
      action: event.type,
      tag: (event.target as Element).tagName,
      value: (event.target as HTMLInputElement).value,
    }

    if ((event.target as HTMLAnchorElement).hasAttribute('href')) {
      parsedEvent.href = (event.target as HTMLAnchorElement).href
    }

    if ((event.target as Element).hasAttribute('id')) {
      parsedEvent.id = (event.target as Element).id
    }

    if (parsedEvent.tag === 'INPUT') {
      parsedEvent.inputType = (event.target as HTMLInputElement).type
    }

    if (event.type === 'keydown') {
      parsedEvent.key = (event as KeyboardEvent).key
    }

    resolve(parsedEvent)
  })
}

// 处理监听事件的事件
const handleEventListener = async (event: Event) => {
  // 用户实际操作的事件
  if (event.isTrusted !== true) {
    return
  }

  const eventObject = await getFormattedValue(event)

  try {
    curPort.postMessage(eventObject)
  } catch (err) {
    console.error('添加/移除DOM监听事件报错:', err)
  }
}

// 给DOM添加监听事件
const addDOMListeners = () => {
  Object.values(EventType).forEach((event) => {
    document.addEventListener(event, handleEventListener, { capture: true, passive: true })
  })
}

// 给DOM移除监听事件
const removeDOMListeners = () => {
  Object.values(EventType).forEach((event) => {
    document.removeEventListener(event, handleEventListener, { capture: true })
  })
}

(() => {
  console.log(`[cypress-recorder][content]${new Date().toLocaleString()}已加载`)

  curPort = browser.runtime.connect({ name: window.location.hostname })

  // 当端口与另一端断开连接时触发，移除事件监听器
  curPort.onDisconnect.addListener(removeDOMListeners)

  // 给DOM添加事件监听
  addDOMListeners()
})()
