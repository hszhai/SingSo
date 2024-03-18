let socket;
let connectionStatus = '...'; // Initial status message

let mic, fft;
let hi = 40;
let isPlaying = false; // flag to track if audio is playing

let band_num = 8

let currentEmoji; 
let rewardTarget = 250;

let audioInitialized = false; // Flag to ensure audio is initialized once

let sens = 1.0;
const sens_hi = 2.5;

function setup() {
  createCanvas(windowWidth, windowHeight);
  frameRate(60);
  pickNewEmoji();
  
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

  //socket = io.connect(window.location.origin); // Connect to the server
  socket = io.connect('https://singing-turn-based.glitch.me/');

  // Event listener for successfully connecting to the server
  socket.on('connect', function() {
    connectionStatus = 'Connected!'; // Update status on successful connection
  });

  // Optionally, handle connection errors or disconnections
  socket.on('connect_error', (error) => {
    connectionStatus = 'Connection Failed: ' + error.message;
  });

  socket.on('disconnect', (reason) => {
    connectionStatus = 'Disconnected: ' + reason;
  });

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

function touchEnded() {
  // Capture the touch position
  const touchX = mouseX;
  const touchY = mouseY;

  // Emit the touch position to the server
  socket.emit('touchEvent', { x: touchX, y: touchY });

  // Prevent default
  return false;
}

function mouseReleased() {
  // Capture the touch position
  const touchX = mouseX;
  const touchY = mouseY;

  // Emit the touch position to the server
  socket.emit('touchEvent', { x: touchX, y: touchY });

  // Prevent default
  return false;
}


function draw() {
  background(20,120,120);
  render_sens(sens);

  let spectrum = fft.analyze();
  noStroke();

  // Determine the frequency range indexes
  let lowFreq = freqToIndex(80); // Assuming 80 Hz is the lower bound of human voice
  let highFreq = freqToIndex(1100); // Assuming 1100 Hz is the upper bound of human voice

  for (let i = lowFreq; i <= highFreq; i++) {
    let amp = spectrum[i];
    let R = map(amp, 0, 256, 0, 255) * sens;

    if (i> (lowFreq+(highFreq-lowFreq)/2) && R > rewardTarget) {
      pickNewEmoji(i, lowFreq, highFreq);
      draw_emoji();
    }
    fill(R*(1+i/highFreq), R+(1+i/highFreq)*i, 100, 10 + 5 * (i - lowFreq));
    ellipse(windowWidth / 2, windowHeight - (i - lowFreq) * 16*(1+i/highFreq) + 20, R*(1+i/highFreq));
  }

  // Calculate bands dynamically based on 'n'
  let bands = calculateBands(spectrum, band_num);

  // Send bands data if significant change is detected (implement your logic)
  if (shouldSendData(bands)) {
    console.log("Sending audioData:", bands);
    //socket.emit('audioData', bands);
    socket.emit('audioData', { bands: bands, timestamp: Date.now() });

  }

  // Display connection status
  fill(255); // White text color
  textSize(16);
  text(connectionStatus, 10, 20); // Position the status text at the top left

}


// Utility function to convert frequency to FFT index
function freqToIndex(freq) {
  let nyquist = sampleRate() / 2;
  return Math.floor((freq / nyquist) * (fft.analyze().length / 2));
}


/*
// Utility function to convert frequency to FFT index, ensuring it doesn't exceed human voice frequency cap
function freqToIndex(freq) {
  let nyquist = sampleRate() / 2;
  let index = Math.floor((freq / nyquist) * (fft.analyze().length / 2));
  let maxIndex = Math.floor((1100 / nyquist) * (fft.analyze().length / 2)); // Cap at 1100 Hz
  return Math.min(index, maxIndex);
}
*/

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

function draw_emoji() {
  // Change the emoji every 5 seconds (300 frames at 60 fps)
  if (frameCount % 100 == 0) {
    pickNewEmoji();
  }

  textSize(100 + random(-30, 30)); // Slightly vary the size for each emoji
  textAlign(CENTER, CENTER); // Ensure the emoji is centered
  textSize(120 + random(50));
  text(currentEmoji, width * 0.8, height * 0.2);
}

/*
// Utility function to divide spectrum into 'n' bands and calculate average amplitude for each
function calculateBands(spectrum, n) {
  let bands = [];
  let bandWidth = Math.floor(spectrum.length / n); // Divide the spectrum array into 'n' segments

  for (let b = 0; b < n; b++) {
    let startIdx = b * bandWidth;
    let endIdx = startIdx + bandWidth - 1;
    let avgAmplitude = averageAmplitude(spectrum, startIdx, endIdx);
    bands.push(avgAmplitude);
  }

  return bands;
}
*/

// Calculate bands within the focused frequency range of human voices
function calculateBands(spectrum, n) {
  let bands = [];
  let lowFreq = freqToIndex(80); // Low end of human voice
  let highFreq = freqToIndex(1100); // High end capped at 1100 Hz
  let bandWidth = Math.floor((highFreq - lowFreq + 1) / n); // Adjusted to focus within 80-1100 Hz

  for (let b = 0; b < n; b++) {
    let startIdx = lowFreq + b * bandWidth;
    let endIdx = startIdx + bandWidth - 1;
    // Ensure the last band captures all remaining frequencies up to the cap
    if (b == n - 1) endIdx = highFreq;
    let avgAmplitude = averageAmplitude(spectrum, startIdx, endIdx);
    bands.push(avgAmplitude);
  }

  return bands;
}


// Calculate average amplitude in a given range of the spectrum array
function averageAmplitude(spectrum, startIdx, endIdx) {
  let total = 0;
  for (let i = startIdx; i <= endIdx; i++) {
    total += spectrum[i];
  }
  return total / (endIdx - startIdx + 1);
}

/*
// Implement logic to determine when to send data
function shouldSendData(bands) {
  // Example condition, you might want to replace with your own logic
  let threshold = 2; // Example threshold value
  return bands.some(band => band > threshold);
}*/

// Implement logic to determine when to send data based on maximum amplitude
let prevMaxAmplitude = 0; // Store previous max amplitude to detect significant changes
const MIN_CHANGE = 0.5; // Minimum change in amplitude to consider sending data

function shouldSendData(bands) {
  // Calculate current max amplitude
  let currentMaxAmplitude = Math.max(...bands);
  let threshold = 100

  //console.log("should send",currentMaxAmplitude)

  // Check if the change in amplitude is significant
  let change = Math.abs(currentMaxAmplitude - prevMaxAmplitude);
  prevMaxAmplitude = currentMaxAmplitude; // Update for the next frame

  // Determine if data should be sent based on threshold or significant change
  return currentMaxAmplitude > threshold || change > MIN_CHANGE;
}


/*
function pickNewEmoji() {
  let emojis = ["😄", "🎉", "🌟", "🥳", "👏", "🎁","👑","🦄","🌷","💎","🦋"];
  currentEmoji = random(emojis); // Randomly pick a new emoji
}
*/

function pickNewEmoji(frequencyIndex, lowFreq, highFreq) {
  // Define your emojis within the function to make it self-contained
  //let emojis = ["😄", "🎉", "🌟", "🥳", "👏", "🎁", "👑", "🦄", "🌷", "💎", "🦋"];
  let emojis = ["😄", "🌟", "🎁", "👑", "🦄", "🌷", "💎", "🦋"];

  // Calculate the range of frequencies covered
  let totalRange = highFreq - lowFreq;

  // Calculate the size of each bin based on the number of emojis and the total frequency range
  let binSize = totalRange / emojis.length;

  // Determine the bin index for the current frequency
  let binIndex = Math.floor((frequencyIndex - lowFreq) / binSize);
  binIndex = constrain(binIndex, 0, emojis.length - 1); // Ensure binIndex is within bounds

  // Set the current emoji based on the bin index
  currentEmoji = emojis[binIndex];
}
