

  function subractAdjacentFrames(){
    // let t = video.currentTime;
    // let tempCanvas = document.createElement("canvas");
    // let ctxAux = tempCanvas.getContext("2d");
    ctxAux.drawImage(video, video.width, video.height);
    let img1 = ctxAux.getImageData(0, 0, video.width, video.height);
    let src1 = cv.matFromImageData(img1);

    video.currentTime += 1.0/30.0;
    ctxAux.drawImage(video, video.width, video.height);
    let img2 = ctxAux.getImageData(0, 0, video.width, video.height);
    let src2 = cv.matFromImageData(img2);

    let dst = new cv.Mat();
    cv.subtract(src1, src2, dst)

    // let ctxAux = $("#canvasAux").get()[0].getContext("2d");
    let imgData = new ImageData(new Uint8ClampedArray(dst.data), dst.cols, dst.rows);
    imgData = setOpaque(imgData);
    ctxAux.putImageData(imgData, 0, 0);

  }


