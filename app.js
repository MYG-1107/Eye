const startBtn = document.getElementById("start-btn");
const startScreen = document.getElementById("start-screen");
const appContainer = document.getElementById("app-container");
const video = document.getElementById("webcam");
const target = document.getElementById("exercise-target");
const instructionText = document.getElementById("instruction-text");
const statusBadge = document.getElementById("status-badge");

// Sequence of exercise target positions (Percentage coordinates)
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

let stepIndex = 0;

startBtn.addEventListener("click", async () => {
  try {
    // 1. Enter Fullscreen Mode
    if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
    }

    // 2. Request Camera Access
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
    video.srcObject = stream;

    // 3. Update UI
    startScreen.classList.add("hidden");
    appContainer.classList.remove("hidden");

    // 4. Start Face Detection & Exercise Routine
    video.onloadeddata = () => {
      statusBadge.innerText = "Person Detected ✅";
      runExerciseRoutine();
    };
  } catch (err) {
    alert("Camera permission or fullscreen access is required to run the application.");
    console.error(err);
  }
});

function moveTarget(x, y) {
  target.style.left = `${x}%`;
  target.style.top = `${y}%`;
}

function runExerciseRoutine() {
  if (stepIndex >= exerciseSequence.length) return;

  const currentStep = exerciseSequence[stepIndex];
  instructionText.innerText = currentStep.label;
  moveTarget(currentStep.x, currentStep.y);

  stepIndex++;
  
  // Transition to next target every 4 seconds
  if (stepIndex < exerciseSequence.length) {
    setTimeout(runExerciseRoutine, 4000);
  }
}
