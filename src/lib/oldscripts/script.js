$(document).ready(function () {
  const video = $("#videoInput").get(0);
  const canvas = $("#canvasOutput").get(0);
  const canvasAux = $("#canvasAux").get(0);
  const canvasTemplate = $("#canvasTemplate").get(0);
  const canvasROI = $("#canvasROI").get(0);

  const canvasVideoMirror = document.createElement("canvas");
  canvasVideoMirror.setAttribute("id", "canvasVideoMirror");

  var startingTime, stoppingTime;
  
  var priorFrame, currentFrame;
  var priorROI, currentROI;

  var templateMat;
  var templateBox;
  var roiBox;
  var trackWindow;
  var roiWindow;


  var trackFromDeltasList = false;

  var stabilizeManual = false;
  var stabilizeAuto = false;

  var useROI = false;
  var useTemplate = false;

  var pointsContainer = {};
  var cap;
  var FPS;
  var templateColor;

  function distance(coords1, coords2) {
    return ((coords1.x - coords2.x) ** 2 + (coords1.y - coords2.y) ** 2) ** 0.5;
  }

  class Line {
    constructor() {
      this.name = "Line";
      this.start = { x: 0, y: 0 };
      this.end = { x: 0, y: 0 };
      this.color = [255, 0, 0, 255];
      this.lineWidth = 5;
    }

    draw(frame) {
      // console.log(ctx);
      cv.line(frame, this.start, this.end, this.color, this.lineWidth);
    }
    updateStart(coords) {
      this.start = coords;
    }
    updateEnd(coords) {
      this.end = coords;
    }
  }

  class Recticle {
    constructor() {
      this.name = "Recticle";
      this.outerDiameter = 20.0;
      this.innerDiameter = 5.0;
      this.coords = { x: 0, y: 0 };
      this.color = [0, 0, 255, 255];
      this.lineWidth = 1.0;
    }

    updateCoords(coords) {
      this.coords = coords;
    }

    isClicked(coords) {
      return distance(coords, this.coords) < this.outerDiameter;
    }

    draw(frame) {
      cv.circle(
        frame,
        this.coords,
        this.outerDiameter,
        this.color,
        this.lineWidth
      );
      cv.circle(
        frame,
        this.coords,
        this.innerDiameter,
        this.color,
        this.lineWidth
      );
    }
  }

  class Box {
    constructor() {
      this.name = "Box";
      this.sideLength;
      this.coords = { x: 0, y: 0 };
      this.size = { height: 0, width: 0 };
      this.color = [255, 0, 255, 255];
      this.lineWidth = 2;
      this.lineDash = 5;
    }
    updateCoords(coords) {
      this.coords = coords;
    }
    updateCorner(cornerCoords) {
      this.size = {
        width: cornerCoords.x - this.coords.x,
        height: cornerCoords.y - this.coords.y,
      };
    }

    getCornerCoords() {
      return {
        x1: this.coords.x,
        y1: this.coords.y,
        x2: this.coords.x + this.size.width,
        y2: this.coords.y + this.size.height,
      };
    }

    getInnerCoordsSize() {
      let x =
        Math.min(this.coords.x, this.coords.x + this.size.width) + this.lineWidth;
      let width = Math.abs(this.size.width) - 2 * this.lineWidth;
      let y =
        Math.min(this.coords.y, this.coords.y + this.size.height) + this.lineWidth;
      let height = Math.abs(this.size.height) - 2 * this.lineWidth;
      return {
        x: x,
        y: y,
        width: width,
        height: height,
      };
    }

    draw(frame) {
      // cv.rectangle(frame,(384,0),(510,128),(0,255,0),3)
      cv.rectangle(
        frame,
        new cv.Point(this.coords.x, this.coords.y),
        new cv.Point(this.coords.x + this.size.width, this.coords.y + this.size.height),
        new cv.Scalar(255, 0, 255, 255),
        this.lineWidth,
        cv.LINE_8,
        0
      );
    }

    resetBox() {
      this.coords = { x: 0, y: 0 };
      this.size = { height: 0, width: 0 };
    }

    getCVRect(){
      return new cv.Rect(this.coords.x, this.coords.y, this.size.width, this.size.height);
    }
  }

  class Axis {
    constructor() {
      this.name = "Axis";
      this.origin = { x: 0, y: 0 };
      this.axisLength = 100;
      this.color = [0, 0, 0, 255];
      this.angle = 0;
      this.xaxis = new Line();
      this.yaxis = new Line();
      this.originRecticle = new Recticle();
      this.xRecticle = new Recticle();
      this.yRecticle = new Recticle();
      this.originSelected = false;
      this.xSelected = false;
      this.ySelected = false;
      this.updateAxes();
    }

    updateOrigin(coords) {
      this.origin = coords;
      this.updateAxes();
    }

    updateAngle(angle) {
      this.angle = angle;
    }

    updateAxes() {
      this.originRecticle.updateCoords(this.origin);
      this.originRecticle.color = "aqua";
      this.originRecticle.lineWidth = 2;
      this.xRecticle.color = "aqua";
      this.yRecticle.color = "aqua";
      let xEnd = { x: this.origin.x + this.axisLength, y: this.origin.y };
      let yEnd = { x: this.origin.x, y: this.origin.y - this.axisLength };

      this.xaxis.updateStart(this.origin);
      this.xaxis.updateEnd(xEnd);
      this.xRecticle.updateCoords(xEnd);
      this.xaxis.lineWidth = 2;
      this.xaxis.color = "cyan";

      this.yaxis.updateStart(this.origin);
      this.yaxis.updateEnd(yEnd);
      this.yRecticle.updateCoords(yEnd);
      this.yaxis.lineWidth = 2;
      this.yaxis.color = "cyan";
    }

    draw(frame) {
      this.yaxis.draw(frame);
      this.xaxis.draw(frame);
      this.originRecticle.draw(frame);
      this.yRecticle.draw(frame);
      this.xRecticle.draw(frame);
    }

    isOriginClicked(coords) {
      this.originSelected = this.originRecticle.isClicked(coords);
    }

    reset() {
      this.originSelected = false;
      this.xSelected = false;
      this.ySelected = false;
    }
  }

  class ScaleBar {
    constructor() {
      this.name = "ScaleBar";
      this.coords1 = { x: 100, y: 100 };
      this.coords2 = { x: 200, y: 100 };
      this.color = "rgb(0,0,0)";
      this.bar = new Line();
      this.recticle1 = new Recticle();
      this.recticle2 = new Recticle();
      this.recticleSelected1 = false;
      this.recticleSelected2 = false;
      this.scaleRatio = 1;

      this.update();
    }
    update() {
      this.setScale();
      this.recticle1.updateCoords(this.coords1);
      this.recticle2.updateCoords(this.coords2);

      this.recticle1.color = "aqua";
      this.recticle1.lineWidth = 2;
      this.recticle2.color = "aqua";
      this.recticle2.lineWidth = 2;

      this.bar.color = "aqua";
      this.bar.lineWidth = 3;

      this.bar.updateStart(this.coords1);
      this.bar.updateEnd(this.coords2);
    }

    updateCoords(coords1, coords2) {
      this.coords1 = coords1;
      this.coords2 = coords2;
      this.update();
    }

    isEndClicked(coords) {
      this.recticleSelected1 = this.recticle1.isClicked(coords);
      this.recticleSelected2 = this.recticle2.isClicked(coords);
    }

    draw(frame) {
      this.recticle1.draw(frame);
      this.recticle2.draw(frame);
      this.bar.draw(frame);
    }

    reset() {
      this.recticleSelected1 = false;
      this.recticleSelected2 = false;
    }

    setScale() {
      // pixels to meters
      this.scaleRatio = distance(this.coords1, this.coords2);
      // console.log(scaleRatio);
    }
  }

  class Point {
    constructor(coords, time) {
      this.name = "Point";
      this.coords = coords;
      this.color = new cv.Scalar(0, 255, 0, 255);
      this.highlight = false;
      this.radius = 2;
      this.lineWidth = 2;
      //   this.getTrueCoords();
      this.time = time;
    }

    updateCoords(coords) {
      this.coords = coords;
      // this.getTrueCoords();
    }

    draw(frame) {
      // cv.circle(frame, this.coords, this.radius, this.color, -1);
      // cv.circle(frame, this.coords, this.radius, this.color, this.lineWidth);
      cv.circle(
        frame,
        new cv.Point(this.coords.x, this.coords.y),
        this.radius,
        this.color,
        -1,
        cv.LINE_AA
      );

      if (this.highlight) {
        cv.circle(
          frame,
          this.coords,
          this.radius + this.lineWidth,
          new cv.Scalar(0, 255, 255, 255),
          this.lineWidth,
          cv.LINE_AA
        );
      }
    }

    isSelected(box) {
      // console.log(this.coords, box.coords, box.size);
      let left = Math.min(box.coords.x, box.coords.x + box.size.w);
      let right = Math.max(box.coords.x, box.coords.x + box.size.w);
      let top = Math.min(box.coords.y, box.coords.y + box.size.h);
      let bottom = Math.max(box.coords.y, box.coords.y + box.size.h);
      return (
        this.coords.x >= left &&
        this.coords.x <= right &&
        this.coords.y >= top &&
        this.coords.y <= bottom
      );
    }
  }

  class Slider {
    constructor() {
      // $("#time-slider").show();
    }
  }

  class Context {
    constructor() {
      this.state = null;
    }

    setState(state) {
      if (this.state) {
        this.state.endState();
      }
      this.state = state;
    }

    handleOnClick(coords) {
      this.state.handleOnClick(coords);
    }

    handleOnMouseMove(coords) {
      this.state.handleOnMouseMove(coords);
    }

    handleOnMouseUp(coords) {
      this.state.handleOnMouseUp(coords);
    }

    handleTick(frame) {
      this.state.handleTick(frame);
    }

    handleDraw(frame) {
      this.state.draw(frame);
    }

    endState() {
      this.state.endState();
      this.state = null;
    }
  }

  class State {
    constructor(context) {
      this.context = context;
    }

    handleOnClick(coords) {
      return;
    }

    handleOnMouseMove(coords) {
      return;
    }

    handleOnMouseUp(coords) {
      return;
    }

    handleTick(frame) {
      return;
    }

    draw(frame) {
      return;
    }

    endState() {
      return;
    }
  }

  class StateIdlePointer extends State {
    constructor(context) {
      super(context);
    }
  }

  class StateClickAddDataPoints extends State {
    constructor(context) {
      super(context);
      this.context = context;
      this.points = [];
      this.box = null;
    }

    handleOnClick(coords) {
      if (!pointsContainer['dataPoints']) pointsContainer['dataPoints'] = [];
      pointsContainer['dataPoints'].push(new Point(coords, video.currentTime));
      onFrameForward();
    }

    handleTick(frame) {
      // dataPoints.forEach((pt) => pt.draw(frame));
      if (frame) {
        this.draw(frame);
      } else {
        return;
      }
    }

    draw(frame) {
      pointsContainer['dataPoints'].forEach((pt) => pt.draw(frame));
    }

    endState() {
      return;
    }
  }

  class StateClickSelectColor extends State{
    constructor(context) {
      this.context = context;
      this.points = [];
    }

    handleOnClick(coords) {
      // Do I need to pass a mat? The whole frame? Just ROI?
      // Do I grab from the global mats?
      templateColor = [...currentFrame.ucharPtr(coords.y, coords.x)];
      console.log(templateColor);
    }

    handleTick(frame) {
      colorMatch();
    }

    // draw(frame) {
    //   return;
    // }
    endState() {
      return;
    }
  }

  // class stateDragSelectTemplate {
  //   // Old temmplate match
  //   constructor(context) {
  //     this.context = context;
  //     this.points = [];
  //     this.box = new Box();
  //     this.hsvVec = new cv.MatVector();
  //     this.hsvRoiVec = new cv.MatVector();
  //     this.hsvRoi = new cv.Mat();
  //     this.roiHist = new cv.Mat();
  //     this.trackBox = null;
  //   }

  //   handleOnClick(coords) {
  //     pauseVideo();
  //     this.box.resetBox();
  //     this.box.updateCoords(coords);
  //     this.box.updateCorner({ x: coords.x, y: coords.y });
  //   }

  //   handleOnMouseMove(coords) {
  //     this.box.updateCorner(coords);
  //     let { x, y, w, h } = this.box.getInnerCoordsSize();
  //     if (w < 2 || h < 2) return;
  //     templateMat = currentFrame.roi(
  //       new cv.Rect({ x: x, y: y, width: w, height: h })
  //     );
  //     imshowFrame(templateMat, "canvasAux");
  //     $("#canvasAux").show();
      
  //   }

  //   handleOnMouseUp(coords) {
  //     this.box.updateCorner(coords);
  //     templateMat = currentFrame.roi(
  //       new cv.Rect({ x: x, y: y, width: w, height: h })
  //     );
  //     this.roiHist = initCamShift();
  //     console.log('mouse up', this.roiHist);
  //   }

  //   handleTick(frame) {
  //     // templateMatch();
  //     this.roiHist = initCamShift();
  //     [this.trackBox, templateMat] = camShiftTick(this.roiHist, templateMat);
  //     if (frame) {
  //       this.draw(frame);
  //     } else {
  //       return;
  //     }
  //   }

  //   draw(frame) {
  //     this.box.draw(frame);
  //     if (pointsContainer['dataPoints'])
  //         pointsContainer['dataPoints'].forEach((pt) => pt.draw(frame));
  //     if (this.trackBox){
  //       let pts = cv.rotatedRectPoints(trackBox);
  //       cv.line(frame, pts[0], pts[1], [255, 0, 0, 255], 3);
  //       cv.line(frame, pts[1], pts[2], [255, 0, 0, 255], 3);
  //       cv.line(frame, pts[2], pts[3], [255, 0, 0, 255], 3);
  //       cv.line(frame, pts[3], pts[0], [255, 0, 0, 255], 3);
  //       imshowFrame(frame, "canvasOutput");
  //     }
  //   }
  // }

  class StateSelectBox extends State {
    constructor(context, box) {
      super(context);
      this.points = [];
      this.box = box ? box : new Box();
      this.previewMat = new cv.Mat();
    }

    setBox(box) {
      this.box = box;
    }

    handleOnClick(coords) {
      if (!this.box)
        this.box = new Box();
      pauseVideo();
      this.box.resetBox();
      this.box.updateCoords(coords);
      this.box.updateCorner({ x: coords.x, y: coords.y });
    }

    handleOnMouseMove(coords) {
      if (!this.box)
        this.box = new Box();
      this.box.updateCorner(coords);
      let { x, y, width, height } = this.box.getInnerCoordsSize();
      if (width < 2 || height < 2) return;
      this.previewMat = currentFrame.roi(
        new cv.Rect({ x: x, y: y, width: width, height: height }
      ));
      imshowFrame(this.previewMat, "canvasAux");
      $("#canvasAux").show();
      let temporaryFrame = currentFrame.clone();
      this.draw(temporaryFrame);
      imshowFrame(temporaryFrame, "canvasOutput");
      temporaryFrame.delete();
    }

    handleOnMouseUp(coords) {
      if (!this.box)
        this.box = new Box();
      this.box.updateCorner(coords);
      let { x, y, width, height } = this.box.getInnerCoordsSize();
      if (width < 2 || height < 2) return;
      this.previewMat = currentFrame.roi(
        new cv.Rect({ x: x, y: y, width: width, height: height }
      ));
      imshowFrame(this.previewMat, "canvasAux");
      $("#canvasAux").show();
      let temporaryFrame = currentFrame.clone();
      this.draw(temporaryFrame);
      imshowFrame(temporaryFrame, "canvasOutput");
      temporaryFrame.delete();
    }

    handleTick(frame) {
      this.draw(frame);
      return;
    }

    draw(frame) {
      this.box.draw(frame);
  }

    endState() {
      return;
    }
}

  class StateSelectBoxTemplate extends StateSelectBox {
    constructor(context, box) {
      super(context, box);
      useTemplate = true;
    }
    handleOnMouseMove(coords) {
      super.handleOnMouseMove(coords);
      templateMat = currentFrame.roi(this.box.getCVRect());
      templateBox = this.box;
    }

    handleOnMouseUp(coords) {
      super.handleOnMouseUp(coords);
      templateMat = currentFrame.roi(this.box.getCVRect());
      templateBox = this.box;

      this.endState();

    }

    endState() {
      super.endState();
      templateBox = this.box;
      templateMat = currentFrame.roi(this.box.getCVRect());
      $("#btnTempSelect").removeClass("selected");
      stateContext.state= null;

      stateContext.setState(new StateIdlePointer(stateContext));
      return;
    }
  }

  class StateSelectBoxROI extends StateSelectBox {
    constructor(context, box) {
      super(context, box);
      useROI = true;
    }

    handleOnMouseMove(coords) {
      super.handleOnMouseMove(coords);
    }

    handleOnMouseUp(coords) {
      super.handleOnMouseUp(coords);
      templateBox = this.box;
      this.endState();
    }

    endState() {
      super.endState();
      templateBox = this.box;
      $("#btnROISelect").removeClass("selected");
      stateContext.state= null;
      stateContext.setState(new StateIdlePointer(stateContext));
      return;
    }
  }

  class StateAutoOpticalStabilize extends State {

    constructor(context){
        this.context = context;
        this.points = [];
        this.box = null;
        this.priorGrayFrame = null;
        this.currentGrayFrame = null;
        this.p0 = new cv.Mat();
        this.p1 = new cv.Mat();
        this.mask = new cv.Mat();
        this.priorGoodPoints = [];
        this.currentGoodPoints = [];

        this.maxCorners = 30;
        this.qualityLevel = 0.3;
        this.minDistance = 7;
        this.blockSize = 7;

        this.winSize = new cv.Size(15, 15);
        this.maxLevel = 2;
        this.criteria = new cv.TermCriteria(cv.TERM_CRITERIA_EPS | cv.TERM_CRITERIA_COUNT, 10, 0.03);
        this.color = new cv.Scalar(0, 0, 255, 255);
    }

    handleOnClick(coords){
        this.points.push(new Point(coords, video.currentTime));
    }
    
    handleTick(frame){
        if (!frame) return;
        if (!this.currentGrayFrame){
            this.currentGrayFrame = new cv.Mat();
            cv.cvtColor(frame, this.currentGrayFrame, cv.COLOR_RGBA2GRAY);
            let none = new cv.Mat();
            cv.goodFeaturesToTrack(this.currentGrayFrame, this.p0, this.maxCorners, this.qualityLevel, this.minDistance, none, this.blockSize);
            
            return;
        }
        let status = new cv.Mat();
        let err = new cv.Mat();

        this.mask = new cv.Mat(frame.rows, frame.cols, frame.type(), new cv.Scalar(0, 0, 0, 255));
        this.priorGrayFrame = this.currentGrayFrame.clone();   
        cv.cvtColor(frame, this.currentGrayFrame, cv.COLOR_RGBA2GRAY); 
        cv.calcOpticalFlowPyrLK(this.priorGrayFrame, this.currentGrayFrame, this.p0, this.p1, status, err, this.winSize, this.maxLevel, this.criteria);
        for (let i = 0; i < status.rows; i++) {
            if (status.data[i] === 1) {
                this.currentGoodPoints.push(new cv.Point(this.p1.data32F[i*2], this.p1.data32F[i*2+1]));
                this.priorGoodPoints.push(new cv.Point(this.p0.data32F[i*2], this.p0.data32F[i*2+1]));
            }
        }
        this.draw(frame);
        
        this.currentGrayFrame.copyTo(this.priorGrayFrame);
        this.p0.delete(); this.p0 = null;
        this.p0 = new cv.Mat(this.currentGoodPoints.length, 1, cv.CV_32FC2);
        for (let i = 0; i < this.currentGoodPoints; i++) {
            this.p0.data32F[i*2] = this.currentGoodPoints[i].x;
            this.p0.data32F[i*2+1] = this.currentGoodPoints[i].y;
        }

    }

    draw(frame){
      for (let i = 0; i < this.currentGoodPoints.length; i++) {
        cv.line(this.mask, this.currentGoodPoints[i], this.priorGoodPoints[i], this.color, 2);
        cv.circle(this.currentGrayFrame, this.currentGoodPoints[i], 5, this.color, -1);
      }
      cv.add(frame, this.mask, frame);
    }

    endState(){
        return;
    }
}


  function checkEmptyMatData(mat){
    let i = 0;
    while (i< mat.data.length){
      if (mat.data[i] > 0)
        return false;   // data is not all 0
      i++;
    }
    return true;      // data is all 0
  }

  function demo_app(videoWidth, videoHeight) {
    console.log("enter demo_app");
    initializeApp();
    canvas.width = video.width;
    canvas.height = video.height;
    canvasVideoMirror.width = video.width;
    canvasVideoMirror.height = video.height;
    canvasROI.width = video.width;
    canvasROI.height = video.height;

    if (roiBox) {
      roiBox.resetBox();
      roiBox.updateCoords({ x: 0, y: 0 });
      roiBox.updateCorner({ x: video.width, y: video.height });
    } 

    if (templateBox) {
      templateBox.resetBox();
      templateBox.updateCoords({ x: 0, y: 0 });
      templateBox.updateCorner({ x: video.width, y: video.height });
    } 

    if (!gui) {
      options = new demo_opt();
      gui = new dat.GUI();
      gui.add(options, "color_tolerance", 0, 100).step(1);
    }
    stateContext.setState(new StateIdlePointer(stateContext));

    cap.read(currentFrame);
    imshowFrame(currentFrame, "canvasOutput");
    currentFrame.copyTo(priorFrame);

    // from https://stackoverflow.com/questions/28420724/how-to-determine-the-intended-frame-rate-on-an-html-video-element
    // and https://stackoverflow.com/questions/72997777/how-do-i-get-the-frame-rate-of-an-html-video-with-javascript
    // Part 1:
    var last_media_time, last_frame_num, fps;
    var fps_rounder = [];
    var frame_not_seeked = true;

    // Part 2 (with some modifications):
    function ticker(useless, metadata) {
      var media_time_diff = Math.abs(metadata.mediaTime - last_media_time);
      var frame_num_diff = Math.abs(metadata.presentedFrames - last_frame_num);
      var diff = media_time_diff / frame_num_diff;
      if (
        diff &&
        diff < 1 &&
        frame_not_seeked &&
        fps_rounder.length < 50 &&
        video.playbackRate === 1 &&
        document.hasFocus()
      ) {
        fps_rounder.push(diff);
        fps = Math.round(1 / get_fps_average());
        document.querySelector("p").textContent = "FPS: " + fps + ", certainty: " + fps_rounder.length * 2 + "%";
      }
      frame_not_seeked = true;
      last_media_time = metadata.mediaTime;
      last_frame_num = metadata.presentedFrames;
      video.requestVideoFrameCallback(ticker);
    }
    video.requestVideoFrameCallback(ticker);
    // Part 3:
    video.addEventListener("seeked", function () {
      fps_rounder.pop();
      frame_not_seeked = false;
    });
    // Part 4:
    function get_fps_average() {
      return fps_rounder.reduce((a, b) => a + b) / fps_rounder.length;
    }

    compatibility.requestAnimationFrame(tick);
  }

  function tick() {
    let left = (video.currentTime / video.duration) * 100 + "%";
    $("#handle-current").css("left", left);
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      currentFrame.copyTo(priorFrame);
      cap.read(currentFrame);
      if (useTemplate && templateBox){
        templateBox.draw(currentFrame);
      }

      if (useROI && roiBox){
        roiBox.draw(currentFrame);
      }


      if (video.paused || video.ended) {
      }
      else {
        stateContext.handleTick(currentFrame);
      }
    }

    imshowFrame(currentFrame, "canvasOutput");

    if (video.currentTime < stoppingTime)
      compatibility.requestAnimationFrame(tick);
    
    else{
        video.currentTime = stoppingTime;
        video.ended = true;
        let icon = $('#idPlayPause');
    
        icon.addClass("fa-play");
        icon.removeClass("fa-pause");
    }

  }

  function imshowFrame(frame, cnv) {
    cv.imshow(cnv, frame);

  }

  // Add an event listener to the file input
  $("#videoFileInput").change(function (event) {
    const selectedFile = event.target.files[0]; // Get the selected file

    if (selectedFile) {
      // Create a URL for the selected file
      const videoURL = URL.createObjectURL(selectedFile);

      // Set the video element's source to the selected file
      video.src = videoURL;

      $("#videoInput").hide();
      $("#canvasOutput").show();

      video.onloadedmetadata = (event) => {
        console.log(
          "The duration and dimensions of the media and tracks are now known."
        );
        if (video.videoWidth > 700 || video.videoHeight > 700) {
          video.width = video.videoWidth / 2.0;
          video.height = video.videoHeight / 2.0;
        } else {
          video.width = video.videoWidth;
          video.height = video.videoHeight;
        }
        video.currentTime = 0;
        startingTime = 0;
        stoppingTime = video.duration;
        $("#time-slider").css("width", video.width);

        cap = new cv.VideoCapture(video);
        priorFrame = new cv.Mat(video.height, video.width, cv.CV_8UC4);
        currentFrame = new cv.Mat(video.height, video.width, cv.CV_8UC4);
        cap.read(priorFrame);

        imshowFrame(priorFrame, "canvasOutput");
        waitForVideoLoad(initializeApp);
        waitForVideoLoad(demo_app);
      };
    }
  });


  var showAxisAndScale, matchTemplateOnPlay;
  var line;

  var selectBox;

  var FPS = 30;
  var dataPoints, lines;

  var isVidReady, isCVReady;

  var axis, scaleBar
  var gui, options;

  var gui, options;
  var demo_opt;

  var stateContext;

  

  function initializeApp() {
    showAxisAndScale = false;
    matchTemplateOnPlay = false;
    pointsContainer = {};

    line = new Line();

    selectBox = new Box('select');

    templateBox = new Box('template');
    templateBox.updateCoords({ x: 0, y: 0 });
    templateBox.updateCorner({ x: video.width, y: video.height });

    roiBox = new Box('roi');
    roiBox.updateCoords({ x: 0, y: 0 });
    roiBox.updateCorner({ x: video.width, y: video.height });

    FPS = 30;
    dataPoints = [];
    lines = [];

    isVidReady = false;
    isCVReady = false;

    axis = new Axis();
    axis.updateOrigin({ x: 200, y: 200 });
    scaleBar = new ScaleBar();
    scaleBar.updateCoords({ x: 100, y: 300 }, { x: 200, y: 300 });


    demo_opt = function () {
      this.color_tolerance = 10;
    };

    stateContext = new Context();
    startingTime = 0;
    stoppingTime = video.duration;
    $("#handle-start").css("left", "0%");
    $("#handle-current").css("left", "0%");
    $("#handle-stop").css("right", "0%");
  }

  function waitForVideoLoad(psbk) {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      console.log("video loaded");
      psbk();
    } else {
      setTimeout(function() { waitForVideoLoad(psbk); }, 100);
    }
  }

  function onPlayPauseClick() {
    if (video.paused) {
      playVideo();
    } else {
      pauseVideo();
    }
    // video.paused ? video.play() : video.pause();
  }

  function pauseVideo() {
    let icon = $('#idPlayPause');
    
    icon.addClass("fa-play");
    icon.removeClass("fa-pause");

    video.pause();
  }

  function playVideo() {
    let icon = $('#idPlayPause');
    
    icon.removeClass("fa-play");
    icon.addClass("fa-pause");

    video.play();
  }

  function onFrameForward() {
    changeFrames(1);
  }

  function onFrameBackward() {
    changeFrames(-1);
  }

  function changeFrames(deltaFrames) {
    let tryTime = video.currentTime + deltaFrames / FPS;
    if (deltaFrames < 0)
      setVideoTime(Math.max(0, tryTime));
    else 
      setVideoTime(Math.min(video.duration, tryTime));

  }

  function setVideoTime(time) {
    pauseVideo();
    // let videoLoaded = 
    video.currentTime = time;

    waitForVideoLoad(()=>{
      let left = (video.currentTime / video.duration) * 100 + "%";
      $("#handle-current").css("left", left);
      currentFrame.copyTo(priorFrame);

      cap.read(currentFrame);
      stateContext.handleDraw(currentFrame);
      imshowFrame(currentFrame, "canvasOutput");
      compatibility.requestAnimationFrame(tick);
    });
  }

  function relMouseCoords(event) {
    var totalOffsetX = 0,
      totalOffsetY = 0,
      canvasX = 0,
      canvasY = 0;
    var currentElement = this;

    do {
      totalOffsetX += currentElement.offsetLeft - currentElement.scrollLeft;
      totalOffsetY += currentElement.offsetTop - currentElement.scrollTop;
    } while ((currentElement = currentElement.offsetParent));

    canvasX = event.pageX - totalOffsetX;
    canvasY = event.pageY - totalOffsetY;

    return { x: canvasX, y: canvasY };
  }
  HTMLCanvasElement.prototype.relMouseCoords = relMouseCoords;

  function templateMatch() {
    if (!templateMat) return;
    if (templateMat.rows < 2 || templateMat.cols < 2) return;

    let dst = new cv.Mat();
    let mask = new cv.Mat();
    let srcRoi = new cv.Mat();

    srcRoi =
      currentROI && currentROI.rows > 2 && currentROI.cols > 2
        ? currentROI.clone()
        : currentFrame.clone();

    // cv.matchTemplate(src, templ, dst, cv.TM_SQDIFF_NORMED, mask);
    // cv.matchTemplate(src, templ, dst, cv.TM_CCORR, mask);
    cv.matchTemplate(srcRoi, templateMat, dst, cv.TM_CCORR_NORMED, mask);
    // cv.matchTemplate(src, templ, dst, cv.TM_CCOEFF, mask);
    let result = cv.minMaxLoc(dst, mask);
    console.log(result);
    let maxPoint = result.maxLoc;
    let color = new cv.Scalar(255, 0, 0, 255);
    let point = new cv.Point(
      maxPoint.x + templateMat.cols,
      maxPoint.y + templateMat.rows
    );
    console.log(point);

    dataPoints.push( new Point(point, video.currentTime));
    // cv.rectangle(currentFrame, maxPoint, point, color, 2, cv.LINE_8, 0);
    // imshowFrame(currentFrame, "canvasOutput");
    canvasAux.width = canvas.width;
    canvasAux.height = canvas.height;
    canvasAux.style.display = "block";
    imshowFrame(dst, "canvasAux");

    pt = new Point(
      {
        x: maxPoint.x + templateMat.cols / 2,
        y: maxPoint.y + templateMat.rows / 2,
      },
      video.currentTime
    );

    if (!pointsContainer['template_match_data']) pointsContainer['template_match_data'] = [];
    pointsContainer['template_match_data'].push(pt);

    srcRoi.delete();
    dst.delete();
    mask.delete();
  }

  function initCamShift(){
    console.log('enter initCamShift');
    let hsvRoi = new cv.Mat();
    cv.cvtColor(templateMat, hsvRoi, cv.COLOR_RGBA2RGB);
    cv.cvtColor(hsvRoi, hsvRoi, cv.COLOR_RGB2HSV);
    let mask = new cv.Mat();
    let lowScalar = new cv.Scalar(30, 30, 0);
    let highScalar = new cv.Scalar(180, 180, 180);
    let low = new cv.Mat(hsvRoi.rows, hsvRoi.cols, hsvRoi.type(), lowScalar);
    let high = new cv.Mat(hsvRoi.rows, hsvRoi.cols, hsvRoi.type(), highScalar);
    cv.inRange(hsvRoi, low, high, mask);
    let roiHist = new cv.Mat();
    let hsvRoiVec = new cv.MatVector();
    hsvRoiVec.push_back(hsvRoi);
    cv.calcHist(hsvRoiVec, [0], mask, roiHist, [180], [0, 180]);
    cv.normalize(roiHist, roiHist, 0, 255, cv.NORM_MINMAX);
    
    // delete useless mats.
    hsvRoi.delete(); mask.delete(); low.delete(); high.delete(); hsvRoiVec.delete();
    console.log('exit initCamShift');

    return roiHist;
  }

  function camShiftTick(roiHist, trackWindow){
      let termCrit = new cv.TermCriteria(cv.TERM_CRITERIA_EPS | cv.TERM_CRITERIA_COUNT, 10, 1);
      let hsv = new cv.Mat(video.height, video.width, cv.CV_8UC3);
      
      let trackBox = null;
      cv.cvtColor(currentFrame, hsv, cv.COLOR_RGBA2RGB);
      cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

      let dst = new cv.Mat(hsv.rows, hsv.cols, hsv.type());
      let hsvVec = new cv.MatVector();
      hsvVec.push_back(hsv);
      console.log(hsv, roiHist, dst)
      try{
        cv.calcBackProject(hsvVec, [0], roiHist, dst, [0, 180], 1);
      } catch(e){
        printError(e);
      }

      imshowFrame(dst, "canvasAux");
      $("#canvasAux").show();

      // apply camshift to get the new location
      console.log(dst, trackWindow, termCrit);

      [trackBox, trackWindow] = cv.CamShift(dst, trackWindow, termCrit);
      return [trackBox, trackWindow];
  }

  function colorMatch() {
    function getLowerHigher(pct) {
      var lowerColor = [0, 0, 0, 0];
      var higherColor = [0, 0, 0, 0];
      templateColor.forEach((c, i) => {
        lowerColor[i] = Math.round(c * (1 - pct / 100));
        higherColor[i] = Math.round(c * (1 + pct / 100));
      });
      lowerColor[3] = 0;
      higherColor[3] = 255;
      return [lowerColor, higherColor];
    }

    function drawMatchOnOutput(src, dst) {
      let highlight = new cv.Mat(
        src.rows,
        src.cols,
        src.type(),
        [3, 252, 236, 0]
      );
      for (i = 0; i < dst.cols * dst.rows; i++) {
        if (dst.data[i] > 0) {
          highlight.data[4 * i + 3] = 255;
        }
      }
      imshowFrame(highlight, "canvasOutput");
      highlight.delete();
    }
    let lower, higher;
    [lower, higher] = getLowerHigher(options.color_tolerance | 10);
    let src = cv.imread("canvasROI");
    let dst = new cv.Mat();
    let low = new cv.Mat(src.rows, src.cols, src.type(), lower);
    let high = new cv.Mat(src.rows, src.cols, src.type(), higher);
    // console.log(low,)
    cv.inRange(src, low, high, dst);
    // console.log(dst.rows, dst.cols, dst.data);

    imshowFrame(dst, "canvasAux");
    $("#canvasAux").show();
    let { x, y } = getPointFromColorMatch(dst);
    pt = new Point(
      { x: x + roiBox.coords.x, y: y + roiBox.coords.y },
      video.currentTime
    );

    // drawMatchOnOutput(src, dst);
    if (!pointsContainer['color_match_data']) pointsContainer['color_match_data'] = [];
    pointsContainer['color_match_data'].push(pt);

    src.delete();
    dst.delete();
    low.delete();
    high.delete();
  }

  function getPointFromColorMatch(dst) {
    let count = 0,
      sumX = 0,
      sumY = 0;
    for (let i = 0; i < dst.rows; i++) {
      for (let j = 0; j < dst.cols; j++) {
        let index = i * dst.cols + j;
        if (dst.data[index] > 0) {
          count++;
          sumX += j;
          sumY += i;
        }
      }
    }
    return { x: sumX / count, y: sumY / count };
  }

  printError = function (err) {
    if (typeof err === 'undefined') {
        err = '';
    } else if (typeof err === 'number') {
        if (!isNaN(err)) {
            if (typeof cv !== 'undefined') {
                err = 'Exception: ' + cv.exceptionFromPtr(err).msg;
            }
        }
    } else if (typeof err === 'string') {
        let ptr = Number(err.split(' ')[0]);
        if (!isNaN(ptr)) {
            if (typeof cv !== 'undefined') {
                err = 'Exception: ' + cv.exceptionFromPtr(ptr).msg;
            }
        }
    }

    console.log(err);
}

  $("#canvasOutput").mousedown((e) => {
    e.preventDefault();
    var coords = e.target.relMouseCoords(e);
    if (
      !(coords.x > 0) &
      (coords.y > 0) &
      (coords.x < canvas.width) &
      (coords.y < canvas.height)
    )
      return;

    stateContext.handleOnClick(coords);
  });

  $("#canvasOutput").mousemove(function (e) {
    e.preventDefault();
    // console.log(e.buttons);
    if (e.buttons == 1) {
      e.preventDefault();
      var coords = e.target.relMouseCoords(e);
      if (
        !(coords.x > 0) &
        (coords.y > 0) &
        (coords.x < e.target.width) &
        (coords.y < e.target.height)
      )
        return;
      stateContext.handleOnMouseMove(coords);
    }
  });

  // $(".ctrl-btn").click((e) => {
  //   $(".ctrl-btn").removeClass("selected");
  // });

  $("#canvasOutput").mouseup((e) => {
    e.preventDefault();

    if (e.buttons == 0) {
      console.log("mouseUp");
      e.preventDefault();
      var coords = e.target.relMouseCoords(e);

      stateContext.handleOnMouseUp(coords);
    }
  });

  // $("#canvasOutput").mouseleave((e) => {
  //   e.preventDefault();

  //   if (e.buttons == 0) {
  //     console.log("mouseleave");
  //     e.preventDefault();
  //     var coords = e.target.relMouseCoords(e);

  //     stateContext.handleOnMouseUp(coords);
  //   }
  // });

  $("#btnTempMatch").click((e) => {
    templateMatch();
    onFrameForward();
    console.log(dataPoints);
    dataPoints.slice(-1).draw(frame);
  });

  $("#btnPlayPause").click(onPlayPauseClick);

  $("#btnBackward").click(onFrameBackward);

  $("#btnForward").click(onFrameForward);
  
  $("#btnStartPoint").click((e) => {
    if (video.currentTime == startingTime) startingTime = 0;
    else startingTime = video.currentTime;
    let left = (startingTime / video.duration) * 100 + "%";
    $("#handle-start").css("left", left);
  });


  $("#btnStopPoint").click((e) => {
    if (video.currentTime == stoppingTime) stoppingTime = video.duration;
    else stoppingTime = video.currentTime;
    let left = (stoppingTime / video.duration) * 100 + "%";
    $("#handle-end").css("left", left);
  });

  $("#btnPointer").click(function (e) {
    $("#btnPointer").addClass("selected");
    stateContext.setState(new StateIdlePointer(stateContext));
  });

  $("#btnDot").click(function (e) {
    $("#btnDot").addClass("selected");
    stateContext.setState(new StateClickAddDataPoints(stateContext));
  });

  $("#btnSelect").click(function (e) {
    cursorState = "select";
    $("#btnSelect").addClass("selected");
  });

  $("#btnDelete").click(function (e) {
    dataPoints = dataPoints.filter((pt) => !pt.highlight);
    selectBox.resetBox();
  });

  $("#btnDeleteAll").click(function (e) {
    dataPoints = [];
    selectBox.resetBox();
  });

  $("#btnPrint").click(function (e) {
    dataPoints.forEach((pt) => {
      console.log(pt.time, pt.getTrueCoords());
    });
  });

  function convertToCSV(dataPoints) {
    let csv = "Time (s), x position (m), y position (m)\n"; // CSV header

    dataPoints.forEach((pt) => {
      let t = pt.time;
      let { x: x, y: y } = pt.getTrueCoords();
      csv += `${t},${x},${y}\n`;
    });

    return csv;
  }

  function downloadCSV(csvData, filename) {
    const blob = new Blob([csvData], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    URL.revokeObjectURL(url);
  }

  $("#btnExport").click(function (e) {
    if (dataPoints.length > 0) {
      const csvData = convertToCSV(dataPoints);
      const filename = "points.csv";
      downloadCSV(csvData, filename);
    }
  });

  $("#btnToggleShowAxis").click(function (e) {
    showAxisAndScale = !showAxisAndScale;
    $("#btnToggleShowAxis").addClass("selected");
  });

  $("#btnToggleMatch").click(function (e) {
    matchTemplateOnPlay = !matchTemplateOnPlay;
    $("#btnToggleMatch").addClass("selected");
  });

  $("#btnTempSelect").click((e) => {
    $("#btnTempSelect").addClass("selected");
    $("#btnTempUseToggle").addClass("selected");
    stateContext.setState(new StateSelectBoxTemplate(stateContext, templateBox));
  });

  $("#btnColorSelect").click((e) => {
    $("#btnColorSelect").addClass("selected");
    stateContext.setState(new StateClickSelectColor(stateContext));
  });

  $("#btnROISelect").click((e) => {
    $("#btnROISelect").addClass("selected");
    $("#btnROIUseToggle").addClass("selected");
    stateContext.setState(new StateSelectBoxROI(stateContext, roiBox));
  });

  $("#btnFastBackward").click((e) => {
    // video.currentTime = 0;
    if (video.currentTime == startingTime) setVideoTime(0)
    else setVideoTime(startingTime);
  });

  $("#btnFastForward").click((e) => {
    // video.currentTime = 0;

    if (video.currentTime == stoppingTime) video.currentTime = video.duration;
    else video.currentTime = stoppingTime;
    console.log(video.currentTime, video.duration, stoppingTime);
  });

  $("#btnBuildStabilize").click((e) => {
    $("#btnBuildStabilize").addClass("selected");
    stateContext.setState(new stateClickAddStablePoints(stateContext));
    // stateContext.setState(new StateAutoOpticalStabilize(stateContext));
  });

  $("#btnBuildStabilize").click((e) => {
    $("#btnBuildStabilize").addClass("selected");
    stateContext.setState(new stateClickAddStablePoints(stateContext));
    // stateContext.setState(new StateAutoOpticalStabilize(stateContext));
  });

  var initSliderHandles = function () {
    let tt = $("#slider-range span")[1].getAttribute("style") + "z-index: 2";
    $("#slider-range span")[1].setAttribute("style", tt);
    console.log("initSliderHandles");
  };

  var updateSlider = function (event, ui) {
    $("#slider-range .slide-back").remove();
    $($("#slider-range span").get().reverse()).each(function (i) {
      bgs = ["blue", "blue", "white"];
      $("#slider-range").append(
        $("<div></div>")
          .addClass("slide-back")
          .width($(this).offset().left)
          .css("background", bgs[i])
      );
    });

    if (ui.values[1] < ui.values[0]) {
      $("#slider-range").slider("values", 1, ui.values[0]);
      video.currentTime = ui.values[0] / FPS;
    }
    if (ui.values[1] > ui.values[2]) {
      $("#slider-range").slider("values", 1, ui.values[2]);
      video.currentTime = ui.values[2] / FPS;
    }
    video.currentTime = ui.values[1] / FPS;
  };

  function relMouseScrub(event) {
    var totalOffsetX = 0,
      scrubX = 0;
    var currentElement = this;

    do {
      console.log(currentElement);
      totalOffsetX += currentElement.offsetLeft - currentElement.scrollLeft;
    } while ((currentElement = currentElement.offsetParent));

    scrubX = event.pageX - totalOffsetX;

    return scrubX;
  }

  $(".slide-handle").mousedown((e) => {
    e.preventDefault();
    $(e.target).addClass("clicked");
    console.log(e.target, " clicked");
  });

  $(".slide-handle").mouseup((e) => {
    $(e.target).removeClass("clicked");
  });

  $(".slide-handle").mousemove((e) => {
    if ($(e.target).hasClass("clicked")) {
      console.log(relMouseScrub(e));
    }
  });
});
