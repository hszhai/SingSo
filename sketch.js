let socket;
let connectionStatus = '...'; // Initial status message
let myGroup;

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

  socket.on('groupAssigned', function(group) {
    myGroup = group;
    console.log('My group:', myGroup);
    // Now, you can use `myGroup` to display group-specific information,
    // handle messages accordingly, etc.
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
  
  if (mouseY < height / 10) { 
    if (mouseX < width / 2) {
      socket.emit('joinGroup', 'left');
    } else {
      socket.emit('joinGroup', 'right');
    }
  } else if (mouseX > width / 2) {
    sens += 0.1; 
  } else {
    sens -= 0.1; 
  }

  sens = constrain(sens, 0, sens_hi);
  console.log('sens:', sens);
  
  return false;
}

function touchEnded() {
  const touchX = mouseX;
  const touchY = mouseY;
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
  draw_group_cues();
  render_sens(sens);

  let spectrum = fft.analyze();
  noStroke();

  // collect audio data, prepare for sending
  let bin_amps = []

  // Determine the frequency range indexes
  let lowFreq = freqToIndex(80); // Assuming 80 Hz is the lower bound of human voice
  let highFreq = freqToIndex(1100); // Assuming 1100 Hz is the upper bound of human voice

  for (let i = lowFreq; i <= highFreq; i++) {
    let amp = spectrum[i];
    //let R = map(amp, 0, 256, 0, 255) * sens;
    let R = amp * sens;

    bin_amps.push({ freq_bin: i, amp: R });

    if (i> (lowFreq+(highFreq-lowFreq)/2) && R > rewardTarget) {
      pickNewEmoji(i, lowFreq, highFreq);
      draw_emoji();
    }
    fill(R*(1+i/highFreq), R+(1+i/highFreq)*i, 100, 10 + 5 * (i - lowFreq));
    ellipse(windowWidth / 2, windowHeight - (i - lowFreq) * 16*(1+i/highFreq) + 20, R*(1+i/highFreq));
  }

  // Calculate the sum of the first 5 bins' amplitudes
  let sumFirst5Bins = 0;
  for (let i = 0; i < Math.min(5, bin_amps.length); i++) {
    sumFirst5Bins += bin_amps[i].amp;
  }

  // Only send data if the sum of the first 5 bins' amplitudes is >= 0.1
  if (sumFirst5Bins >= 10) {
    //console.log("Sending audio data:", bin_amps);
    socket.emit('audioData', { bin_amps: bin_amps, timestamp: Date.now() });
  } else {
    console.log("Sum of the first 5 bins is too small, data not sent.");
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

function render_sens(v) {
  push();
  fill("#14b8a6");
  let vv = map(v, 0, sens_hi, 0, width);
  rect(0, 0, vv, 5);
  pop();
}

function draw_group_cues() {
  push();
  fill(200,0,0,50)
  rect(0, 0, width/2, height/10);
  fill(0,200,0,50)
  rect(width/2, 0, width/2, height/10);
  pop();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight); 
}

function draw_emoji() {
  // probably don't need this, as it will pick the same emoji based on frequency
  if (frameCount % 100 == 0) {
    pickNewEmoji();
  }

  textSize(100 + random(-30, 30)); // Slightly vary the size for each emoji
  textAlign(CENTER, CENTER); // Ensure the emoji is centered
  textSize(120 + random(50));
  text(currentEmoji, width * 0.8, height * 0.2);
}

function pickNewEmoji(frequencyIndex, lowFreq, highFreq) {
  // Define your emojis within the function to make it self-contained
  let emojis = ["😄", "🌟", "🎁", "👑", "🦄", "🌷", "💎", "🦋"];

  let totalRange = highFreq - lowFreq;
  let binSize = totalRange / emojis.length;

  // Determine the bin index for the current frequency
  let binIndex = Math.floor((frequencyIndex - lowFreq) / binSize);
  binIndex = constrain(binIndex, 0, emojis.length - 1); // Ensure binIndex is within bounds

  currentEmoji = emojis[binIndex];
}
