let video = $("#videoInput").get(0);

let cap = new cv.VideoCapture(video);

let priorFrame = new cv.Mat(video.height, video.width, cv.CV_8UC4);
let currentFrame = new cv.Mat(video.height, video.width, cv.CV_8UC4);

let currentFrameGray = new cv.Mat(video.height, video.width, cv.CV_8UC1);
let priorFrameGray = new cv.Mat(video.height, video.width, cv.CV_8UC1);

let mask= new cv.Mat();
let dtype = -1;
let frameDiff = new cv.Mat(video.height, video.width, cv.CV_8UC1);
let streamDiff = new cv.Mat(video.height, video.width, cv.CV_8UC1);

$("#videoInput").show();
$("#canvasAux").show();




cap.read(priorFrame);


const FPS = 30;
function processVideo() {

        let begin = Date.now();
        // start processing.
        cap.read(currentFrame);
        cv.cvtColor(currentFrame, currentFrameGray, cv.COLOR_RGBA2GRAY);
        cv.cvtColor(priorFrame, priorFrameGray, cv.COLOR_RGBA2GRAY);
        cv.subtract(currentFrameGray, priorFrameGray, frameDiff, mask, dtype);
        cv.threshold(frameDiff, frameDiff, 5, 200, cv.THRESH_BINARY);
        cv.imshow('canvasAux', frameDiff);
        cv.add(frameDiff, streamDiff, streamDiff, mask, dtype);
        cv.threshold(streamDiff, streamDiff, 10, 200, cv.THRESH_BINARY);
        cv.imshow('canvasOutput', streamDiff);

        // schedule the next one.
        // currentFrame.copyTo(priorFrame);
        let delay = 1000/FPS - (Date.now() - begin);
        setTimeout(processVideo, delay);

};

// schedule the first one.
setTimeout(processVideo, 0);