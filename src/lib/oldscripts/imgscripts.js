function setImgDataOpaque(imgData){
    for (let i = 3; i < imgData.width*imgData.height*4; i +=4){
      imgData.data[i]=255;
      // console.log(i);

    }
    return imgData;
  }

  function drawResizedImageDataOnCanvas(img, canvas) {
    let tempCanvas = document.createElement("canvas");
    let tempContext = tempCanvas.getContext("2d");
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;
    tempContext.putImageData(img, 0, 0);
    let ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false; // keep pixel perfect
    ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
  }

  
  function subtract_imageDatas(img1, img2){
    let img_diff = ctx.createImageData(img1.width, img1.height);
    var max = 0;
    for (let i = 0; i < img1.width*img1.height*4; i+=4){
      let val = 0;
      for (let j = 0; j <3; j++){
        val+=Math.pow(img1.data[i+j]-img2.data[i+j], 2);
      }
      val = Math.sqrt(val);
      for (let j = 0; j <3; j++){
        img_diff.data[i+j] = val;
      }
      max = Math.max(max, val);
    }
    let val;
    for (let i = 0; i < img1.width*img1.height*4; i++){
      val = (i+1)%4?img_diff.data[i] *  255/max:255;
      img_diff.data[i] = Math.floor(val);
    }
    return img_diff;
  }