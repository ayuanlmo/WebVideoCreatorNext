# Video Encoders

Import the video encoder constants from the module to use them.

```javascript
import { VIDEO_ENCODER } from "web-video-creator-next";

console.log(VIDEO_ENCODER.CPU.H264);  // outputs libx264
console.log(VIDEO_ENCODER.NVIDIA.H264);  // outputs h264_nvenc
```

## CPU Software Encoders

Software encoders are usually slower; it is recommended to use one of the hardware encoders below depending on your device's support.

<table width="100%">
    <thead>
        <tr>
            <th>Constant</th>
            <th>Encoder Name</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>CPU.H264</td>
            <td>libx264</td>
            <td>Software H264 encoding on CPU; compatible container: mp4</td>
        </tr>
        <tr>
            <td>CPU.H265</td>
            <td>libx265</td>
            <td>Software H265 encoding on CPU; compatible container: mp4</td>
        </tr>
        <tr>
            <td>CPU.VP8</td>
            <td>libvpx</td>
            <td>Software VP8 encoding on CPU; compatible container: webm</td>
        </tr>
        <tr>
            <td>CPU.VP9</td>
            <td>libvpx-vp9</td>
            <td>Software VP9 encoding on CPU; compatible container: webm</td>
        </tr>
    </tbody>
</table>

## Intel QSV Encoders

<table width="100%">
    <thead>
        <tr>
            <th>Constant</th>
            <th>Encoder Name</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>INTEL.H264</td>
            <td>h264_qsv</td>
            <td>H264 encoding accelerated by QSV on Intel integrated or discrete GPUs; compatible container: mp4</td>
        </tr>
        <tr>
            <td>INTEL.H265</td>
            <td>hevc_qsv</td>
            <td>H265 encoding accelerated by QSV on Intel integrated or discrete GPUs; compatible container: mp4</td>
        </tr>
        <tr>
            <td>INTEL.VP8</td>
            <td>vp8_qsv</td>
            <td>VP8 encoding accelerated by QSV on Intel integrated or discrete GPUs; compatible container: webm</td>
        </tr>
        <tr>
            <td>INTEL.VP9</td>
            <td>vp9_qsv</td>
            <td>VP9 encoding accelerated by QSV on Intel integrated or discrete GPUs; compatible container: webm</td>
        </tr>
    </tbody>
</table>

## AMD AMF Encoders

<table width="100%">
    <thead>
        <tr>
            <th>Constant</th>
            <th>Encoder Name</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>AMD.H264</td>
            <td>h264_amf</td>
            <td>H264 encoding accelerated by AMF on AMD integrated or discrete GPUs; compatible container: mp4</td>
        </tr>
        <tr>
            <td>AMD.H265</td>
            <td>h265_amf</td>
            <td>H265 encoding accelerated by AMF on AMD integrated or discrete GPUs; compatible container: mp4</td>
        </tr>
    </tbody>
</table>

## Nvidia NvENC Encoders

Consumer-grade graphics cards are subject to a limit of at most two parallel NVENC encoding sessions; this must be resolved with a [patch](https://github.com/keylase/nvidia-patch).

<table width="100%">
    <thead>
        <tr>
            <th>Constant</th>
            <th>Encoder Name</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>NVIDIA.H264</td>
            <td>h264_nvenc</td>
            <td>H264 encoding accelerated by NVENC on Nvidia GPUs; compatible container: mp4</td>
        </tr>
        <tr>
            <td>NVIDIA.H265</td>
            <td>hevc_nvenc</td>
            <td>H265 encoding accelerated by NVENC on Nvidia GPUs; compatible container: mp4</td>
        </tr>
    </tbody>
</table>

## OpenOMX Encoders

<table width="100%">
    <thead>
        <tr>
            <th>Constant</th>
            <th>Encoder Name</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>OMX.H264</td>
            <td>h264_omx</td>
            <td>H264 encoding accelerated by OpenOMX, suitable for embedded platforms; compatible container: mp4</td>
        </tr>
    </tbody>
</table>

## V4L2 Encoders

<table width="100%">
    <thead>
        <tr>
            <th>Constant</th>
            <th>Encoder Name</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>V4L2.H264</td>
            <td>h264_v4l2m2m</td>
            <td>H264 encoding accelerated by V4L2; compatible container: mp4</td>
        </tr>
    </tbody>
</table>

## VAAPI Encoders

<table width="100%">
    <thead>
        <tr>
            <th>Constant</th>
            <th>Encoder Name</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>VAAPI.H264</td>
            <td>h264_vaapi</td>
            <td>H264 encoding accelerated by VAAPI; compatible container: mp4</td>
        </tr>
        <tr>
            <td>VAAPI.H265</td>
            <td>hevc_vaapi</td>
            <td>H265 encoding accelerated by VAAPI; compatible container: mp4</td>
        </tr>
        <tr>
            <td>VAAPI.VP8</td>
            <td>vp8_vaapi</td>
            <td>VP8 encoding accelerated by VAAPI; compatible container: webm</td>
        </tr>
        <tr>
            <td>VAAPI.VP9</td>
            <td>vp9_vaapi</td>
            <td>VP9 encoding accelerated by VAAPI; compatible container: webm</td>
        </tr>
    </tbody>
</table>

## VIDEOTOOLBOX Encoders

<table width="100%">
    <thead>
        <tr>
            <th>Constant</th>
            <th>Encoder Name</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>VIDEOTOOLBOX.H264</td>
            <td>h264_videotoolbox</td>
            <td>H264 encoding accelerated by VIDEOTOOLBOX, for macOS; compatible container: mp4</td>
        </tr>
        <tr>
            <td>VIDEOTOOLBOX.H265</td>
            <td>hevc_videotoolbox</td>
            <td>H265 encoding accelerated by VIDEOTOOLBOX, for macOS; compatible container: mp4</td>
        </tr>
    </tbody>
</table>
