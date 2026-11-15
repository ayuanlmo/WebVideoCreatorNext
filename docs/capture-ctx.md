# CaptureContext

捕获上下文，可以从这里获得捕获相关的参数或改变一些东西。

WVC会将此上下文实例暴露到 `window.captureCtx` 以便您的页面访问。

## CaptureContext.start()

开始捕获页面，视频实例的 `autostartRender` 选项为false时，必须调用此函数才能启动渲染。

## CaptureContext.abort()

终止捕获，捕获将提前终止并以已捕获的帧完成合成输出，效果与视频实例的 `abort()` 一致。仅在捕获已开始后有效。

## CaptureContext.throwError(code: number, message: string)

抛出错误并中断渲染，错误将通过视频实例的 `error` 事件回调给调用方。

## CaptureContext.isCapturing(): boolean

是否已经开始捕获（当前捕获时间点已超过 `config.startTime`）。

## CaptureContext.addAudio(options: Object)

添加音频，也可以在页面中插入 `<audio>` 元素来添加音频。

### options 参数

<table width="100%">
    <thead >
        <tr>
            <th>参数</th>
            <th>类型</th>
            <th>说明</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>url</td>
            <td>string</td>
            <td>音频URL，支持相对路径</td>
        </tr>
        <tr>
            <td>startTime</td>
            <td>number</td>
            <td>起始时间点（毫秒）</td>
        </tr>
        <tr>
            <td>endTime</td>
            <td>number</td>
            <td>结束时间点（毫秒）</td>
        </tr>
        <tr>
            <td>loop</td>
            <td>boolean</td>
            <td>是否循环播放</td>
        </tr>
        <tr>
            <td>volume</td>
            <td>number</td>
            <td>音量（0-100）</td>
        </tr>
        <tr>
            <td>seekStart</td>
            <td>number</td>
            <td>裁剪起始时间点（毫秒）</td>
        </tr>
        <tr>
            <td>seekEnd</td>
            <td>number</td>
            <td>裁剪结束时间点（毫秒）</td>
        </tr>
        <tr>
            <td>fadeInDuration</td>
            <td>number</td>
            <td>淡入时长（毫秒）</td>
        </tr>
        <tr>
            <td>fadeOutDuration</td>
            <td>number</td>
            <td>淡出时长（毫秒）</td>
        </tr>
        <tr>
            <td>retryFetchs</td>
            <td>number</td>
            <td>下载失败后的重试拉取次数</td>
        </tr>
        <tr>
            <td>ignoreCache</td>
            <td>boolean</td>
            <td>是否忽略本地缓存</td>
        </tr>
    </tbody>
</table>

## CaptureContext.addAudios([options: Object, ...])

添加多个音频

## CaptureContext.config: Object

当前捕获配置

<table width="100%">
    <thead >
        <tr>
            <th>参数</th>
            <th>类型</th>
            <th>说明</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>fps</td>
            <td>number</td>
            <td>捕获帧率</td>
        </tr>
        <tr>
            <td>duration</td>
            <td>number</td>
            <td>捕获总时长（毫秒）</td>
        </tr>
        <tr>
            <td>frameCount</td>
            <td>number</td>
            <td>目标总帧数</td>
        </tr>
        <tr>
            <td>startTime</td>
            <td>number</td>
            <td>开始捕获时间点（毫秒）</td>
        </tr>
        <tr>
            <td>autostart</td>
            <td>boolean</td>
            <td>页面就绪后是否自动开始捕获</td>
        </tr>
        <tr>
            <td>videoDecoderHardwareAcceleration</td>
            <td>string</td>
            <td>VideoDecoder硬件加速指示</td>
        </tr>
    </tbody>
</table>

## CaptureContext.currentTime: number

已捕获时长（毫秒）

## CaptureContext.frameIndex: number

当前捕获的帧下标

## CaptureContext.stopFlag: boolean

是否已停止捕获