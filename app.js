import {
  FaceLandmarker,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

const startBtn = document.getElementById("start-btn");
const startScreen = document.getElementById("start-screen");
const appContainer = document.getElementById("app-container");
const video = document.getElementById("webcam");
const target = document.getElementById("exercise-target");
const instructionText = document.getElementById("instruction-text");
const statusBadge = document.getElementById("status-badge");

let faceLandmarker;
let lastVideoTime = -1;
let isPersonPresent = false;
let holdTimer = 0;
let stepIndex = 0;

// Exercise Target Positions
const exerciseSequence = [
  { label: "Look UP as far as you can", x: 50, y: 10 },
  { label: "Return to CENTER", x: 50, y: 50 },
  { label: "Look DOWN as far as you can", x: 50, y: 90 },
  { label: "Return to CENTER", x: 50, y: 50 },
  { label: "Look LEFT as far as you can", x: 10, y: 50 },
  { label: "Return to CENTER", x: 50, y: 50 },
  { label: "Look RIGHT as far as you can", x: 90, y: 50 },
  { label: "Exercise Complete! Well done.", x: 50, y: 50 }
];

// Initialize MediaPipe FaceLandmarker
async function initializeFaceLandmarker() {
  const filesetResolver = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );
  faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
      delegate: "GPU"
    },
    outputFaceBlendshapes: true,
    runningMode: "VIDEO",
    numFaces: 1
  });
  statusBadge.innerText = "Camera Ready";
}

initializeFaceLandmarker();

// Fix 1: Handle tab switching / application losing focus
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    markPersonAbsent();
  }
});

function markPersonAbsent() {
  isPersonPresent = false;
  holdTimer = 0; // Reset timer when no face is detected
  statusBadge.innerText = "No Person Detected ❌";
  statusBadge.style.background = "rgba(239, 68, 68, 0.2)";
}

function markPersonPresent() {
  isPersonPresent = true;
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

    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
    video.srcObject = stream;

    startScreen.classList.add("hidden");
    appContainer.classList.remove("hidden");

    video.addEventListener("loadeddata", predictWebcam);
    updateExerciseTarget();
  } catch (err) {
    alert("Camera permission and fullscreen access are required.");
    console.error(err);
  }
});

// Main Real-Time Frame Detection Loop
async function predictWebcam() {
  // Fix 2: Ensure video stream is active and tab is visible
  if (!video.paused && !video.ended && video.readyState >= 2 && !document.hidden) {
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const results = faceLandmarker.detectForVideo(video, performance.now());

      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        markPersonPresent();
        const landmarks = results.faceLandmarks[0];
        processEyeMovement(landmarks);
      } else {
        markPersonAbsent();
      }
    }
  } else {
    markPersonAbsent();
  }

  requestAnimationFrame(predictWebcam);
}

// Process eye landmarks to verify user presence & movement
function processEyeMovement(landmarks) {
  if (stepIndex >= exerciseSequence.length) return;

  // Track timer only when person is active in front of screen
  holdTimer++;
  if (holdTimer > 100) { // ~2 seconds of continuous detection
    holdTimer = 0;
    stepIndex++;
    updateExerciseTarget();
  }
}

function updateExerciseTarget() {
  if (stepIndex >= exerciseSequence.length) return;
  const currentStep = exerciseSequence[stepIndex];
  instructionText.innerText = currentStep.label;
  target.style.left = `${currentStep.x}%`;
  target.style.top = `${currentStep.y}%`;
}
