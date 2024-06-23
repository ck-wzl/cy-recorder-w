/* eslint-disable no-console */
/**
 * @file 代码操作器
 */

import { RecState } from "~/constants"
import type { ICodeBlock } from "~/interface"
import { recStatus, codeBlocks } from '~/storage'

export default class codeOperation {
    constructor() {
        this.resetState()
        console.log('operation recStatus', recStatus.value)
    }

    resetState() {
        return new Promise<void>((resolve) => {
            recStatus.value = RecState.Off
            codeBlocks.value = []
            resolve()
        })
    }

    addCodeBlock(block: ICodeBlock) {
        return new Promise<void>((resolve) => {
            codeBlocks.value.push(block)
            resolve()
        })
    }

    popTwoCodeBlock() {
        return new Promise<void>((resolve) => {
            codeBlocks.value.splice(codeBlocks.value.length - 2, 2)
            resolve()
        })
    }

    updateState(newState: RecState) {
        return new Promise<void>((resolve) => {
            recStatus.value = newState
            resolve()
        })
    }

    /** TODO@WZL */
    delCodeBlock(index: number) {
        return new Promise<void>((resolve) => {
            codeBlocks.value.splice(index, 1)
            resolve()
        })
    }

    /** TODO@WZL */
    moveCodeBlock(i: number, j: number) {
        return new Promise<void>((resolve) => {
            const dragged = codeBlocks.value.splice(i, 1)[0]
            codeBlocks.value.splice(j, 0, dragged)
            resolve()
        })
    }
}
