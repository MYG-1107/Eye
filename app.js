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
let holdCounter = 0;
const HOLD_FRAMES_REQUIRED = 45; // ~1.5 seconds of holding gaze to complete step

// Exercise Sequence Workflow
const exerciseSteps = [
  { label: "Look UP as far as you can ⬆️", targetX: 50, targetY: 10, requiredDirection: "UP" },
  { label: "Return your eyes to CENTER 🎯", targetX: 50, targetY: 50, requiredDirection: "CENTER" },
  { label: "Look DOWN as far as you can ⬇️", targetX: 50, targetY: 90, requiredDirection: "DOWN" },
  { label: "Return your eyes to CENTER 🎯", targetX: 50, targetY: 50, requiredDirection: "CENTER" },
  { label: "Look LEFT as far as you can ⬅️", targetX: 10, targetY: 50, requiredDirection: "LEFT" },
  { label: "Return your eyes to CENTER 🎯", targetX: 50, targetY: 50, requiredDirection: "CENTER" },
  { label: "Look RIGHT as far as you can ➡️", targetX: 90, targetY: 50, requiredDirection: "RIGHT" },
  { label: "Exercise Complete! Great job! 🎉", targetX: 50, targetY: 50, requiredDirection: "DONE" }
];

let currentStepIndex = 0;

// Initialize MediaPipe Face Landmarker with Blendshapes enabled
async function initializeFaceLandmarker() {
  const filesetResolver = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );
  faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
      delegate: "GPU"
    },
    outputFaceBlendshapes: true, // Enables high-accuracy gaze blendshape scores
    runningMode: "VIDEO",
    numFaces: 1
  });
  statusBadge.innerText = "Camera Ready";
}

initializeFaceLandmarker();

// Handle tab switching / losing focus
document.addEventListener("visibilitychange", () => {
  if (document.hidden) markPersonAbsent();
});

function markPersonAbsent() {
  holdCounter = 0;
  statusBadge.innerText = "No Person Detected ❌";
  statusBadge.style.background = "rgba(239, 68, 68, 0.2)";
}

function markPersonPresent(detectedDirection) {
  statusBadge.innerText = `Person Detected ✅ | Gaze: ${detectedDirection}`;
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

    updateStepUI();
    video.addEventListener("loadeddata", predictWebcam);
  } catch (err) {
    alert("Camera permission and fullscreen access are required.");
    console.error(err);
  }
});

// Detect Gaze Direction using MediaPipe Blendshapes
function detectGazeDirection(blendshapes) {
  if (!blendshapes || blendshapes.length === 0) return "CENTER";

  const scores = {};
  blendshapes[0].categories.forEach(b => {
    scores[b.categoryName] = b.score;
  });

  const lookUp = ((scores["eyeLookUpLeft"] || 0) + (scores["eyeLookUpRight"] || 0)) / 2;
  const lookDown = ((scores["eyeLookDownLeft"] || 0) + (scores["eyeLookDownRight"] || 0)) / 2;
  
  // Account for mirrored front camera stream
  const lookLeft = ((scores["eyeLookOutLeft"] || 0) + (scores["eyeLookInRight"] || 0)) / 2;
  const lookRight = ((scores["eyeLookInLeft"] || 0) + (scores["eyeLookOutRight"] || 0)) / 2;

  // Sensitivity thresholds
  if (lookUp > 0.22) return "UP";
  if (lookDown > 0.22) return "DOWN";
  if (lookLeft > 0.22) return "LEFT";
  if (lookRight > 0.22) return "RIGHT";

  return "CENTER";
}

// Frame Loop
async function predictWebcam() {
  if (!video.paused && !video.ended && video.readyState >= 2 && !document.hidden) {
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const results = faceLandmarker.detectForVideo(video, performance.now());

      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        const detectedDirection = detectGazeDirection(results.faceBlendshapes);
        markPersonPresent(detectedDirection);
        processExerciseProgress(detectedDirection);
      } else {
        markPersonAbsent();
      }
    }
  } else {
    markPersonAbsent();
  }

  requestAnimationFrame(predictWebcam);
}

// Step Validation Logic
function processExerciseProgress(detectedDirection) {
  if (currentStepIndex >= exerciseSteps.length) return;

  const currentStep = exerciseSteps[currentStepIndex];

  // Advance step when user holds their gaze in required direction
  if (detectedDirection === currentStep.requiredDirection || currentStep.requiredDirection === "DONE") {
    holdCounter++;
    target.style.transform = `translate(-50%, -50%) scale(${1 + (holdCounter / HOLD_FRAMES_REQUIRED) * 0.4})`;

    if (holdCounter >= HOLD_FRAMES_REQUIRED) {
      holdCounter = 0;
      currentStepIndex++;
      updateStepUI();
    }
  } else {
    holdCounter = Math.max(0, holdCounter - 1); // Gradually decay progress if gaze drifts
    target.style.transform = `translate(-50%, -50%) scale(1)`;
  }
}

function updateStepUI() {
  if (currentStepIndex >= exerciseSteps.length) return;

  const step = exerciseSteps[currentStepIndex];
  instructionText.innerText = step.label;
  target.style.left = `${step.targetX}%`;
  target.style.top = `${step.targetY}%`;
}
