/**
 * @file 存储常量
 */

import { useWebExtensionStorage } from '~/composables/useWebExtensionStorage'
import type { ICodeBlock } from '~/interface'
import { RecState, OPTIONS } from '~/constants'

// 录制状态
export const recStatus = useWebExtensionStorage('rec-state', RecState.Off)

// 代码块
export const codeBlocks = useWebExtensionStorage('code-blocks', [] as ICodeBlock[])

const options = OPTIONS.map(item => item.value)

// 当前的选项配置
export const optionList = useWebExtensionStorage('options', options)

// 当前选择的选择器
export const curSelectors = useWebExtensionStorage('selectors', options)
