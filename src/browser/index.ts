/// <reference path="./globals.d.ts" />
import innerUtil from "./inner-util";
import MP4Demuxer from "./media/MP4Demuxer";
import VideoCanvas from "./media/VideoCanvas";
import LottieCanvas from "./media/LottieCanvas";
import SvgAnimation from "./media/SvgAnimation";
import DynamicImage from "./media/DynamicImage";
import CaptureContext from "./CaptureContext";

// 浏览器侧 bundle 入口

window.____util = innerUtil();
window.____MP4Demuxer = MP4Demuxer;
window.____SvgAnimation = SvgAnimation;
window.____VideoCanvas = VideoCanvas;
window.____DynamicImage = DynamicImage;
window.____LottieCanvas = LottieCanvas;
window.____CaptureContext = CaptureContext;
window.captureCtx = new CaptureContext();
