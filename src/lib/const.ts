// 支持的格式枚举
export const SUPPORT_FORMAT: string[] = [
    "mp4",
    "webm"
];

// 视频编码器
export const VIDEO_ENCODER = {
    CPU: {
        H264: "libx264", // CPU软编码H264（mp4）
        H265: "libx265", // CPU软编码H265（mp4）
        VP8: "libvpx", // CPU软编码VP8（webm）
        VP9: "libvpx-vp9" // CPU软编码VP9（webm）
    },
    INTEL: {
        H264: "h264_qsv", // Intel核显/独显QSV加速H264（mp4）
        H265: "hevc_qsv", // Intel核显/独显QSV加速H265（mp4）
        VP8: "vp8_qsv", // Intel核显/独显QSV加速VP8（webm）
        VP9: "vp9_qsv" // Intel核显/独显QSV加速VP9（webm）
    },
    AMD: {
        H264: "h264_amf", // AMD核显/独显AMF加速H264（mp4）
        H265: "h265_amf" // AMD核显/独显AMF加速H265（mp4）
    },
    NVIDIA: {
        // 支持型号：https://developer.nvidia.com/video-encode-and-decode-gpu-support-matrix-new
        H264: "h264_nvenc", // NVIDIA显卡NVENC加速H264（mp4）
        H265: "hevc_nvenc" // NVIDIA显卡NVENC加速H265（mp4）
    },
    OMX: {
        H264: "h264_omx" // OpenOMX加速H264（mp4），可能适用于嵌入式平台
    },
    V4L2: {
        H264: "h264_v4l2m2m" // V4L2加速H264（mp4）
    },
    VAAPI: {
        H264: "h264_vaapi", // VAAPI加速H264（mp4）
        H265: "hevc_vaapi", // VAAPI加速H265（mp4）
        VP8: "vp8_vaapi", // VAAPI加速VP8（webm）
        VP9: "vp9_vaapi" // VAAPI加速VP9（webm）
    },
    VIDEOTOOLBOX: {
        H264: "h264_videotoolbox", // VideoToolbox加速H264（mp4，macOS）
        H265: "hevc_videotoolbox" // VideoToolbox加速H265（mp4，macOS）
    }
} as const;

// 视频编码器映射
export const VIDEO_ENCODER_MAP: Record<string, string[]> = Object.values(VIDEO_ENCODER).reduce((map, o): Record<string, string[]> => {
    Object.entries(o).forEach(([type, codec]): void => {
        !map[type] && (map[type] = []);
        map[type].push(codec)
    });
    return map;
}, {} as Record<string, string[]>);

export const AUDIO_ENCODER = {
    AAC: "aac", // AAC音频编码（推荐）
    OPUS: "libopus" // OPUS音频编码
} as const

// 音频编码器映射
export const AUDIO_ENCODER_MAP: Record<string, string[]> = Object.values(AUDIO_ENCODER).reduce((map, o): Record<string, string[]> => {
    Object.entries(o).forEach(([type, codec]): void => {
        !map[type] && (map[type] = []);
        map[type].push(codec)
    });
    return map;
}, {} as Record<string, string[]>);

// 比特流过滤器
export const BITSTREAM_FILTER = {
    H264: "h264_mp4toannexb",
    H265: "hevc_mp4toannexb",
    VP9: "vp9_superframe"
} as const;

// 视频格式映射到支持的视频编码器
export const FORMAT_VIDEO_ENCODER_MAP = {
    "mp4": [
        VIDEO_ENCODER.CPU.H264,
        VIDEO_ENCODER.CPU.H265,
        VIDEO_ENCODER.INTEL.H264,
        VIDEO_ENCODER.INTEL.H265,
        VIDEO_ENCODER.AMD.H264,
        VIDEO_ENCODER.AMD.H265,
        VIDEO_ENCODER.NVIDIA.H264,
        VIDEO_ENCODER.NVIDIA.H265,
        VIDEO_ENCODER.OMX.H264,
        VIDEO_ENCODER.V4L2.H264,
        VIDEO_ENCODER.VAAPI.H264,
        VIDEO_ENCODER.VAAPI.H265,
        VIDEO_ENCODER.VIDEOTOOLBOX.H264,
        VIDEO_ENCODER.VIDEOTOOLBOX.H265
    ],
    "webm": [
        VIDEO_ENCODER.CPU.VP8,
        VIDEO_ENCODER.CPU.VP9,
        VIDEO_ENCODER.INTEL.VP9,
        VIDEO_ENCODER.VAAPI.VP8,
        VIDEO_ENCODER.VAAPI.VP9
    ],
    "ts": [
        VIDEO_ENCODER.CPU.H264,
        VIDEO_ENCODER.CPU.H265,
        VIDEO_ENCODER.INTEL.H264,
        VIDEO_ENCODER.INTEL.H265,
        VIDEO_ENCODER.AMD.H264,
        VIDEO_ENCODER.AMD.H265,
        VIDEO_ENCODER.NVIDIA.H264,
        VIDEO_ENCODER.NVIDIA.H265,
        VIDEO_ENCODER.OMX.H264,
        VIDEO_ENCODER.V4L2.H264,
        VIDEO_ENCODER.VAAPI.H264,
        VIDEO_ENCODER.VAAPI.H265,
        VIDEO_ENCODER.VIDEOTOOLBOX.H264,
        VIDEO_ENCODER.VIDEOTOOLBOX.H265
    ]
};

// 视频格式映射到支持的音频编码器
export const FORMAT_AUDIO_ENCODER_MAP = {
    "mp4": [
        AUDIO_ENCODER.AAC,
        AUDIO_ENCODER.OPUS
    ],
    "webm": [
        AUDIO_ENCODER.AAC,
        AUDIO_ENCODER.OPUS
    ]
};

// Xfade转场滤镜
// 请参考：http://trac.ffmpeg.org/wiki/Xfade
export const TRANSITION = {
    FADE: "fade", // 淡入淡出
    WIPE_LEFT: "wipeleft", // 从右向左擦除
    WIPE_RIGHT: "wiperight", // 从左向右擦除
    WIPE_UP: "wipeup", // 从下往上擦除
    WIPE_DOWN: "wipedown", // 从上往下擦除
    SLIDE_LEFT: "slideleft", // 从右向左滑动
    SLIDE_RIGHT: "slideright", // 从左向右滑动
    SLIDE_UP: "slideup", // 从下往上滑动
    SLIDE_DOWN: "slidedown", // 从上往下滑动
    CIRCLE_CROP: "circlecrop", // 圆形裁剪过渡
    RECT_CROP: "rectcrop", // 矩形裁剪过渡
    DISTANCE: "distance", // 色块过渡
    FADE_BLACK: "fadeblack", // 黑色渐变淡入淡出
    FADE_WHITE: "fadewhite", // 白色渐变淡入淡出
    RADIAL: "radial", // 雷达扫描
    SMOOTH_LEFT: "smoothleft", // 从右向左平滑过渡
    SMOOTH_RIGHT: "smoothright", // 从左向右平滑过渡
    SMOOTH_UP: "smoothup", // 从下向上平滑过渡
    SMOOTH_DOWN: "smoothdown", // 从上向下平滑过渡
    CIRCLE_OPEN: "circleopen", // 圆形开放过渡
    CIRCLE_CLOSE: "circleclose", // 圆形闭合过渡
    VERT_OPEN: "vertopen", // 垂直方向开放过渡
    VERT_CLOSE: "vertclose", // 垂直方向闭合过渡
    HORZ_OPEN: "horzopen", // 水平方向开放过渡
    HORZ_CLOSE: "horzclose", // 水平方向闭合过渡
    DISSOLVE: "dissolve", // 溶解过渡
    PIXELIZE: "pixelize", // 像素化过渡
    DIAGL: "diagtl", // 右下对角线过渡
    DIAGTR: "diagtr", // 左下对角线过渡
    DIAGBL: "diagbl", // 右上对角线过渡
    DIAGBR: "diagbr", // 左上对角线过渡
    SLICE_LEFT: "hlslice", // 水平从右向左百叶窗过渡
    SLICE_RIGHT: "hrslice", // 水平从左向右百叶窗过渡
    SLICE_UP: "vuslice", // 垂直从右向左百叶窗过渡
    SLICE_DOWN: "vdslice", // 垂直从右向左百叶窗过渡
    HBLUR: "hblur", // 高速模糊效果
    FADE_GRAYS: "fadegrays", // 灰度渐变
    WIPE_TL: "wipetl", // 从右下向左上擦除
    WIPE_TR: "wipetr", // 从左下向右上角擦除
    WIPE_BL: "wipebl", // 从右上向左下擦除
    WIPE_BR: "wipebr", // 从左上向右下擦除
    SQUEEZEH: "squeezeh", // 水平挤压
    SQUEEZEV: "squeezev", // 垂直挤压
    ZOOM_IN: "zoomin", // 放大过渡
    WIND_LEFT: "hlwind", // 从右向左扫过
    WIND_RIGHT: "hrwind", // 从左向右扫过
    WIND_UP: "vuwind", // 从下向上扫过
    WIND_DOWN: "vdwind", // 从上向下扫过
    COVER_LEFT: "coverleft", // 从右向左覆盖
    COVER_RIGHT: "coverright", // 从左向右覆盖
    COVER_UP: "coverup", // 从下向上覆盖
    COVER_DOWN: "coverdown", // 从上向下覆盖
    REVEAL_LEFT: "revealleft", // 从右向左揭开
    REVEAL_RIGHT: "revealright", // 从左向右揭开
    REVEAL_UP: "revealup", // 从下向上揭开
    REVEAL_DOWN: "revealdown" // 从上向下揭开
} as const;
