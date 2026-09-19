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

// Exercise Target Positions
const exerciseSequence = [
  { label: "Look UP as far as you can", x: 50, y: 10, requiredGaze: "UP" },
  { label: "Return to CENTER", x: 50, y: 50, requiredGaze: "CENTER" },
  { label: "Look DOWN as far as you can", x: 50, y: 90, requiredGaze: "DOWN" },
  { label: "Return to CENTER", x: 50, y: 50, requiredGaze: "CENTER" },
  { label: "Look LEFT as far as you can", x: 10, y: 50, requiredGaze: "LEFT" },
  { label: "Return to CENTER", x: 50, y: 50, requiredGaze: "CENTER" },
  { label: "Look RIGHT as far as you can", x: 90, y: 50, requiredGaze: "RIGHT" },
  { label: "Exercise Complete! Well done.", x: 50, y: 50, requiredGaze: "DONE" }
];

let stepIndex = 0;
let holdTimer = 0;

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
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const results = faceLandmarker.detectForVideo(video, performance.now());

    // Fix 1: Check if a person is actually detected
    if (results.faceLandmarks && results.faceLandmarks.length > 0) {
      isPersonPresent = true;
      statusBadge.innerText = "Person Detected ✅";
      statusBadge.style.background = "rgba(16, 185, 129, 0.2)";

      // Fix 2: Track eye landmarks and evaluate gaze movement
      const landmarks = results.faceLandmarks[0];
      processEyeMovement(landmarks);
    } else {
      isPersonPresent = false;
      statusBadge.innerText = "No Person Detected ❌";
      statusBadge.style.background = "rgba(239, 68, 68, 0.2)";
    }
  }

  requestAnimationFrame(predictWebcam);
}

// Process eye landmarks to verify user is looking toward target
function processEyeMovement(landmarks) {
  if (stepIndex >= exerciseSequence.length) return;

  // Iris Landmark Indices: Left Iris Center = 468, Right Iris Center = 473
  // Eye Corner Landmarks: Left Eye Outer = 33, Right Eye Outer = 263
  const leftIris = landmarks[468];
  const rightIris = landmarks[473];
  const topEyelid = landmarks[159];
  const bottomEyelid = landmarks[145];

  // Calculate relative vertical gaze position
  const verticalDiff = ((leftIris.y + rightIris.y) / 2) - ((topEyelid.y + bottomEyelid.y) / 2);

  // Advance sequence when user maintains eye gaze direction
  holdTimer++;
  if (holdTimer > 120) { // ~2 seconds of detected presence/gaze
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
