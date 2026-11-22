# CaptureContext

The capture context, from which you can obtain capture-related parameters or change things.

WVC exposes this context instance to `window.captureCtx` so that your page can access it.

## CaptureContext.start()

Start capturing the page. When the video instance's `autostartRender` option is false, this function must be called to start rendering.

## CaptureContext.abort()

Abort the capture. The capture will be terminated early and synthesis output will be completed with the frames captured so far, with the same effect as the video instance's `abort()`. Only effective after capture has started.

## CaptureContext.throwError(code: number, message: string)

Throw an error and interrupt rendering. The error will be reported back to the caller through the video instance's `error` event callback.

## CaptureContext.isCapturing(): boolean

Whether capture has started (the current capture time point has passed `config.startTime`).

## CaptureContext.addAudio(options: Object)

Add audio. You can also insert an `<audio>` element into the page to add audio.

### options

<table width="100%">
    <thead >
        <tr>
            <th>Parameter</th>
            <th>Type</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>url</td>
            <td>string</td>
            <td>Audio URL; relative paths are supported</td>
        </tr>
        <tr>
            <td>startTime</td>
            <td>number</td>
            <td>Start time point (milliseconds)</td>
        </tr>
        <tr>
            <td>endTime</td>
            <td>number</td>
            <td>End time point (milliseconds)</td>
        </tr>
        <tr>
            <td>loop</td>
            <td>boolean</td>
            <td>Whether to loop playback</td>
        </tr>
        <tr>
            <td>volume</td>
            <td>number</td>
            <td>Volume (0-100)</td>
        </tr>
        <tr>
            <td>seekStart</td>
            <td>number</td>
            <td>Trim start time point (milliseconds)</td>
        </tr>
        <tr>
            <td>seekEnd</td>
            <td>number</td>
            <td>Trim end time point (milliseconds)</td>
        </tr>
        <tr>
            <td>fadeInDuration</td>
            <td>number</td>
            <td>Fade-in duration (milliseconds)</td>
        </tr>
        <tr>
            <td>fadeOutDuration</td>
            <td>number</td>
            <td>Fade-out duration (milliseconds)</td>
        </tr>
        <tr>
            <td>retryFetchs</td>
            <td>number</td>
            <td>Number of retry fetches after a download failure</td>
        </tr>
        <tr>
            <td>ignoreCache</td>
            <td>boolean</td>
            <td>Whether to ignore the local cache</td>
        </tr>
    </tbody>
</table>

## CaptureContext.addAudios([options: Object, ...])

Add multiple audio tracks.

## CaptureContext.config: Object

Current capture configuration.

<table width="100%">
    <thead >
        <tr>
            <th>Parameter</th>
            <th>Type</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>fps</td>
            <td>number</td>
            <td>Capture frame rate</td>
        </tr>
        <tr>
            <td>duration</td>
            <td>number</td>
            <td>Total capture duration (milliseconds)</td>
        </tr>
        <tr>
            <td>frameCount</td>
            <td>number</td>
            <td>Target total frame count</td>
        </tr>
        <tr>
            <td>startTime</td>
            <td>number</td>
            <td>Capture start time point (milliseconds)</td>
        </tr>
        <tr>
            <td>autostart</td>
            <td>boolean</td>
            <td>Whether to start capture automatically once the page is ready</td>
        </tr>
        <tr>
            <td>videoDecoderHardwareAcceleration</td>
            <td>string</td>
            <td>VideoDecoder hardware acceleration hint</td>
        </tr>
    </tbody>
</table>

## CaptureContext.currentTime: number

Captured duration so far (milliseconds)

## CaptureContext.frameIndex: number

Index of the currently captured frame

## CaptureContext.stopFlag: boolean

Whether capture has been stopped
