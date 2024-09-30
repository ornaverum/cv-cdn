export function getGrayFrame(frame){
    cv.cvtColor(frame, frame, cv.COLOR_RGBA2GRAY);
}

export function getForground(src){
    let mask = new cv.Mat();
    let bgdModel = new cv.Mat();
    let fgdModel = new cv.Mat();
    let rect = new cv.Rect(50, 50, 260, 280);
    cv.grabCut(src, mask, rect, bgdModel, fgdModel, 1, cv.GC_INIT_WITH_RECT);
    // draw foreground
    for (let i = 0; i < src.rows; i++) {
        for (let j = 0; j < src.cols; j++) {
            if (mask.ucharPtr(i, j)[0] == 0 || mask.ucharPtr(i, j)[0] == 2) {
                src.ucharPtr(i, j)[0] = 0;
                src.ucharPtr(i, j)[1] = 0;
                src.ucharPtr(i, j)[2] = 0;
            }
        }
    }
    // draw grab rect
    // let color = new cv.Scalar(0, 0, 255);
    // let point1 = new cv.Point(rect.x, rect.y);
    // let point2 = new cv.Point(rect.x + rect.width, rect.y + rect.height);
    // cv.rectangle(src, point1, point2, color);
    // cv.imshow('canvasOutput', src);
    // src.delete(); 
    mask.delete(); bgdModel.delete(); fgdModel.delete();
}