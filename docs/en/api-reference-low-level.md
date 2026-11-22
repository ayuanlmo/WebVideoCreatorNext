# Low-Level API

```javascript
import { core } from "web-video-creator-next"
// The low-level APIs are exposed on core
const { ... } = core;
```

# ResourcePool

Resource pool

## Constructor

### new ResourcePool (options: Object)

#### options Parameter

<table width="100%">
    <thead>
        <tr>
            <th>Parameter</th>
            <th>Type</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>numBrowserMin</td>
            <td>number</td>
            <td>Minimum number of browser instances in the resource pool</td>
        </tr>
        <tr>
            <td>numBrowserMax</td>
            <td>number</td>
            <td>Maximum number of browser instances in the resource pool</td>
        </tr>
        <tr>
            <td>browserOptions</td>
            <td>Object</td>
            <td>Browser options, see the options parameter of the <a href="#browser">Browser</a> constructor</td>
        </tr>
        <tr>
            <td>browserOptions.pageOptions</td>
            <td>Object</td>
            <td>Browser page options, see the options parameter of the <a href="#page">Page</a> constructor</td>
        </tr>
    </tbody>
</table>

## Members

### ResourcePool.warmup (): Promise

Warm up the resource pool so that rendering can start quickly when a render task is created.

### ResourcePool.acquirePage (): Promise<[Page](#page)>

Acquire a page wrapper instance from the resource pool, remember to call [page.release ()](#pagerelease-promise) to release it when you are done with the page object.

### ResourcePool.acquireBrowser (): Promise<[Browser](#browser)>

Acquire a browser wrapper instance from the resource pool, remember to call [browser.release ()](#browserrelease-promise) to release it when you are done with the browser object.

### ResourcePool.isBusy (): boolean

Check whether the browser resource pool is saturated

### ResourcePool.close (): Promise

Close the resource pool, this will close all browser and page instances and stop the internal checker, after which the Node.js process can exit naturally. Corresponds to [destroy](./api-reference-high-level.md#webvideocreatornextdestroy-promise) of the high-level API.

### ResourcePool.releaseBrowser (browser: [Browser](#browser)): Promise

Release a browser wrapper instance, it will be recycled into the resource pool for the next allocation.

### ResourcePool.destoryBrowser (browser: [Browser](#browser)): Promise

Destroy a browser wrapper instance, the resource pool will be notified to destroy the browser resources (the method name spelling is kept consistent with upstream).

### ResourcePool.videoPreprocessor: VideoPreprocessor

The video preprocessor instance.

<br>

# Browser

Browser wrapper

## Constructor

### new Browser (options: Object)

#### options Parameter

<table width="100%">
    <thead>
        <tr>
            <th>Parameter</th>
            <th>Type</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>numPageMin</td>
            <td>number</td>
            <td>Minimum number of page resources</td>
        </tr>
        <tr>
            <td>numPageMax</td>
            <td>number</td>
            <td>Maximum number of page resources</td>
        </tr>
        <tr>
            <td>executablePath</td>
            <td>string</td>
            <td>Path to the browser executable</td>
        </tr>
        <tr>
            <td>useGPU</td>
            <td>boolean</td>
            <td>Whether to use GPU-accelerated rendering, enabling is recommended</td>
        </tr>
        <tr>
            <td>useAngle</td>
            <td>boolean</td>
            <td>Whether the rendering backend uses Angle, enabling is recommended</td>
        </tr>
        <tr>
            <td>disableDevShm</td>
            <td>boolean</td>
            <td>Whether to disable shared memory, enabling this option is recommended when /dev/shm is small, disabled by default</td>
        </tr>
        <tr>
            <td>args</td>
            <td>string[]</td>
            <td>List of browser flags arguments</td>
        </tr>
        <tr>
            <td>pageOptions</td>
            <td>Object</td>
            <td>Page options, see the options parameter of the <a href="#page">Page</a> constructor</td>
        </tr>
    </tbody>
</table>

## Members

### Browser.init (): Promise

Initialize the browser

### Browser.acquirePage (): Promise<[Page](#page)>

Acquire a page wrapper instance from the browser wrapper, remember to call [page.release ()](#pagerelease-promise) to release it when you are done with the page object.

### Browser.release (): Promise

Release the browser wrapper itself, it will be recycled into the resource pool for the next allocation.

### Browser.close (): Promise

Close the browser, the resource pool will be notified to destroy the browser resources

### Browser.getPageCount (): Promise<number>

Get the number of pages opened in the browser

### Browser.isUninitialized (): boolean

Check whether the browser is uninitialized

### Browser.isReady (): boolean

Check whether the browser is ready

### Browser.isUnavailabled (): boolean

Check whether the browser is unavailable

### Browser.isClosed (): boolean

Check whether the browser is closed

### Browser.isBusy (): boolean

Check whether the browser page pool is saturated

<br>

# Page

Page wrapper

## Constructor

### new Page (options: Object)

#### options Parameter

<table width="100%">
    <thead>
        <tr>
            <th>Parameter</th>
            <th>Type</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>width</td>
            <td>number</td>
            <td>Initial page viewport width, can be adjusted via setViewport</td>
        </tr>
        <tr>
            <td>height</td>
            <td>number</td>
            <td>Initial page viewport height, can be adjusted via setViewport</td>
        </tr>
        <tr>
            <td>userAgent</td>
            <td>string</td>
            <td>User agent used when visiting the page</td>
        </tr>
        <tr>
            <td>beginFrameTimeout</td>
            <td>number</td>
            <td>BeginFrame timeout (milliseconds), default 5000 milliseconds</td>
        </tr>
        <tr>
            <td>frameFormat</td>
            <td>string</td>
            <td>Frame image format (jpeg/png), jpeg is recommended for better performance</td>
        </tr>
        <tr>
            <td>frameQuality</td>
            <td>number</td>
            <td>Frame image quality (0-100), default 80</td>
        </tr>
    </tbody>
</table>

## Members

### Page.init (): Promise

Initialize the page

### Page.setViewport (options: Object): Promise

Set viewport parameters

#### options Parameter

Consistent with Puppeteer's [Viewport](https://pptr.dev/api/puppeteer.viewport#properties).

### Page.goto (url: string, waitForOptions: Object): Promise

Navigate to the page to be rendered.

#### url Parameter

A local URL or a remote HTTPS URL, subject to the browser's [secure context restrictions](https://w3c.github.io/webappsec-secure-contexts/), only localhost / 127.0.0.1 or domains using the HTTPS protocol with a valid certificate can be accessed

#### waitForOptions Parameter

Consistent with Puppeteer's [WaitForOptions](https://pptr.dev/api/puppeteer.waitforoptions).

### Page.setContent (content: string, waitForOptions: Object): Promise

Set the content of the page to be rendered.

#### content Parameter

Visible HTML content.

#### waitForOptions Parameter

Consistent with Puppeteer's [WaitForOptions](https://pptr.dev/api/puppeteer.waitforoptions).

### Page.registerFont (options: Object)

Register a font

#### options Parameter

See the [Font](#font) parameters.

### Page.registerFonts ([options: Object, ...])

Register multiple fonts

#### options Parameter

See the [Font](#font) parameters.

### Page.registerTimeActions (actions: {[key: Number]: Function})

Register an action sequence

#### actions Parameter

The action sequence object

### Page.waitForFontsLoaded (timeout: number): Promise

Wait for fonts to finish loading.

#### timeout Parameter

Timeout (milliseconds), default 30000 milliseconds

### Page.startScreencast (options: Object): Promise

Start frame stream capture

#### options Parameter

<table width="100%">
    <thead>
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
            <td>Rendering frame rate</td>
        </tr>
        <tr>
            <td>duration</td>
            <td>number</td>
            <td>Rendering duration (milliseconds)</td>
        </tr>
        <tr>
            <td>frameCount</td>
            <td>number</td>
            <td>Total number of frames to render</td>
        </tr>
        <tr>
            <td>autostart</td>
            <td>boolean</td>
            <td>Whether to start rendering automatically, default true</td>
        </tr>
        <tr>
            <td>videoDecoderHardwareAcceleration</td>
            <td>string</td>
            <td><a href="https://developer.mozilla.org/en-US/docs/Web/API/VideoDecoder/configure">VideoDecoder</a> hardware acceleration hint, default value prefer-hardware</td>
        </tr>
    </tbody>
</table>

### Page.pauseScreencast (): Promise

Pause frame stream capture

### Page.resumeScreencast (): Promise

Resume frame stream capture

### Page.stopScreencast (): Promise

Stop frame stream capture

### Page.getCaptureContextConfig (): Promise

Get the contents of the global `captureCtx.config` configuration in the page.

### Page.reset (): Promise

Reset the page wrapper, a new capture can be started after the reset.

### Page.release (): Promise

Release the page wrapper itself, it will be recycled into the page pool for the next allocation.

### Page.close (): Promise

Close the page, the browser wrapper will be notified to destroy the page resources

### Page.isUninitialized (): boolean

Check whether the page is uninitialized

### Page.isReady (): boolean

Check whether the page is ready

### Page.isUnavailabled (): boolean

Check whether the page is unavailable

### Page.isClosed (): boolean

Check whether the page is closed

## Events

### error

Page internal error event, callback parameter: (err)

### crashed

Page crash event, callback parameter: (err)

### consoleLog / consoleError

Page console log event, callback parameter: (message)

### frame

Rendered frame event, callback parameter: (buffer: Buffer), the frame image data can be input to the [Synthesizer](#synthesizer) to synthesize a video.

### screencastCompleted

Frame stream capture completed event.

<br>

# Synthesizer

Synthesizer

## Constructor

### new Synthesizer (options: Object)

#### options Parameter

<table width="100%">
    <thead>
        <tr>
            <th>Parameter</th>
            <th>Type</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>outputPath</td>
            <td>string</td>
            <td>Export video path</td>
        </tr>
        <tr>
            <td>width</td>
            <td>number</td>
            <td>Video width</td>
        </tr>
        <tr>
            <td>height</td>
            <td>number</td>
            <td>Video height</td>
        </tr>
        <tr>
            <td>duration</td>
            <td>number</td>
            <td>Video duration</td>
        </tr>
        <tr>
            <td>fps</td>
            <td>number</td>
            <td>Video synthesis frame rate, default 30</td>
        </tr>
        <tr>
            <td>format</td>
            <td>string</td>
            <td>Exported video format (mp4/webm); determined by the output file path extension by default</td>
        </tr>
        <tr>
            <td>attachCoverPath</td>
            <td>string</td>
            <td>Path to the cover image file attached to the first frame of the video</td>
        </tr>
        <tr>
            <td>coverCapture</td>
            <td>boolean</td>
            <td>Whether to capture and output a cover image, default false</td>
        </tr>
        <tr>
            <td>coverCaptureTime</td>
            <td>number</td>
            <td>Cover image capture time point (milliseconds), the default capture point is at 20% of the video</td>
        </tr>
        <tr>
            <td>coverCaptureFormat</td>
            <td>string</td>
            <td>Cover image capture format (jpg/png/bmp), default jpg</td>
        </tr>
        <tr>
            <td>coverCaptureQuality</td>
            <td>number</td>
            <td>Cover image capture JPG quality (0-100; higher values mean better quality, effective for the jpg format only)</td>
        </tr>
        <tr>
            <td>videoEncoder</td>
            <td>string</td>
            <td>Video encoder, see <a href="./video-encoder.md">Video Encoder Documentation</a> for encoder selection</td>
        </tr>
        <tr>
            <td>videoQuality</td>
            <td>number</td>
            <td>Video quality (0-100), default 100</td>
        </tr>
        <tr>
            <td>videoBitrate</td>
            <td>string</td>
            <td>Video bitrate (setting the bitrate ignores videoQuality)</td>
        </tr>
        <tr>
            <td>pixelFormat</td>
            <td>string</td>
            <td>Pixel format (yuv420p/yuv444p/rgb24/yuva420p), default yuv420p. Transparent videos with backgroundOpacity&lt;1 must use a format with an alpha channel (yuva420p by default); explicitly specifying a format without alpha such as rgb24 will result in an error</td>
        </tr>
        <tr>
            <td>audioEncoder</td>
            <td>string</td>
            <td>Audio encoder, default aac</td>
        </tr>
        <tr>
            <td>audioBitrate</td>
            <td>string</td>
            <td>Audio bitrate</td>
        </tr>
        <tr>
            <td>volume</td>
            <td>number</td>
            <td>Video volume (0-100), default 100</td>
        </tr>
        <tr>
            <td>backgroundOpacity</td>
            <td>number</td>
            <td>Background opacity (0-1); supported only by the webm format, used to export videos with an alpha channel</td>
        </tr>
        <tr>
            <td>parallelWriteFrames</td>
            <td>number</td>
            <td>Number of frames written in parallel, default 10</td>
        </tr>
        <tr>
            <td>showProgress</td>
            <td>boolean</td>
            <td>Whether to show progress in the command line, default false</td>
        </tr>
    </tbody>
</table>

### Synthesizer.start ()

Start synthesis.

### Synthesizer.abort ()

Abort synthesis, rendering generally should not be interrupted except in special circumstances.

### Synthesizer.input (buffer: Buffer)

Input frame data.

#### buffer Parameter

Frame image binary data stored in a Buffer object, once input it will be streamed to FFmpeg.

### Synthesizer.endInput ()

End the input of the frame stream, notifying FFmpeg that all frames have been input and waiting for synthesis to complete.

### Synthesizer.addAudio (options: Object)

Add audio.

#### options Parameter

See the [Audio](#audio) parameters.

### Synthesizer.addAudios ([options: Object, ...])

Add multiple audio tracks

#### options Parameter

See the [Audio](#audio) parameters.

### Synthesizer.removeOutputFile (): Promise

Remove the output file.

### Synthesizer.reset ()

Reset the synthesizer, frames can be input again after the reset.

### Synthesizer.isReady (): boolean

Whether the synthesizer is ready

### Synthesizer.isSynthesizing (): boolean

Whether the synthesizer is currently synthesizing

### Synthesizer.isCompleted (): boolean

Whether the synthesizer has finished synthesis

## Events

### progress

Synthesis progress event, callback parameters: (progress, processedFrameCount, totalFrameCount)

### completed

Synthesis completed event, callback parameters: (result: { duration, takes, outputPath, rtf })

### error

Error event, callback parameter: (err)

[VideoChunk](#videochunk) and [ChunkSynthesizer](#chunksynthesizer) inherit from Synthesizer and also support the events above.

<br>

# VideoChunk

Video chunk

## Constructor

### new VideoChunk (options: Object)

#### options Parameter

<table width="100%">
    <thead>
        <tr>
            <th>Parameter</th>
            <th>Type</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>width</td>
            <td>number</td>
            <td>Video width</td>
        </tr>
        <tr>
            <td>height</td>
            <td>number</td>
            <td>Video height</td>
        </tr>
        <tr>
            <td>duration</td>
            <td>number</td>
            <td>Video duration</td>
        </tr>
        <tr>
            <td>fps</td>
            <td>number</td>
            <td>Video synthesis frame rate, default 30</td>
        </tr>
        <tr>
            <td>outputPath</td>
            <td>string</td>
            <td>Export path of the video chunk, stored in the temporary directory by default, the path must use the .ts extension</td>
        </tr>
        <tr>
            <td>transition</td>
            <td>string | <a href="#transition">Transition</a></td>
            <td>Transition into the next video chunk</td>
        </tr>
        <tr>
            <td>autoremove</td>
            <td>boolean</td>
            <td>Whether to automatically delete the chunk file after the chunk is merged, default true</td>
        </tr>
        <tr>
            <td>backgroundOpacity</td>
            <td>number</td>
            <td>Background opacity (0-1); supported only by the webm format, used to export videos with an alpha channel</td>
        </tr>
        <tr>
            <td>videoEncoder</td>
            <td>string</td>
            <td>Video encoder, see <a href="./video-encoder.md">Video Encoder Documentation</a> for encoder selection</td>
        </tr>
        <tr>
            <td>videoQuality</td>
            <td>number</td>
            <td>Video quality (0-100), default 100</td>
        </tr>
        <tr>
            <td>videoBitrate</td>
            <td>string</td>
            <td>Video bitrate (setting the bitrate ignores videoQuality)</td>
        </tr>
        <tr>
            <td>pixelFormat</td>
            <td>string</td>
            <td>Pixel format (yuv420p/yuv444p/rgb24/yuva420p), default yuv420p. Transparent videos with backgroundOpacity&lt;1 must use a format with an alpha channel (yuva420p by default); explicitly specifying a format without alpha such as rgb24 will result in an error</td>
        </tr>
        <tr>
            <td>parallelWriteFrames</td>
            <td>number</td>
            <td>Number of frames written in parallel, default 10</td>
        </tr>
        <tr>
            <td>showProgress</td>
            <td>boolean</td>
            <td>Whether to show progress in the command line, default false</td>
        </tr>
    </tbody>
</table>

### VideoChunk.start ()

Start synthesis.

### VideoChunk.abort ()

Abort synthesis, rendering generally should not be interrupted except in special circumstances.

### VideoChunk.input (buffer: Buffer)

Input frame data.

#### buffer Parameter

Frame image binary data stored in a Buffer object, once input it will be streamed to FFmpeg.

### VideoChunk.endInput ()

End the input of the frame stream, notifying FFmpeg that all frames have been input and waiting for synthesis to complete.

### VideoChunk.addAudio (options: Object)

Add audio.

#### options Parameter

See the [Audio](#audio) parameters.

### VideoChunk.addAudios ([options: Object, ...])

Add multiple audio tracks

### VideoChunk.setTransition (options: Object)

Set the transition effect

#### options Parameter

See the [Transition](#transition) parameters.

### VideoChunk.reset ()

Reset the video chunk, frames can be input again after the reset.

### VideoChunk.isReady (): boolean

Whether the video chunk is ready

### VideoChunk.isSynthesizing (): boolean

Whether the video chunk is currently synthesizing

### VideoChunk.isCompleted (): boolean

Whether the video chunk has finished synthesis

<br>

# ChunkSynthesizer

Chunk synthesizer

## Constructor

### new ChunkSynthesizer (options: Object)

#### options Parameter

<table width="100%">
    <thead>
        <tr>
            <th>Parameter</th>
            <th>Type</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>outputPath</td>
            <td>string</td>
            <td>Export video path</td>
        </tr>
        <tr>
            <td>width</td>
            <td>number</td>
            <td>Video width</td>
        </tr>
        <tr>
            <td>height</td>
            <td>number</td>
            <td>Video height</td>
        </tr>
        <tr>
            <td>chunks</td>
            <td><a href="#videochunk">VideoChunk</a>[]</td>
            <td>List of unrendered or rendered VideoChunks, entries can be VideoChunk instances or plain objects</td>
        </tr>
        <tr>
            <td>duration</td>
            <td>number</td>
            <td>Video duration</td>
        </tr>
        <tr>
            <td>fps</td>
            <td>number</td>
            <td>Video synthesis frame rate, default 30</td>
        </tr>
        <tr>
            <td>attachCoverPath</td>
            <td>string</td>
            <td>Path to the cover image file attached to the first frame of the video</td>
        </tr>
        <tr>
            <td>coverCapture</td>
            <td>boolean</td>
            <td>Whether to capture and output a cover image, default false</td>
        </tr>
        <tr>
            <td>coverCaptureTime</td>
            <td>number</td>
            <td>Cover image capture time point (milliseconds), the default capture point is at 20% of the video</td>
        </tr>
        <tr>
            <td>coverCaptureFormat</td>
            <td>string</td>
            <td>Cover image capture format (jpg/png/bmp), default jpg</td>
        </tr>
        <tr>
            <td>coverCaptureQuality</td>
            <td>number</td>
            <td>Cover image capture JPG quality (0-100; higher values mean better quality, effective for the jpg format only)</td>
        </tr>
        <tr>
            <td>videoEncoder</td>
            <td>string</td>
            <td>Video encoder, see <a href="./video-encoder.md">Video Encoder Documentation</a> for encoder selection</td>
        </tr>
        <tr>
            <td>videoQuality</td>
            <td>number</td>
            <td>Video quality (0-100), default 100</td>
        </tr>
        <tr>
            <td>videoBitrate</td>
            <td>string</td>
            <td>Video bitrate (setting the bitrate ignores videoQuality)</td>
        </tr>
        <tr>
            <td>pixelFormat</td>
            <td>string</td>
            <td>Pixel format (yuv420p/yuv444p/rgb24/yuva420p), default yuv420p. Transparent videos with backgroundOpacity&lt;1 must use a format with an alpha channel (yuva420p by default); explicitly specifying a format without alpha such as rgb24 will result in an error</td>
        </tr>
        <tr>
            <td>audioEncoder</td>
            <td>string</td>
            <td>Audio encoder, default aac</td>
        </tr>
        <tr>
            <td>audioBitrate</td>
            <td>string</td>
            <td>Audio bitrate</td>
        </tr>
        <tr>
            <td>volume</td>
            <td>number</td>
            <td>Video volume (0-100), default 100</td>
        </tr>
        <tr>
            <td>backgroundOpacity</td>
            <td>number</td>
            <td>Background opacity (0-1); supported only by the webm format, used to export videos with an alpha channel</td>
        </tr>
        <tr>
            <td>parallelWriteFrames</td>
            <td>number</td>
            <td>Number of frames written in parallel, default 10</td>
        </tr>
        <tr>
            <td>showProgress</td>
            <td>boolean</td>
            <td>Whether to show progress in the command line, default false</td>
        </tr>
    </tbody>
</table>

### ChunkSynthesizer.start ()

Start synthesis.

### ChunkSynthesizer.abort ()

Abort synthesis, rendering generally should not be interrupted except in special circumstances.

### ChunkSynthesizer.input (chunk: [VideoChunk](#videochunk), transition: [Transition](#transition))

Input a video chunk.

#### chunk Parameter

See [VideoChunk](#videochunk).

#### transition Parameter

See [Transition](#transition).

### ChunkSynthesizer.addAudio (options: Object)

Add audio.

#### options Parameter

See the [Audio](#audio) parameters.

### ChunkSynthesizer.addAudios ([options: Object, ...])

Add multiple audio tracks

### ChunkSynthesizer.reset ()

Reset the synthesizer, video chunks can be input again after the reset.

### ChunkSynthesizer.isReady (): boolean

Whether the synthesizer is ready

### ChunkSynthesizer.isSynthesizing (): boolean

Whether the synthesizer is currently synthesizing

### ChunkSynthesizer.isCompleted (): boolean

Whether the synthesizer has finished synthesis

# Audio

Audio parameters

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
            <td>Audio URL; choose either this or path</td>
        </tr>
        <tr>
            <td>path</td>
            <td>string</td>
            <td>Local path of the audio; choose either this or url</td>
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

# Transition

Transition parameters, see [transition effects](./transition.md).

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
            <td>id</td>
            <td>string</td>
            <td>Transition ID (same as the filter name)</td>
        </tr>
        <tr>
            <td>duration</td>
            <td>number</td>
            <td>Transition duration (milliseconds)</td>
        </tr>
    </tbody>
</table>

# Font

Font parameters

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
            <td>Font URL; choose either this or path</td>
        </tr>
        <tr>
            <td>path</td>
            <td>string</td>
            <td>Local path of the font; choose either this or url</td>
        </tr>
        <tr>
            <td>family</td>
            <td>string</td>
            <td>Font family name</td>
        </tr>
        <tr>
            <td>style</td>
            <td>string</td>
            <td>Font style</td>
        </tr>
        <tr>
            <td>weight</td>
            <td>number | string</td>
            <td>Font weight</td>
        </tr>
        <tr>
            <td>format</td>
            <td>string</td>
            <td>Font format</td>
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
