const HANDPOSE_WIDTH = 640;
const HANDPOSE_HEIGHT = 480;

/* Data type OpenCV chart

+--------+----+----+----+----+------+------+------+------+
|        | C1 | C2 | C3 | C4 | C(5) | C(6) | C(7) | C(8) |
+--------+----+----+----+----+------+------+------+------+
| CV_8U  |  0 |  8 | 16 | 24 |   32 |   40 |   48 |   56 |
| CV_8S  |  1 |  9 | 17 | 25 |   33 |   41 |   49 |   57 |
| CV_16U |  2 | 10 | 18 | 26 |   34 |   42 |   50 |   58 |
| CV_16S |  3 | 11 | 19 | 27 |   35 |   43 |   51 |   59 |
| CV_32S |  4 | 12 | 20 | 28 |   36 |   44 |   52 |   60 |
| CV_32F |  5 | 13 | 21 | 29 |   37 |   45 |   53 |   61 |
| CV_64F |  6 | 14 | 22 | 30 |   38 |   46 |   54 |   62 |
+--------+----+----+----+----+------+------+------+------+

*/

function detectSkinYCrCb(mats) {
  const tresh_val = 100;
  // Get YCrCb channels
  let ycrcb = new cv.MatVector();
  cv.split(mats.new_ycrcb, ycrcb);

  // Apply threshold to Cr and Cb
  cv.threshold(ycrcb.get(1), ycrcb.get(1), 133, tresh_val, cv.THRESH_BINARY);
  cv.threshold(ycrcb.get(1), ycrcb.get(1), 173, tresh_val, cv.THRESH_TOZERO_INV);
  cv.threshold(ycrcb.get(2), ycrcb.get(2), 77, tresh_val, cv.THRESH_BINARY);
  cv.threshold(ycrcb.get(2), ycrcb.get(2), 127, tresh_val, cv.THRESH_TOZERO_INV);

  // Merge thresholded channels into a mask
  cv.bitwise_and(ycrcb.get(1),ycrcb.get(2),mats.mask_skin)

  // Delete allocated MatVector
  ycrcb.delete();

  // Change scale of the mask to make it a 0-1 mask
  cv.threshold(mats.mask_skin, mats.mask_skin, 10, 255, cv.THRESH_BINARY);
}

async function detectFingerTip(video, flow, model, mats, context) {
  const predictions = await model.estimateHands(video);
  
  if (predictions.length > 0) {
    predictions.forEach((prediction) => {
      const finger = fingerJoints.indexFinger[4];
      const landmarks = prediction.landmarks;
      const coord = changeScale(landmarks[finger][0],landmarks[finger][1]);
      flow.old_pts = cv.matFromArray(2, 1, cv.CV_32FC2, coord);
    });
  }
  
  displayStyles = [drawFullHand,drawBoundingBox,drawFingerTips,drawIndex]
  displayStyle = document.querySelector('input[name="display"]:checked').value-1;
  displayStyles[displayStyle](predictions, context);
}

async function processImage(video, context, model, mats, flow, misc, frame) {
  // Hand presegmentation
  detectSkinYCrCb(mats); // Skin color Mask
  misc.gmm_bs.apply(mats.new_rgb, mats.mask_bs); // Background/Foreground Mask
  cv.bitwise_and(mats.mask_skin,mats.mask_bs,mats.mask); // Merge them
  // Mask filtering
  cv.morphologyEx(mats.mask, mats.mask, cv.MORPH_CLOSE, misc.kernel);
  cv.dilate(mats.mask, mats.mask, misc.kernel);

  cv.bitwise_and(mats.new_gray,mats.mask,mats.new_masked_gray); // Get the new masked image

  // Detect hand
  if (!(frame%(FRAMERATE))) {
    detectFingerTip(video, flow, model, mats, context);
  }

  // Apply optical flow
  cv.calcOpticalFlowPyrLK(mats.old_masked_gray, mats.new_masked_gray,
                          flow.old_pts, flow.new_pts, flow.st,
                          flow.err, flow.winSize, flow.maxLevel,
                          flow.criteria);

  // Update points
  flow.old_pts = flow.new_pts.clone();
}