# Transition Effects

All transitions currently used come from FFmpeg's built-in [Xfade](https://trac.ffmpeg.org/wiki/Xfade) transition filter.

Import the transition effect constants from the module to use them.

```javascript
import { TRANSITION } from "web-video-creator-next";

console.log(TRANSITION.FADE);  // outputs fade
console.log(TRANSITION.CIRCLE_OPEN);  // outputs circleopen
```

<table width="100%">
    <thead>
        <tr>
            <th>Constant</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>FADE</td>
            <td>Fade in/out</td>
        </tr>
        <tr>
            <td>WIPE_LEFT</td>
            <td>Wipe from right to left</td>
        </tr>
        <tr>
            <td>WIPE_RIGHT</td>
            <td>Wipe from left to right</td>
        </tr>
        <tr>
            <td>WIPE_UP</td>
            <td>Wipe from bottom to top</td>
        </tr>
        <tr>
            <td>WIPE_DOWN</td>
            <td>Wipe from top to bottom</td>
        </tr>
        <tr>
            <td>SLIDE_LEFT</td>
            <td>Slide from right to left</td>
        </tr>
        <tr>
            <td>SLIDE_RIGHT</td>
            <td>Slide from left to right</td>
        </tr>
        <tr>
            <td>SLIDE_UP</td>
            <td>Slide from bottom to top</td>
        </tr>
        <tr>
            <td>SLIDE_DOWN</td>
            <td>Slide from top to bottom</td>
        </tr>
        <tr>
            <td>CIRCLE_CROP</td>
            <td>Circular crop transition</td>
        </tr>
        <tr>
            <td>RECT_CROP</td>
            <td>Rectangular crop transition</td>
        </tr>
        <tr>
            <td>DISTANCE</td>
            <td>Color-block transition</td>
        </tr>
        <tr>
            <td>FADE_BLACK</td>
            <td>Fade through black</td>
        </tr>
        <tr>
            <td>FADE_WHITE</td>
            <td>Fade through white</td>
        </tr>
        <tr>
            <td>RADIAL</td>
            <td>Radar sweep</td>
        </tr>
        <tr>
            <td>SMOOTH_LEFT</td>
            <td>Smooth transition from right to left</td>
        </tr>
        <tr>
            <td>SMOOTH_RIGHT</td>
            <td>Smooth transition from left to right</td>
        </tr>
        <tr>
            <td>SMOOTH_UP</td>
            <td>Smooth transition from bottom to top</td>
        </tr>
        <tr>
            <td>SMOOTH_DOWN</td>
            <td>Smooth transition from top to bottom</td>
        </tr>
        <tr>
            <td>CIRCLE_OPEN</td>
            <td>Circle-open transition</td>
        </tr>
        <tr>
            <td>CIRCLE_CLOSE</td>
            <td>Circle-close transition</td>
        </tr>
        <tr>
            <td>VERT_OPEN</td>
            <td>Vertical open transition</td>
        </tr>
        <tr>
            <td>VERT_CLOSE</td>
            <td>Vertical close transition</td>
        </tr>
        <tr>
            <td>HORZ_OPEN</td>
            <td>Horizontal open transition</td>
        </tr>
        <tr>
            <td>HORZ_CLOSE</td>
            <td>Horizontal close transition</td>
        </tr>
        <tr>
            <td>DISSOLVE</td>
            <td>Dissolve transition</td>
        </tr>
        <tr>
            <td>PIXELIZE</td>
            <td>Pixelize transition</td>
        </tr>
        <tr>
            <td>DIAGL</td>
            <td>Bottom-right diagonal transition</td>
        </tr>
        <tr>
            <td>DIAGTR</td>
            <td>Bottom-left diagonal transition</td>
        </tr>
        <tr>
            <td>DIAGBL</td>
            <td>Top-right diagonal transition</td>
        </tr>
        <tr>
            <td>DIAGBR</td>
            <td>Top-left diagonal transition</td>
        </tr>
        <tr>
            <td>SLICE_LEFT</td>
            <td>Horizontal venetian-blind transition from right to left</td>
        </tr>
        <tr>
            <td>SLICE_RIGHT</td>
            <td>Horizontal venetian-blind transition from left to right</td>
        </tr>
        <tr>
            <td>SLICE_UP</td>
            <td>Vertical venetian-blind transition from right to left</td>
        </tr>
        <tr>
            <td>SLICE_DOWN</td>
            <td>Vertical venetian-blind transition from right to left</td>
        </tr>
        <tr>
            <td>HBLUR</td>
            <td>High-speed blur effect</td>
        </tr>
        <tr>
            <td>FADE_GRAYS</td>
            <td>Grayscale gradient</td>
        </tr>
        <tr>
            <td>WIPE_TL</td>
            <td>Wipe from bottom-right to top-left</td>
        </tr>
        <tr>
            <td>WIPE_TR</td>
            <td>Wipe from bottom-left to top-right</td>
        </tr>
        <tr>
            <td>WIPE_BL</td>
            <td>Wipe from top-right to bottom-left</td>
        </tr>
        <tr>
            <td>WIPE_BR</td>
            <td>Wipe from top-left to bottom-right</td>
        </tr>
        <tr>
            <td>SQUEEZEH</td>
            <td>Horizontal squeeze</td>
        </tr>
        <tr>
            <td>SQUEEZEV</td>
            <td>Vertical squeeze</td>
        </tr>
        <tr>
            <td>ZOOM_IN</td>
            <td>Zoom-in transition</td>
        </tr>
        <tr>
            <td>WIND_LEFT</td>
            <td>Sweep from right to left</td>
        </tr>
        <tr>
            <td>WIND_RIGHT</td>
            <td>Sweep from left to right</td>
        </tr>
        <tr>
            <td>WIND_UP</td>
            <td>Sweep from bottom to top</td>
        </tr>
        <tr>
            <td>WIND_DOWN</td>
            <td>Sweep from top to bottom</td>
        </tr>
        <tr>
            <td>COVER_LEFT</td>
            <td>Cover from right to left</td>
        </tr>
        <tr>
            <td>COVER_RIGHT</td>
            <td>Cover from left to right</td>
        </tr>
        <tr>
            <td>COVER_UP</td>
            <td>Cover from bottom to top</td>
        </tr>
        <tr>
            <td>COVER_DOWN</td>
            <td>Cover from top to bottom</td>
        </tr>
        <tr>
            <td>REVEAL_LEFT</td>
            <td>Reveal from right to left</td>
        </tr>
        <tr>
            <td>REVEAL_RIGHT</td>
            <td>Reveal from left to right</td>
        </tr>
        <tr>
            <td>REVEAL_UP</td>
            <td>Reveal from bottom to top</td>
        </tr>
        <tr>
            <td>REVEAL_DOWN</td>
            <td>Reveal from top to bottom</td>
        </tr>
    </tbody>
</table>
