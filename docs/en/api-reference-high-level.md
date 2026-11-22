# High-Level API

# WebVideoCreatorNext

### WebVideoCreatorNext.config([options: Object])

Configure WVC's global switches and properties. It must be run before any other operation.

#### options Parameter

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
            <td>debug</td>
            <td>boolean</td>
            <td>WebVideoCreatorNext debug logging; when enabled, some internal debug logs will be output</td>
        </tr>
        <tr>
            <td>browserVersion</td>
            <td>string</td>
            <td>Specify the Chrome browser version used by WVC</td>
        </tr>
        <tr>
            <td>browserHeadless</td>
            <td>boolean</td>
            <td>Headless mode switch for the browser; it is recommended to keep it enabled. If disabled, make sure Compatible Rendering Mode is enabled, otherwise rendering will not work. Only used for debugging the picture</td>
        </tr>
        <tr>
            <td>browserFrameRateLimit</td>
            <td>boolean</td>
            <td>Browser frame rate limit switch, enabled by default. Disabling the frame rate limit improves rendering efficiency and supports animations above 60fps, but it disables GPU vertical sync, which may cause screen tearing or other issues</td>
        </tr>
        <tr>
            <td>browserDebug</td>
            <td>boolean</td>
            <td>Browser debug switch; when enabled, the browser's runtime logs will be output. If you want to see the page's logs, set consoleLog to true instead of this</td>
        </tr>
        <tr>
            <td>ffmpegDebug</td>
            <td>boolean</td>
            <td>When enabled, every executed ffmpeg command will be output</td>
        </tr>
        <tr>
            <td>ffmpegExecutablePath</td>
            <td>string</td>
            <td>Path to the ffmpeg executable; setting it disables the built-in ffmpeg-static. It is recommended to use the built-in FFmpeg by default to ensure full functionality</td>
        </tr>
        <tr>
            <td>ffprobeExecutablePath</td>
            <td>string</td>
            <td>Path to the ffprobe executable; setting it disables the built-in ffprobe-static. It is recommended to use the built-in ffprobe by default to ensure full functionality</td>
        </tr>
        <tr>
            <td>browserUseGPU</td>
            <td>boolean</td>
            <td>Browser GPU acceleration switch; enabling it is recommended to improve rendering performance. If you don't have a GPU device or encounter strange rendering issues, you can disable it</td>
        </tr>
        <tr>
            <td>browserUseAngle</td>
            <td>boolean</td>
            <td>Whether the browser uses ANGLE as the rendering backend; enabled by default to enhance cross-platform rendering compatibility and performance</td>
        </tr>
        <tr>
            <td>browserDisableDevShm</td>
            <td>boolean</td>
            <td>Whether to prevent the browser from using shared memory; it is recommended to enable this option when /dev/shm is small</td>
        </tr>
        <tr>
            <td>browserExecutablePath</td>
            <td>string</td>
            <td>Path to the browser executable; setting it disables the built-in browser. It is recommended to use the built-in browser by default to ensure full functionality</td>
        </tr>
        <tr>
            <td>browserLaunchTimeout</td>
            <td>number</td>
            <td>Browser launch timeout (milliseconds); sets how long to wait for the browser to start</td>
        </tr>
        <tr>
            <td>browserProtocolTimeout</td>
            <td>number</td>
            <td>Browser protocol communication timeout (milliseconds); sets the timeout for CDP protocol communication</td>
        </tr>
        <tr>
            <td>allowUnsafeContext</td>
            <td>boolean</td>
            <td>Disabled by default. When enabled, navigation to insecure URLs is allowed, but due to insecure-context restrictions, dynamic images and embedded videos cannot be used on the page</td>
        </tr>
        <tr>
            <td>compatibleRenderingMode</td>
            <td>boolean</td>
            <td>Compatible Rendering Mode; not recommended. When enabled, HeadlessExperimental.beginFrame API calls are disabled in favor of plain Page.screenshot, which reduces rendering performance, and some animations may not synchronize with the frame rate. If you encounter the following error, you can try enabling it: TargetCloseError: Protocol error (HeadlessExperimental.beginFrame): Target closed</td>
        </tr>
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
            <td>numPageMin</td>
            <td>number</td>
            <td>Minimum number of page instances per browser instance</td>
        </tr>
        <tr>
            <td>numPageMax</td>
            <td>number</td>
            <td>Maximum number of page instances per browser instance</td>
        </tr>
        <tr>
            <td>userAgent</td>
            <td>string</td>
            <td>User agent used when visiting pages</td>
        </tr>
        <tr>
            <td>frameQuality</td>
            <td>number</td>
            <td>Quality of captured frame images (0-100), effective for jpeg only</td>
        </tr>
        <tr>
            <td>frameFormat</td>
            <td>string</td>
            <td>Frame image format (jpeg/png); jpeg is recommended as png capture is more time-consuming</td>
        </tr>
        <tr>
            <td>preprocessChunkSize</td>
            <td>number</td>
            <td>Chunk size (in bytes) for sending preprocessed data back to the browser; larger data is automatically split into chunks to avoid the browser's ~100MB read buffer limit. Default: 33554432 (32MB)</td>
        </tr>
        <tr>
            <td>beginFrameTimeout</td>
            <td>number</td>
            <td>Timeout for BeginFrame image capture (milliseconds)</td>
        </tr>
        <tr>
            <td>mp4Encoder</td>
            <td>string</td>
            <td>Global video encoder for the MP4 format; the libx264 software encoder is used by default. It is recommended to choose an appropriate hardware encoder based on your hardware to accelerate synthesis</td>
        </tr>
        <tr>
            <td>webmEncoder</td>
            <td>string</td>
            <td>Global video encoder for the WEBM format; the libvpx software encoder is used by default. It is recommended to choose an appropriate hardware encoder based on your hardware to accelerate synthesis</td>
        </tr>
        <tr>
            <td>audioEncoder</td>
            <td>string</td>
            <td>Global audio encoder; the default aac encoder is recommended</td>
        </tr>
    </tbody>
</table>

<br>

### WebVideoCreatorNext.createSingleVideo(options: Object): [SingleVideo](#singlevideo)

Create a single-scene video instance

#### options Parameter

See the options parameter of the [SingleVideo](#singlevideo) constructor.

<br>

### WebVideoCreatorNext.createMultiVideo(options: Object): [MultiVideo](#multivideo)

Create a multi-scene video instance

#### options Parameter

See the options parameter of the [MultiVideo](#multivideo) constructor.

<br>

### WebVideoCreatorNext.createChunkVideo(options: Object): [ChunkVideo](#chunkvideo)

Create a chunk video instance

#### options Parameter

See the options parameter of the [ChunkVideo](#chunkVideo) constructor.

<br>

### WebVideoCreatorNext.destroy(): Promise

Destroy the browser resource pool and reset the configuration state.

- All browser and page instances will be closed, after which the Node.js process can exit naturally.
- Resets the configuration state; after destruction you can run [config](#webvideocreatornextconfigoptions-object) again to start new tasks.
- Calling it when `config()` has never been executed is a safe no-op.
- Can be called repeatedly (idempotent).

<br>

### WebVideoCreatorNext.cleanBrowserCache(): Promise

Clear the browser cache.

### WebVideoCreatorNext.cleanPreprocessCache(): Promise

Clear the preprocessing cache.

### WebVideoCreatorNext.cleanSynthesizeCache(): Promise

Clear the synthesis cache.

### WebVideoCreatorNext.cleanLocalFontCache(): Promise

Clear the local font cache.

<br>

# SingleVideo

Single-scene video

## Constructor

### new SingleVideo(options: Object)

#### options Parameter

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
            <td>URL of the page to render; choose either this or content</td>
        </tr>
        <tr>
            <td>content</td>
            <td>string</td>
            <td>Content of the page to render; choose either this or url</td>
        </tr>
        <tr>
            <td>backgroundOpacity</td>
            <td>number</td>
            <td>Background opacity (0-1); supported only by the webm format, used to export videos with an alpha channel</td>
        </tr>
        <tr>
            <td>waitTimeout</td>
            <td>number</td>
            <td>startAndWait timeout (milliseconds); 0 means no timeout, default 0</td>
        </tr>
        <tr>
            <td>outputPath</td>
            <td>string</td>
            <td>Video output path</td>
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
            <td>startTime</td>
            <td>number</td>
            <td>Time point at which video capture starts</td>
        </tr>
        <tr>
            <td>fps</td>
            <td>number</td>
            <td>Video frame rate</td>
        </tr>
        <tr>
            <td>format</td>
            <td>string</td>
            <td>Exported video format (mp4/webm)</td>
        </tr>
        <tr>
            <td>attachCoverPath</td>
            <td>string</td>
            <td>Path to the cover image file attached to the first frame of the video</td>
        </tr>
        <tr>
            <td>coverCapture</td>
            <td>boolean</td>
            <td>Whether to capture and output a cover image</td>
        </tr>
        <tr>
            <td>coverCaptureTime</td>
            <td>number</td>
            <td>Cover image capture time point (milliseconds)</td>
        </tr>
        <tr>
            <td>coverCaptureFormat</td>
            <td>string</td>
            <td>Cover image capture format (jpg/png/bmp)</td>
        </tr>
        <tr>
            <td>coverCaptureQuality</td>
            <td>number</td>
            <td>Cover image capture JPG quality (0-100; higher values mean better quality, effective for the jpg format only)</td>
        </tr>
        <tr>
            <td>videoEncoder</td>
            <td>string</td>
            <td>Video encoder, see <a href="./video-encoder.md">Video Encoder Documentation</a></td>
        </tr>
        <tr>
            <td>videoQuality</td>
            <td>number</td>
            <td>Video quality (0-100)</td>
        </tr>
        <tr>
            <td>videoBitrate</td>
            <td>string</td>
            <td>Video bitrate (setting the bitrate ignores videoQuality)</td>
        </tr>
        <tr>
            <td>pixelFormat</td>
            <td>string</td>
            <td>Pixel format (yuv420p/yuv444p/rgb24/yuva420p). Transparent videos with backgroundOpacity&lt;1 must use a format with an alpha channel (yuva420p by default); explicitly specifying a format without alpha such as rgb24 will result in an error</td>
        </tr>
        <tr>
            <td>audioEncoder</td>
            <td>string</td>
            <td>Audio encoder; the default aac is recommended</td>
        </tr>
        <tr>
            <td>audioBitrate</td>
            <td>string</td>
            <td>Audio bitrate</td>
        </tr>
        <tr>
            <td>volume</td>
            <td>number</td>
            <td>Video volume (0-100)</td>
        </tr>
        <tr>
            <td>pageWaitForOptions</td>
            <td><a href="https://pptr.dev/api/puppeteer.waitforoptions">WaitForOptions</a></td>
            <td>Page wait options</td>
        </tr>
        <tr>
            <td>pageViewport</td>
            <td><a href="https://pptr.dev/api/puppeteer.viewport#properties">Viewport</a></td>
            <td>Page viewport parameters</td>
        </tr>
        <tr>
            <td>pagePrepareFn</td>
            <td>Function</td>
            <td>Page preprocessing function; allows manipulating the Page object before rendering</td>
        </tr>
        <tr>
            <td>timeActions</td>
            <td>Object{[key: Number]: Function}</td>
            <td>Sequence of timed actions; allows manipulating the Page object during rendering. The key is a Number specifying the render time point at which to trigger</td>
        </tr>
        <tr>
            <td>showProgress</td>
            <td>boolean</td>
            <td>Whether to display progress in the command line</td>
        </tr>
        <tr>
            <td>autostartRender</td>
            <td>boolean</td>
            <td>Whether to start rendering automatically; if false, be sure to execute <a href="./capture-ctx.md#capturecontextstart">captureCtx.start()</a> in the page</td>
        </tr>
        <tr>
            <td>consoleLog</td>
            <td>boolean</td>
            <td>Whether to enable console log output</td>
        </tr>
        <tr>
            <td>videoPreprocessLog</td>
            <td>boolean</td>
            <td>Whether to enable video preprocessing log output</td>
        </tr>
        <tr>
            <td>videoDecoderHardwareAcceleration</td>
            <td>string</td>
            <td>The <a href="https://developer.mozilla.org/en-US/docs/Web/API/VideoDecoder/configure">VideoDecoder</a> hardware acceleration hint; default value: prefer-hardware</td>
        </tr>
        <tr>
            <td>parallelWriteFrames</td>
            <td>number</td>
            <td>Number of frames written to the stream in parallel</td>
        </tr>
    </tbody>
</table>

## Events

### progress

Synthesis progress event, callback parameters: (progress, processedFrameCount, totalFrameCount)

### completed

Synthesis completed event, callback parameters: (result)

### error

Error event, callback parameters: (err)

### pageCrashed

Page crashed event, callback parameters: (err)

## Members

### SingleVideo.registerFont(options: Object)

Register a font

#### options Parameter

See the [Font](#font) parameters.

### SingleVideo.registerFonts([options: Object, ...])

Register multiple fonts

#### options Parameter

See the [Font](#font) parameters.

### SingleVideo.addAudio(options: Object)

Add audio

#### options Parameter

See the [Audio](#audio) parameters.

### SingleVideo.addAudios([options: Object, ...])

Add multiple audio tracks

#### options Parameter

See the [Audio](#audio) parameters.

### SingleVideo.start()

Start single-scene rendering and synthesis

### SingleVideo.startAndWait(): Promise

Start single-scene rendering and synthesis and wait for completion

### SingleVideo.abort(): boolean

Abort rendering and synthesis; capture will be terminated early and the synthesis output will be completed with the frames captured so far. Returns whether the abort was successfully triggered.

### SingleVideo.onPageAcquire(fn: Function)

Register a page acquisition function; the function returns a [Page](./api-reference-low-level.md#page) instance. It is registered automatically when using the high-level API; registration is only needed when using this class directly with the [Low-Level API](./api-reference-low-level.md).

<br>

# MultiVideo

Multi-scene video

## Constructor

### new MultiVideo(options: Object)

#### options Parameter

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
            <td>outputPath</td>
            <td>string</td>
            <td>Video output path</td>
        </tr>
        <tr>
            <td>chunks</td>
            <td><a href="#chunkvideo">ChunkVideo</a>[]</td>
            <td>List of unrendered or rendered ChunkVideo items; can be ChunkVideo instances or plain objects</td>
        </tr>
        <tr>
            <td>backgroundOpacity</td>
            <td>number</td>
            <td>Background opacity (0-1); supported only by the webm format, used to export videos with an alpha channel</td>
        </tr>
        <tr>
            <td>startTime</td>
            <td>number</td>
            <td>Time point at which video capture starts</td>
        </tr>
        <tr>
            <td>fps</td>
            <td>number</td>
            <td>Video frame rate</td>
        </tr>
        <tr>
            <td>format</td>
            <td>string</td>
            <td>Exported video format (mp4/webm)</td>
        </tr>
        <tr>
            <td>attachCoverPath</td>
            <td>string</td>
            <td>Path to the cover image file attached to the first frame of the video</td>
        </tr>
        <tr>
            <td>coverCapture</td>
            <td>boolean</td>
            <td>Whether to capture and output a cover image</td>
        </tr>
        <tr>
            <td>coverCaptureTime</td>
            <td>number</td>
            <td>Cover image capture time point (milliseconds)</td>
        </tr>
        <tr>
            <td>coverCaptureFormat</td>
            <td>string</td>
            <td>Cover image capture format (jpg/png/bmp)</td>
        </tr>
        <tr>
            <td>coverCaptureQuality</td>
            <td>number</td>
            <td>Cover image capture JPG quality (0-100; higher values mean better quality, effective for the jpg format only)</td>
        </tr>
        <tr>
            <td>videoEncoder</td>
            <td>string</td>
            <td>Video encoder, see [Video Encoder Documentation](./video-encoder.md)</td>
        </tr>
        <tr>
            <td>videoQuality</td>
            <td>number</td>
            <td>Video quality (0-100)</td>
        </tr>
        <tr>
            <td>videoBitrate</td>
            <td>string</td>
            <td>Video bitrate (setting the bitrate ignores videoQuality)</td>
        </tr>
        <tr>
            <td>pixelFormat</td>
            <td>string</td>
            <td>Pixel format (yuv420p/yuv444p/rgb24/yuva420p). Transparent videos with backgroundOpacity&lt;1 must use a format with an alpha channel (yuva420p by default); explicitly specifying a format without alpha such as rgb24 will result in an error</td>
        </tr>
        <tr>
            <td>audioEncoder</td>
            <td>string</td>
            <td>Audio encoder; the default aac is recommended</td>
        </tr>
        <tr>
            <td>audioBitrate</td>
            <td>string</td>
            <td>Audio bitrate</td>
        </tr>
        <tr>
            <td>volume</td>
            <td>number</td>
            <td>Video volume (0-100)</td>
        </tr>
        <tr>
            <td>pagePrepareFn</td>
            <td>Function</td>
            <td>Page preprocessing function; allows manipulating the Page object before rendering</td>
        </tr>
        <tr>
            <td>timeActions</td>
            <td>Object{[key: Number]: Function}</td>
            <td>Sequence of timed actions; allows manipulating the Page object during rendering. The key is a Number specifying the render time point at which to trigger</td>
        </tr>
        <tr>
            <td>showProgress</td>
            <td>boolean</td>
            <td>Whether to display progress in the command line</td>
        </tr>
        <tr>
            <td>parallelWriteFrames</td>
            <td>number</td>
            <td>Number of frames written to the stream in parallel</td>
        </tr>
    </tbody>
</table>

## Events

### progress

Synthesis progress event, callback parameters: (progress: number, processedFrameCount: number, totalFrameCount: number)

### completed

Synthesis completed event, callback parameters: (result)

### error

Error event, callback parameters: (err)

## Members

### MultiVideo.registerFont(options: Object)

Register a font

#### options Parameter

See the [Font](#font) parameters.

### MultiVideo.registerFonts([options: Object, ...])

Register multiple fonts

#### options Parameter

See the [Font](#font) parameters.

### MultiVideo.addAudio(options: Object)

Add audio

#### options Parameter

See the [Audio](#audio) parameters.

### MultiVideo.addAudios([options: Object, ...])

Add multiple audio tracks

#### options Parameter

See the [Audio](#audio) parameters.

### MultiVideo.input(chunk: [ChunkVideo](#chunkvideo), [[transtion](#transition)])

Input a chunk video; optionally with a transition effect

#### chunk Parameter

See [ChunkVideo](#chunkvideo).

#### transtion Parameter

See [transtion](#transition).

### MultiVideo.start()

Start multi-scene video rendering and synthesis; if the input chunk videos have already been synthesized, rendering is skipped and the synthesis stage begins

### MultiVideo.startAndWait(): Promise

Start multi-scene video rendering and synthesis and wait for completion

### MultiVideo.onPageAcquire(fn: Function)

Register a page acquisition function; the function returns a [Page](./api-reference-low-level.md#page) instance. It is registered automatically when using the high-level API; registration is only needed when using this class directly with the [Low-Level API](./api-reference-low-level.md).

<br>

# ChunkVideo

Chunk video

## Constructor

### new ChunkVideo(options: Object)

#### options Parameter

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
            <td>URL of the page to render; choose either this or content</td>
        </tr>
        <tr>
            <td>content</td>
            <td>string</td>
            <td>Content of the page to render; choose either this or url</td>
        </tr>
        <tr>
            <td>backgroundOpacity</td>
            <td>number</td>
            <td>Background opacity (0-1); supported only by the webm format, used to export videos with an alpha channel</td>
        </tr>
        <tr>
            <td>waitTimeout</td>
            <td>number</td>
            <td>startAndWait timeout (milliseconds); 0 means no timeout, default 0</td>
        </tr>
        <tr>
            <td>outputPath</td>
            <td>string</td>
            <td>Video output path</td>
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
            <td>startTime</td>
            <td>number</td>
            <td>Time point at which video capture starts</td>
        </tr>
        <tr>
            <td>fps</td>
            <td>number</td>
            <td>Video frame rate</td>
        </tr>
        <tr>
            <td>transition</td>
            <td>string | <a href="#transition">Transition</a></td>
            <td>Transition effect into the next video chunk</td>
        </tr>
        <tr>
            <td>format</td>
            <td>string</td>
            <td>Exported video format (mp4/webm)</td>
        </tr>
        <tr>
            <td>attachCoverPath</td>
            <td>string</td>
            <td>Path to the cover image file attached to the first frame of the video</td>
        </tr>
        <tr>
            <td>coverCapture</td>
            <td>boolean</td>
            <td>Whether to capture and output a cover image</td>
        </tr>
        <tr>
            <td>coverCaptureTime</td>
            <td>number</td>
            <td>Cover image capture time point (milliseconds)</td>
        </tr>
        <tr>
            <td>coverCaptureFormat</td>
            <td>string</td>
            <td>Cover image capture format (jpg/png/bmp)</td>
        </tr>
        <tr>
            <td>coverCaptureQuality</td>
            <td>number</td>
            <td>Cover image capture JPG quality (0-100; higher values mean better quality, effective for the jpg format only)</td>
        </tr>
        <tr>
            <td>videoEncoder</td>
            <td>string</td>
            <td>Video encoder, see <a href="./video-encoder.md">Video Encoder Documentation</a></td>
        </tr>
        <tr>
            <td>videoQuality</td>
            <td>number</td>
            <td>Video quality (0-100)</td>
        </tr>
        <tr>
            <td>videoBitrate</td>
            <td>string</td>
            <td>Video bitrate (setting the bitrate ignores videoQuality)</td>
        </tr>
        <tr>
            <td>pixelFormat</td>
            <td>string</td>
            <td>Pixel format (yuv420p/yuv444p/rgb24/yuva420p). Transparent videos with backgroundOpacity&lt;1 must use a format with an alpha channel (yuva420p by default); explicitly specifying a format without alpha such as rgb24 will result in an error</td>
        </tr>
        <tr>
            <td>audioEncoder</td>
            <td>string</td>
            <td>Audio encoder; the default aac is recommended</td>
        </tr>
        <tr>
            <td>audioBitrate</td>
            <td>string</td>
            <td>Audio bitrate</td>
        </tr>
        <tr>
            <td>volume</td>
            <td>number</td>
            <td>Video volume (0-100)</td>
        </tr>
        <tr>
            <td>pageWaitForOptions</td>
            <td><a href="https://pptr.dev/api/puppeteer.waitforoptions">WaitForOptions</a></td>
            <td>Page wait options</td>
        </tr>
        <tr>
            <td>pageViewport</td>
            <td><a href="https://pptr.dev/api/puppeteer.viewport#properties">Viewport</a></td>
            <td>Page viewport parameters</td>
        </tr>
        <tr>
            <td>pagePrepareFn</td>
            <td>Function</td>
            <td>Page preprocessing function; allows manipulating the Page object before rendering</td>
        </tr>
        <tr>
            <td>timeActions</td>
            <td>Object{[key: Number]: Function}</td>
            <td>Sequence of timed actions; allows manipulating the Page object during rendering. The key is a Number specifying the render time point at which to trigger</td>
        </tr>
        <tr>
            <td>showProgress</td>
            <td>boolean</td>
            <td>Whether to display progress in the command line</td>
        </tr>
        <tr>
            <td>autostartRender</td>
            <td>boolean</td>
            <td>Whether to start rendering automatically; if false, be sure to execute captureCtx.start() in the page</td>
        </tr>
        <tr>
            <td>consoleLog</td>
            <td>boolean</td>
            <td>Whether to enable console log output</td>
        </tr>
        <tr>
            <td>videoPreprocessLog</td>
            <td>boolean</td>
            <td>Whether to enable video preprocessing log output</td>
        </tr>
        <tr>
            <td>parallelWriteFrames</td>
            <td>number</td>
            <td>Number of frames written to the stream in parallel</td>
        </tr>
    </tbody>
</table>

## Events

### progress

Synthesis progress event, callback parameters: (progress: number, processedFrameCount: number, totalFrameCount: number)

### completed

Synthesis completed event, callback parameters: (result)

### error

Error event, callback parameters: (err)

### pageCrashed

Page crashed event, callback parameters: (err)

## Members

### ChunkVideo.registerFont(options: Object)

Register a font

#### options Parameter

See the [Font](#font) parameters.

### ChunkVideo.registerFonts([options: Object, ...])

Register multiple fonts

#### options Parameter

See the [Font](#font) parameters.

### ChunkVideo.addAudio(options: Object)

Add audio

#### options Parameter

See the [Audio](#audio) parameters.

### ChunkVideo.addAudios([options: Object, ...])

Add multiple audio tracks

#### options Parameter

See the [Audio](#audio) parameters.

### ChunkVideo.setTransition(options: Object)

Set the transition effect

#### options Parameter

See the [Transition](#transition) parameters.

### ChunkVideo.start()

Start chunk video rendering and synthesis; after rendering, the chunk video must be input to a [MultiVideo](#multivideo) for final video synthesis

### ChunkVideo.startAndWait(): Promise

Start chunk video rendering and synthesis and wait for completion

### ChunkVideo.abort(): boolean

Abort rendering and synthesis; capture will be terminated early and the synthesis output will be completed with the frames captured so far. Returns whether the abort was successfully triggered.

### ChunkVideo.onPageAcquire(fn: Function)

Register a page acquisition function; the function returns a [Page](./api-reference-low-level.md#page) instance. It is registered automatically when using the high-level API; registration is only needed when using this class directly with the [Low-Level API](./api-reference-low-level.md).

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
            <td>Number of fetch retry attempts</td>
        </tr>
        <tr>
            <td>ignoreCache</td>
            <td>boolean</td>
            <td>Whether to ignore the local cache</td>
        </tr>
    </tbody>
</table>

# Transition

Transition parameters, see [Transition Effects](./transition.md).

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
            <td>Number of fetch retry attempts</td>
        </tr>
        <tr>
            <td>ignoreCache</td>
            <td>boolean</td>
            <td>Whether to ignore the local cache</td>
        </tr>
    </tbody>
</table>
