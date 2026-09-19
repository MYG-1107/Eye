// Extract MediaPipe classes from global scope
const { FaceLandmarker, FilesetResolver } = window.tasksVision || tasksVision;

const startBtn = document.getElementById("start-btn");
const startScreen = document.getElementById("start-screen");
const appContainer = document.getElementById("app-container");
const video = document.getElementById("webcam");
const target = document.getElementById("exercise-target");
const instructionText = document.getElementById("instruction-text");

// Debug UI Elements
const statusText = document.getElementById("status-text");
const gazeText = document.getElementById("gaze-text");
const requiredText = document.getElementById("required-text");
const holdProgress = document.getElementById("hold-progress");

let faceLandmarker;
let lastVideoTime = -1;
let holdCounter = 0;
const HOLD_FRAMES_REQUIRED = 30; // ~1 second of steady gaze hold to pass step

// Guided Exercise Sequence
const exerciseSteps = [
  { label: "Look UP as far as you can ⬆️", targetX: 50, targetY: 12, requiredDirection: "UP" },
  { label: "Return your eyes to CENTER 🎯", targetX: 50, targetY: 50, requiredDirection: "CENTER" },
  { label: "Look DOWN as far as you can ⬇️", targetX: 50, targetY: 88, requiredDirection: "DOWN" },
  { label: "Return your eyes to CENTER 🎯", targetX: 50, targetY: 50, requiredDirection: "CENTER" },
  { label: "Look LEFT as far as you can ⬅️", targetX: 10, targetY: 50, requiredDirection: "LEFT" },
  { label: "Return your eyes to CENTER 🎯", targetX: 50, targetY: 50, requiredDirection: "CENTER" },
  { label: "Look RIGHT as far as you can ➡️", targetX: 90, targetY: 50, requiredDirection: "RIGHT" },
  { label: "Exercise Complete! Great job! 🎉", targetX: 50, targetY: 50, requiredDirection: "DONE" }
];

let currentStepIndex = 0;

// 1. Initialize FaceLandmarker
async function initializeFaceLandmarker() {
  try {
    statusText.innerText = "Loading AI Model...";
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
    statusText.innerText = "Ready to start";
  } catch (err) {
    statusText.innerText = "Model Load Failed ❌";
    console.error(err);
  }
}

initializeFaceLandmarker();

// 2. Start Button Trigger
startBtn.addEventListener("click", async () => {
  if (!faceLandmarker) {
    alert("Please wait for the AI model to finish loading.");
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

// 3. Detect Eye Movement using MediaPipe Blendshapes
function detectGazeDirection(blendshapes) {
  if (!blendshapes || blendshapes.length === 0) return "CENTER";

  const scores = {};
  blendshapes[0].categories.forEach(b => {
    scores[b.categoryName] = b.score;
  });

  const lookUp = ((scores["eyeLookUpLeft"] || 0) + (scores["eyeLookUpRight"] || 0)) / 2;
  const lookDown = ((scores["eyeLookDownLeft"] || 0) + (scores["eyeLookDownRight"] || 0)) / 2;
  
  // Front camera stream is mirrored
  const lookLeft = ((scores["eyeLookOutLeft"] || 0) + (scores["eyeLookInRight"] || 0)) / 2;
  const lookRight = ((scores["eyeLookInLeft"] || 0) + (scores["eyeLookOutRight"] || 0)) / 2;

  // Thresholds for triggering directions
  if (lookUp > 0.18) return "UP";
  if (lookDown > 0.18) return "DOWN";
  if (lookLeft > 0.18) return "LEFT";
  if (lookRight > 0.18) return "RIGHT";

  return "CENTER";
}

// 4. Main Real-time Frame Loop
async function predictWebcam() {
  if (!video.paused && !video.ended && video.readyState >= 2 && !document.hidden) {
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const results = faceLandmarker.detectForVideo(video, performance.now());

      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        statusText.innerText = "Person Detected ✅";
        statusText.style.color = "#10b981";

        const detectedDirection = detectGazeDirection(results.faceBlendshapes);
        gazeText.innerText = detectedDirection;

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

function markPersonAbsent() {
  statusText.innerText = "No Person Detected ❌";
  statusText.style.color = "#ef4444";
  gazeText.innerText = "NONE";
  holdCounter = 0;
  holdProgress.value = 0;
}

// 5. Verify Gaze & Advance Ball Position
function processExerciseProgress(detectedDirection) {
  if (currentStepIndex >= exerciseSteps.length) return;

  const currentStep = exerciseSteps[currentStepIndex];

  if (detectedDirection === currentStep.requiredDirection || currentStep.requiredDirection === "DONE") {
    holdCounter++;
    const progressPercent = Math.min(100, (holdCounter / HOLD_FRAMES_REQUIRED) * 100);
    holdProgress.value = progressPercent;

    if (holdCounter >= HOLD_FRAMES_REQUIRED) {
      holdCounter = 0;
      holdProgress.value = 0;
      currentStepIndex++;
      updateStepUI();
    }
  } else {
    holdCounter = Math.max(0, holdCounter - 1);
    holdProgress.value = (holdCounter / HOLD_FRAMES_REQUIRED) * 100;
  }
}

function updateStepUI() {
  if (currentStepIndex >= exerciseSteps.length) return;

  const step = exerciseSteps[currentStepIndex];
  instructionText.innerText = step.label;
  requiredText.innerText = step.requiredDirection;
  target.style.left = `${step.targetX}%`;
  target.style.top = `${step.targetY}%`;
}
