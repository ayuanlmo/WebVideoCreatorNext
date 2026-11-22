# The Uncertain Rendering Environment

In everyday use, browsers do not render animations "in real time sync". When system load is high, dropped frames may occur, making animations look less smooth; moreover, to improve performance browsers usually offload some decoding/rendering tasks to other threads, which means the timelines between animations are not synchronized (the video element is a typical example :P). All of this is unreliable for video rendering — every frame of a video's animation must be deterministic.

# The Deterministic Rendering Environment

To the code performing the rendering, nothing is noticeable — everything proceeds as usual, except that the flow of time becomes controllable. The currentTime returned by RAF, the invocation timing of setTimeout/setInterval callbacks, Date, performance.now, and so on are all determined by the currently rendered progress. Besides taking over the clock, for media that developers usually do not control — such as animated images and embedded videos — some experimental [WebCodecs API](https://github.com/w3c/webcodecs) are used to take them over.
