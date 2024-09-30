var video, ctx, ctxAux;

function init() {
  video = document.getElementById("videoInput");
  ctx = document.getElementById("canvasOutput").getContext("2d");
  ctxAux = document.getElementById("canvasAux").getContext("2d");
  // video.addEventListener("play", function() {
  //     draw();
  // }, false);
}

function getGrayscaleImage(imageData) {
  // ctx.drawImage(video, 0, 0, video.width, video.height);
  // var imageData = ctx.getImageData(0, 0, video.width, video.height);
  let img_u8 = new jsfeat.matrix_t(video.width, video.height, jsfeat.U8C1_t);
  jsfeat.imgproc.grayscale(imageData.data, video.width, video.height, img_u8);
  return img_u8;
}

function sobelEdges(imageData) {
  let img_gxgy = new jsfeat.matrix_t(video.width, video.height, jsfeat.S32C2_t);
  let img_mag = new jsfeat.matrix_t(video.width, video.height, jsfeat.S32C1_t);

  let img_u8 = getGrayscaleImage(imageData);
  jsfeat.imgproc.gaussian_blur(img_u8, img_u8, 3);

  jsfeat.imgproc.sobel_derivatives(img_u8, img_gxgy);

  var i = img_u8.cols * img_u8.rows,
    gx = 0,
    gy = 0;
  var x = 0,
    y = 0,
    dx = 0,
    dy = 0;
  var agx = 0,
    agy = 0;
  var gd = img_gxgy.data,
    mag = img_mag.data,
    id = img_u8.data;

  while (--i >= 0) {
    gx = gd[i << 1];
    gy = gd[(i << 1) + 1];
    mag[i] = gx * gx + gy * gy;
  }

  for (y = 1; y < img_u8.rows - 1; ++y) {
    i = (y * img_u8.cols + 1) | 0;
    for (x = 1; x < img_u8.cols - 1; ++x, ++i) {
      gx = gd[i << 1];
      gy = gd[(i << 1) + 1];
      agx = ((gx ^ (gx >> 31)) - (gx >> 31)) | 0;
      agy = ((gy ^ (gy >> 31)) - (gy >> 31)) | 0;

      if (gx > 0) dx = 1;
      else dx = -1;

      if (gy > 0) dy = img_u8.cols;
      else dy = -img_u8.cols;

      var a1, a2, b1, b2, A, B, point;
      if (agx > agy) {
        a1 = mag[i + dx];
        a2 = mag[i + dx + -dy];
        b1 = mag[i - dx];
        b2 = mag[i - dx + dy];
        A = (agx - agy) * a1 + agy * a2;
        B = (agx - agy) * b1 + agy * b2;
        point = mag[i] * agx;
        if (point >= A && point > B) {
          id[i] = agx & 0xff;
        } else {
          id[i] = 0x0;
        }
      } else {
        a1 = mag[i + -dy];
        a2 = mag[i + dx + -dy];
        b1 = mag[i + dy];
        b2 = mag[i - dx + dy];
        A = (agy - agx) * a1 + agx * a2;
        B = (agy - agx) * b1 + agx * b2;
        point = mag[i] * agy;
        if (point >= A && point > B) {
          id[i] = agy & 0xff;
        } else {
          id[i] = 0x0;
        }
      }
    }
  }

  showMat(img_u8, ctxAux, imageData);
}

function showMat(mat, context, imageData) {
  var id = imageData.data;
  var data_u32 = new Uint32Array(id.buffer);
  var alpha = 0xff << 24;
  var pix = 0;
  i = mat.cols * mat.rows;
  while (--i >= 0) {
    pix = id[i];
    data_u32[i] = alpha | (pix << 16) | (pix << 8) | pix;
  }
  context.putImageData(imageData, 0, 0);
}

function img_mat_t_to_imageData(mat, ctx) {
  let img = ctx.createImageData(mat.cols, mat.rows);
  mat.data.forEach((d, i) => {
    img.data[4 * i + 0] = d;
    img.data[4 * i + 1] = d;
    img.data[4 * i + 2] = d;
    img.data[4 * i + 3] = 255;
  });
  return img;
}


function subtract_mat_ts(mat1, mat2) {
  var diff = new jsfeat.matrix_t(
    mat1.cols,
    mat1.rows,
    jsfeat.U8_t | jsfeat.C1_t
  );
  for (let i = 0; i < mat1.rows * mat1.cols; i++) {
    diff.data[i] = Math.abs(mat1.data[i] - mat2.data[i]);
  }
  return diff;
}

function normalizedImageDataDelta(img1, img2){
  let img_diff = ctx.createImageData(img1.width, img1.height);
  var min = 1000, max = -1000;
  for (let px = 0; px < img1.width*img1.height; px ++){
    let i = px*4;
    let val = 0;
    for (let j = 0; j <3; j++){
      val+=img1.data[i+j]-img2.data[i+j];
    }
    max = Math.max(val, max);
    min = Math.min(val, max);
    for (let j = 0; j <3; j++){
      img_diff.data[i+j] = val;
    }
    console.log(px, val);
  }

  for (let px = 0; px < img1.width*img1.height; px++){
    let i = 4*px;
    let val = (img_diff.data[i] - min)/(max-min)*255;
    for (let j = 0; j < 3; j ++){
      img_diff.data[i+j]= val;
    }
  }
  return img_diff;
}

function imageData_to_RGB_mat_t(img, ctx) {
  var mat_t_R = new jsfeat.matrix_t(
    img.width,
    img.height,
    jsfeat.U8_t | jsfeat.C1_t
  );
  var mat_t_G = new jsfeat.matrix_t(
    img.width,
    img.height,
    jsfeat.U8_t | jsfeat.C1_t
  );
  var mat_t_B = new jsfeat.matrix_t(
    img.width,
    img.height,
    jsfeat.U8_t | jsfeat.C1_t
  );
  var mat_t_gray = new jsfeat.matrix_t(
    img.width,
    img.height,
    jsfeat.U8_t | jsfeat.C1_t
  );

  for (let i = 0; i < img.width * img.height; i++) {
    mat_t_R.data[i] = img.data[4 * i + 0];
    mat_t_G.data[i] = img.data[4 * i + 1];
    mat_t_B.data[i] = img.data[4 * i + 2];
  }
  jsfeat.imgproc.grayscale(img.data, img.width, img.height, mat_t_gray);

  return { R: mat_t_R, G: mat_t_G, B: mat_t_B, Gr: mat_t_gray };
}