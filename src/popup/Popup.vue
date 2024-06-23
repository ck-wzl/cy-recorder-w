<template>
    <main class="popup-main">
        <!-- 顶部 -->
        <div class="head-main">
            <h1 class="head-title">Cypress Recorder</h1>
            <a-button class="option-button" size="small" shape="circle" :icon="h(SettingOutlined)" title="设置"
                @click="openOptionPage" />
        </div>

        <!-- 主体 -->
        <div class="body-main">
            <div v-if="!!showTipsText" class="empty-box">{{ showTipsText }}</div>
            <ul v-else class="code-main">
                <li v-for="(item, index) of codeBlocks" :key="index" class="code-block">
                    <span class="index-item">{{ index + 1 }}</span>
                    <div class="item-block">
                        <div class="code-item">{{ item.code }}</div>
                        <div class="prompt-item">{{ item.prompt }}</div>
                    </div>
                </li>
            </ul>
        </div>

        <!-- 底部 -->
        <div class="foot-main">
            <a-button class="toggle-button" size="small" :disabled="!isValidTab" @click="handleClickToggle">
                {{ toggleText }}
            </a-button>

            <a-button v-if="showResetOrCopyButton" class="reset-button" size="small" :disabled="!isValidTab"
                @click="handleClickReset">
                Reset
            </a-button>

            <span v-if="!!copyTip" :class="['copy-tip', copyColor]">{{ copyTip }}</span>

            <a-button v-if="showResetOrCopyButton" class="copy-code-button" size="small" :disabled="disabledCopyButton"
                @click="handleClickCopyCode">
                Copy Code
            </a-button>

            <a-button v-if="showResetOrCopyButton" class="copy-prompt-button" size="small"
                :disabled="disabledPromptButton" @click="handleClickCopyPrompt">
                Copy Prompt
            </a-button>
        </div>
    </main>
</template>

<script setup lang="ts">
/**
 * @file Popup组件主入口
 */

import { h } from 'vue'
import { SettingOutlined } from '@ant-design/icons-vue'
import { sendMessage } from 'webext-bridge/popup'
import { ActionState, ContentType, RecState } from '~/constants'
import { recStatus, codeBlocks } from '~/storage'
import { isForbiddenUrl } from '~/env'
import type { Tabs } from 'webextension-polyfill'

// 是否是合格的tab
const isValidTab = ref(true)

// 复制的提示文本
const copyTip = ref('')

// 复制文本的颜色样式
const copyColor = ref('')

// 复制的timer
const copyTimerId = ref<NodeJS.Timeout | null>(null)

// 是否展示提示文本
const showTipsText = computed(() => {
    if (!isValidTab.value) return 'The current page does not support recording operations'
    if (codeBlocks.value.length === 0 && recStatus.value === RecState.Off) return 'Click [Start] to start recording your operation'
    return ''
})

// 切换按钮的文本
const toggleText = computed(() => {
    if (!isValidTab) return 'Invalid Tab'

    switch (recStatus.value) {
        case RecState.On:
            return 'Pause'

        case RecState.Off:
            return 'Start'

        case RecState.Paused:
            return "Resume"

        default:
            return "Unknown State"
    }
})

// 是否显示重置按钮或复制按钮
const showResetOrCopyButton = computed(() => isValidTab && recStatus.value === RecState.Paused)

// 是否禁用复制代码的按钮
const disabledCopyButton = computed(() => {
    const codeList = codeBlocks.value.map(item => item.code)
    return !isValidTab || !codeList.length
})

// 是否禁用复制代码的按钮
const disabledPromptButton = computed(() => {
    const promptList = codeBlocks.value.map(item => item.prompt)
    return !isValidTab || !promptList.length
})

// 切换按钮点击事件
const handleClickToggle = () => {
    switch (recStatus.value) {
        case RecState.On:
            handleToggle(ActionState.Pause)
            break

        case RecState.Off:
            handleToggle(ActionState.Start)
            break

        case RecState.Paused:
            handleToggle(ActionState.Resume)

        default:
            break
    }
}

// 重置按钮点击事件
const handleClickReset = () => {
    handleToggle(ActionState.Reset)
}

// 复制内容到剪贴板
const copyToClipboard = async (type: ContentType) => {
    try {
        const toBeCopied = codeBlocks.value.map(item => item[type]).join('\n')
        await navigator.clipboard.writeText(toBeCopied)
        return true
    } catch (error) {
        console.error('[cypress-recorder][popup]复制报错：', error)
        return false
    }
}

// 处理复制提示文本的事件
const handleCopyTip = (type: ContentType, isSuccess: boolean) => {
    if (copyTimerId.value) {
        copyTip.value = ''
        clearTimeout(copyTimerId.value)
        copyTimerId.value = null
    }

    copyColor.value = isSuccess ? 'copy-success' : 'copy-failed'
    copyTip.value = `Copied ${type} ${isSuccess ? 'successfully' : 'failed'}!`

    copyTimerId.value = setTimeout(() => {
        if (copyTimerId.value) {
            copyTip.value = ''
            clearTimeout(copyTimerId.value)
            copyTimerId.value = null
        }
    }, 800)
}

// 复制代码按钮点击事件
const handleClickCopyCode = async () => {
    const result = await copyToClipboard(ContentType.Code)
    handleCopyTip(ContentType.Code, result)
}

// 复制提示按钮点击事件
const handleClickCopyPrompt = async () => {
    const result = await copyToClipboard(ContentType.Prompt)
    handleCopyTip(ContentType.Prompt, result)
}

// 开始录制
const startRecording = () => {
    recStatus.value = RecState.On
    window.close()
}

// 暂停录制
const pauseRecording = () => {
    recStatus.value = RecState.Paused
}

// 重置录制
const resetRecording = () => {
    recStatus.value = RecState.Off
    codeBlocks.value = []
}

// 打开配置文件界面
const openOptionPage = () => {
    browser.runtime.openOptionsPage()
}

// 处理切换事件
const handleToggle = (action: ActionState) => {
    // 发送操作的消息
    sendMessage('popup-action-message', action)
        .then(() => console.log('[cypress-recorder][popup]发送消息成功'))
        .catch(error => console.error('[cypress-recorder][popup]发送消息失败：', error))

    // 更新对应的状态
    switch (action) {
        // 开始/继续
        case ActionState.Start:
        case ActionState.Resume:
            startRecording()
            break

        // 暂停
        case ActionState.Pause:
            pauseRecording()
            break

        // 重置
        case ActionState.Reset:
            resetRecording()
            break

        default:
            break
    }
}

onMounted(() => {
    // active: 选项卡在其窗口中是否处于活动状态 currentWindow: 选项卡是否在当前窗口中
    browser.tabs.query({ active: true, currentWindow: true }).then(([tab]: Tabs.Tab[]) => {
        // 是否是禁止访问的URL
        const isForbidden = tab.url ? isForbiddenUrl(tab.url) : true
        isValidTab.value = !isForbidden
    })
})
</script>

<style scoped>
.popup-main {
    width: 460px;
    height: auto;
    display: flex;
    flex-direction: column;
}

.head-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 32px;
    padding: 4px 8px;
    border-block-end: 1px solid #ebebeb;
}

.head-title {
    margin: 0;
    font-size: 18px;
    line-height: 24px;
}

.option-button {
    display: flex;
    align-items: center;
    justify-content: center;
}

.body-main {
    height: 320px;
    padding: 10px 20px;
    overflow: hidden auto;
}

.empty-box {
    font-size: 14px;
    height: 20px;
    text-align: center;
    margin-top: 140px;
}

.code-main {
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
}

.code-block {
    margin: 0;
    padding: 0;
    display: flex;
    max-width: 100%;
    color: rgba(0, 0, 0, 0.88);
    align-items: center;
    justify-content: space-between;
    align-items: baseline;
    border-block-end: 1px solid rgba(5, 5, 5, 0.06);
}

.index-item {
    width: 18px;
    height: 18px;
    display: inline-flex;
    font-size: 12px;
    scale: 0.8;
    margin-inline-end: 4px;
    background-color: #d9d9d9;
    border-radius: 50%;
    align-items: center;
    justify-content: center;
}

.item-block {
    flex: 1 0;
    width: 0;
    color: rgba(0, 0, 0, 0.88);
}

.code-item,
.prompt-item {
    white-space: pre-wrap;
    overflow-wrap: break-word;
    word-break: break-word;
}

.code-item {
    font-size: 14px;
    color: rgba(0, 0, 0, 0.88);
    line-height: 22px;
}

.prompt-item {
    font-size: 12px;
    color: rgba(0, 0, 0, 0.45);
    line-height: 20px;
}

.foot-main {
    position: relative;
    display: flex;
    align-items: center;
    height: 32px;
    padding: 0 8px;
    border-block-start: 1px solid #ebebeb;
}

.toggle-button,
.reset-button {
    margin-right: 4px;
}

.copy-tip {
    position: absolute;
    font-size: 10px;
    right: 8px;
    bottom: 40px;
    background-color: #ebebeb;
    border-radius: 4px;
    padding: 2px 4px;
}

.copy-failed {
    color: #ec5b56;
}

.copy-success {
    color: #569c30;
}

.copy-code-button {
    margin-left: auto;
}

.copy-prompt-button {
    margin-left: 4px;
}
</style>