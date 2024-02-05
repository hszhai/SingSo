let mic, fft;
let hi = 40;
let isPlaying = false; // flag to track if audio is playing

function setup() {
  createCanvas(windowWidth, windowHeight);
  mic = new p5.AudioIn();
  fft = new p5.FFT();

  // Create a button element
  let button = createButton('Start');
  button.position(10, 10);
  button.mousePressed(startAudio);
}

function startAudio() {
  if (!isPlaying) {
    // This ensures that the audio context is in a resumable state,
    // as user interaction is present in this function call.
    userStartAudio().then(() => {
      mic.start();
      fft.setInput(mic);
      isPlaying = true;
    }).catch((e) => {
      console.log("Error starting audio:", e);
    });
  }
}


function draw() {
  background(20,120,120);

  let spectrum = fft.analyze();
  noStroke();

  for (let i = 0; i < spectrum.length; i++) {
    let amp = spectrum[i];
    let y = map(amp, 0, 256, height, 0);
    fill(255, 255, 255);
    rect(i * hi, y, hi, height - y);
  }

}


function touchStarted() {
  console.log('touchStarted');
  if (getAudioContext().state !== 'running') {
    getAudioContext().resume();
    mic.start();  // Start the microphone input
    fft.setInput(mic);  // Set the FFT input to the microphone
  }
  // prevent default
  return false;
}

/*
function touchStarted() {
  if (getAudioContext().state !== 'running') {
    userStartAudio().then(() => {
      console.log("Audio context resumed!");
    }).catch((e) => {
      console.log("Error resuming audio context:", e);
    });
  }
  return false;
}*/

