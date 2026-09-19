import {
  FaceLandmarker,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

const startBtn = document.getElementById("start-btn");
const startScreen = document.getElementById("start-screen");
const appContainer = document.getElementById("app-container");
const video = document.getElementById("webcam");
const target = document.getElementById("exercise-target");
const statusBadge = document.getElementById("status-badge");
const instructionText = document.getElementById("instruction-text");

let faceLandmarker;
let lastVideoTime = -1;

// Ball position tracking variables (Smooth motion using lerp)
let currentX = 50; // Screen percentage X (0 - 100%)
let currentY = 50; // Screen percentage Y (0 - 100%)
let targetX = 50;
let targetY = 50;

// Sensitivity multiplier for eye movement (adjust if needed)
const SENSITIVITY_X = 2.5; 
const SENSITIVITY_Y = 2.0;

// Initialize MediaPipe Face Landmarker
async function initializeFaceLandmarker() {
  const filesetResolver = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );
  faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
      delegate: "GPU"
    },
    outputFaceBlendshapes: false,
    runningMode: "VIDEO",
    numFaces: 1
  });
  statusBadge.innerText = "Camera Ready";
}

initializeFaceLandmarker();

// Handle browser tab switching
document.addEventListener("visibilitychange", () => {
  if (document.hidden) markPersonAbsent();
});

function markPersonAbsent() {
  statusBadge.innerText = "No Person Detected ❌";
  statusBadge.style.background = "rgba(239, 68, 68, 0.2)";
}

function markPersonPresent() {
  statusBadge.innerText = "Person Detected ✅";
  statusBadge.style.background = "rgba(16, 185, 129, 0.2)";
}

startBtn.addEventListener("click", async () => {
  if (!faceLandmarker) {
    alert("Please wait for the face detection model to load.");
    return;
  }

  try {
    if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
    }

    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { width: 1280, height: 720, facingMode: "user" } 
    });
    video.srcObject = stream;

    startScreen.classList.add("hidden");
    appContainer.classList.remove("hidden");
    instructionText.innerText = "Move your eyes to move the green ball";

    video.addEventListener("loadeddata", predictWebcam);
  } catch (err) {
    alert("Camera permission and fullscreen access are required.");
    console.error(err);
  }
});

// Linear Interpolation helper for smooth ball motion
function lerp(start, end, factor) {
  return start + (end - start) * factor;
}

// Main Frame Loop
async function predictWebcam() {
  if (!video.paused && !video.ended && video.readyState >= 2 && !document.hidden) {
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const results = faceLandmarker.detectForVideo(video, performance.now());

      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        markPersonPresent();
        const landmarks = results.faceLandmarks[0];
        calculateEyeGazeAndMoveBall(landmarks);
      } else {
        markPersonAbsent();
      }
    }
  } else {
    markPersonAbsent();
  }

  // Smoothly update ball position towards target on every frame
  currentX = lerp(currentX, targetX, 0.15);
  currentY = lerp(currentY, targetY, 0.15);

  target.style.left = `${currentX}%`;
  target.style.top = `${currentY}%`;

  requestAnimationFrame(predictWebcam);
}

// Calculate Eye Gaze Ratios & Map to Ball Position
function calculateEyeGazeAndMoveBall(landmarks) {
  // Key Landmark Indices:
  // Left Iris Center: 468 | Right Iris Center: 473
  // Left Eye Outer/Inner: 33, 133 | Right Eye Inner/Outer: 362, 263
  // Left Eye Top/Bottom: 159, 145 | Right Eye Top/Bottom: 386, 374

  const leftIris = landmarks[468];
  const rightIris = landmarks[473];

  // 1. Horizontal Gaze Ratio (Left / Right)
  const leftH = (leftIris.x - landmarks[33].x) / (landmarks[133].x - landmarks[33].x);
  const rightH = (rightIris.x - landmarks[362].x) / (landmarks[263].x - landmarks[362].x);
  const avgH = (leftH + rightH) / 2;

  // 2. Vertical Gaze Ratio (Up / Down)
  const leftV = (leftIris.y - landmarks[159].y) / (landmarks[145].y - landmarks[159].y);
  const rightV = (rightIris.y - landmarks[386].y) / (landmarks[374].y - landmarks[386].y);
  const avgV = (leftV + rightV) / 2;

  // Normalize gaze around center point (0.5)
  // Note: Video is mirrored by default, so left/right directions align naturally with screen
  let normX = 50 + (avgH - 0.5) * 100 * SENSITIVITY_X;
  let normY = 50 + (avgV - 0.5) * 100 * SENSITIVITY_Y;

  // Clamp values so the ball stays comfortably within screen edges (5% to 95%)
  targetX = Math.min(Math.max(normX, 5), 95);
  targetY = Math.min(Math.max(normY, 5), 95);
}
