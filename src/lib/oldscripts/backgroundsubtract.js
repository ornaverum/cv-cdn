let video = document.getElementById('videoInput');
let cap = new cv.VideoCapture(video);

let frame = new cv.Mat(video.height, video.width, cv.CV_8UC4);
let fgmask = new cv.Mat(video.height, video.width, cv.CV_8UC1);
let fgbg = new cv.BackgroundSubtractorMOG2(500, 50, true);
$("#videoInput").show();
$("#canvasAux").show();
const FPS = 30;
function processVideo() {

        let begin = Date.now();
        // start processing.
        cap.read(frame);
        fgbg.apply(frame, fgmask);
        cv.imshow('canvasAux', fgmask, -1);
        // schedule the next one.
        let delay = 1000/FPS - (Date.now() - begin);
        setTimeout(processVideo, delay);

};

// schedule the first one.
setTimeout(processVideo, 0);


// cv.BackgroundSubtractorMOG2 (history = 500, varThreshold = 16, detectShadows = true)

// Parameters
// history	Length of the history.
// varThreshold	Threshold on the squared distance between the pixel and the sample to decide whether a pixel is close to that sample. This parameter does not affect the background update.
// detectShadows	If true, the algorithm will detect shadows and mark them. It decreases the speed a bit, so if you do not need this feature, set the parameter to false.


// Use apply (image, fgmask, learningRate = -1) method to get the foreground mask

// Parameters
// image	Next video frame. Floating point frame will be used without scaling and should be in range [0,255].
// fgmask	The output foreground mask as an 8-bit binary image.
// learningRate	The value between 0 and 1 that indicates how fast the background model is learnt. Negative parameter value makes the algorithm to use some automatically chosen learning rate. 0 means that the background model is not updated at all, 1 means that the background model is completely reinitialized from the last frame.