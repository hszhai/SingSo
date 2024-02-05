let mic, fft;
let hi = 40;
let isPlaying = false; // flag to track if audio is playing

let audioInitialized = false; // Flag to ensure audio is initialized once

let sens = 1.0;
const sens_hi = 2.5;

function setup() {
  createCanvas(windowWidth, windowHeight);
  mic = new p5.AudioIn();
  fft = new p5.FFT();

  let text = createP('Touch to Start');  
  text.style('font-size', '48px'); 
  text.style('color', 'white'); 
  text.position(width / 2 - text.width / 2, height / 2 - text.height / 2); // Re-position after setting style
  
  text.style('text-align', 'center');
  text.position(width / 2 - text.elt.offsetWidth / 2, height / 2 - text.elt.offsetHeight / 2);

  // Display "Start" text for 3 seconds
  setTimeout(() => {
    text.remove();
  }, 3000);
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

function touchStarted() {
  console.log('touchStarted');
  
  if (!audioInitialized) {
    getAudioContext().resume().then(() => {
      console.log("Audio context resumed successfully");
      mic.start(() => {
        console.log("Microphone started successfully");
        fft.setInput(mic);
        audioInitialized = true;
      }, (err) => {
        console.error("Error starting microphone:", err);
      });
    }).catch((err) => {
      console.error("Error resuming audio context:", err);
    });
  }
  
  if (mouseX > width / 2) {
    sens += 0.1; // Increase sens by 0.1
  } else {
    sens -= 0.1; // Decrease sens by 0.1
  }

  sens = constrain(sens, 0, sens_hi);
  console.log('sens:', sens);
  
  return false;
}

function draw() {
  background(20,120,120);
  render_sens(sens);

  let spectrum = fft.analyze();
  noStroke();

  /*
  for (let i = 0; i < spectrum.length; i++) {
    let amp = spectrum[i];
    let R = map(amp, 0, 256, 0, 255) * sens;
    //fill(i*10 +10, 0, 0, 10+5*i);
    fill(255, 0, 0, 10+5*i);
    ellipse(windowWidth/2, windowHeight-i*16 +20 , R); 
  }
  */


  // Determine the frequency range indexes
  let lowFreq = freqToIndex(80); // Assuming 80 Hz is the lower bound of human voice
  let highFreq = freqToIndex(1100); // Assuming 1100 Hz is the upper bound of human voice

  for (let i = lowFreq; i <= highFreq; i++) {
    let amp = spectrum[i];
    let R = map(amp, 0, 256, 0, 255) * sens;
    fill(R*(1+i/highFreq), R+(1+i/highFreq)*i, 100, 10 + 5 * (i - lowFreq));
    ellipse(windowWidth / 2, windowHeight - (i - lowFreq) * 16*(1+i/highFreq) + 20, R*(1+i/highFreq));
  }


}

// Utility function to convert frequency to FFT index
function freqToIndex(freq) {
  let nyquist = sampleRate() / 2;
  return Math.floor((freq / nyquist) * (fft.analyze().length / 2));
}

function render_sens(v) {
  push();
  fill(255);
  let vv = map(v, 0, 2, 0, width);
  rect(0, 0, vv, 10);
  pop();
}

function render_sens(v) {
  push();
  fill("#14b8a6");
  let vv = map(v, 0, sens_hi, 0, width);
  rect(0, 0, vv, 5);
  pop();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight); 
}