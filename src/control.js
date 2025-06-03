const car = document.getElementById('car');
const arm = document.getElementById('arm');
const fingerL = document.getElementById('fingerL');
const fingerR = document.getElementById('fingerR');
const ballsContainer = document.getElementById('balls-container');
let grabbedBall = null;
let possibleGrabbedBall = null;


class Ball {
    constructor(parent) {
        this.element = document.createElement('div');
        this.element.className = 'ball';
        this.element.style.left = Math.random() * (parent.clientWidth - 30) + 'px';
        this.element.style.top = Math.random() * (parent.clientHeight - 30) + 'px';
        this.element.style.backgroundColor = "green";
        parent.appendChild(this.element);
    }
  }

function isArmOverBall() {
    const armRect = arm.getBoundingClientRect();
    const fingerLRect = fingerL.getBoundingClientRect();
    const fingerRRect = fingerR.getBoundingClientRect();
    const balls = document.querySelectorAll('.ball');

    // Calculate the center point between the fingers at their tips
    const gripperTipX = ((fingerLRect.left + fingerLRect.width/2) + (fingerRRect.left + fingerRRect.width/2)) / 2;
    const gripperTipY = ((fingerLRect.top + fingerLRect.height/2) + (fingerRRect.top + fingerRRect.height/2)) / 2;

    
    for (const ball of balls) {
        const ballRect = ball.getBoundingClientRect();
        const ballCenterX = ballRect.left + ballRect.width/2;
        const ballCenterY = ballRect.top + ballRect.height/2;
        
        // Check if gripper tip is near the ball
        if (Math.abs(gripperTipX - ballCenterX) < 20 &&
            Math.abs(gripperTipY - ballCenterY) < 20) {
            return ball;
        }
    }
    return null;
}

function updateBallPosition() {
    if (grabbedBall) {
        const fingerLRect = fingerL.getBoundingClientRect();
        const fingerRRect = fingerR.getBoundingClientRect();
        
        // Position the ball between the finger tips
        const gripperTipX = ((fingerLRect.left + fingerLRect.width/2) + (fingerRRect.left + fingerRRect.width/2)) / 2;
        const gripperTipY = ((fingerLRect.top + fingerLRect.height/2) + (fingerRRect.top + fingerRRect.height/2)) / 2;
        
        grabbedBall.style.left = (gripperTipX - 15) + 'px';
        grabbedBall.style.top = (gripperTipY - 15) + 'px';
    }
}

let carX = (window.innerWidth - 50) / 2;
let carY = (window.innerHeight - 150) / 2;
let rotation = 0;
const step = 3; // Geschwindigkeit der Bewegung verringert

let armHeight = 80;
const armMin = 20, armMax = 80;

let gripperOpenAmount = 0; // 0 = geschlossen, 1 = vollständig geöffnet

let keysPressed = {};

// WebSerial-Variablen
let port = null;
let reader = null;
let writer = null;
let serialConnected = false;

// WebSerial-Funktionen
async function connectSerial() {
  try {
    // WebSerial API verfügbar prüfen
    if (!('serial' in navigator)) {
      alert('WebSerial wird von diesem Browser nicht unterstützt! infos zu unterstützten browsern unter:https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API#browser_compatibility');
      return false;
    }

    // Port-Auswahl anfordern
    port = await navigator.serial.requestPort();
    
    // Port öffnen
    await port.open({ 
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: 'none'
    });

    // Reader und Writer erstellen
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
    reader = textDecoder.readable.getReader();

    const textEncoder = new TextEncoderStream();
    const writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
    writer = textEncoder.writable.getWriter();

    serialConnected = true;
    updateSerialStatus();
    console.log('Serial-Verbindung hergestellt');
    
    // Daten lesen starten
    readSerialData();
    
    return true;
  } catch (error) {
    console.error('Fehler beim Verbinden:', error);
    updateSerialStatus();
    return false;
  }
}

async function disconnectSerial() {
  try {
    if (reader) {
      await reader.cancel();
      reader = null;
    }
    if (writer) {
      await writer.close();
      writer = null;
    }
    if (port) {
      await port.close();
      port = null;
    }
    
    // Alle seriellen Befehle deaktivieren
    for (let timer of Object.values(serialCommandTimers)) {
      clearTimeout(timer);
    }
    serialCommandTimers = {};
    serialBuffer = '';
    
    // Alle durch serielle Befehle aktivierten Tasten deaktivieren
    Object.keys(keysPressed).forEach(key => {
      if (['w','a','s','d','q','e','r','f','t','g'].includes(key)) {
        keysPressed[key] = false;
      }
    });
    
    serialConnected = false;
    updateSerialStatus();
    console.log('Serial-Verbindung getrennt');
  } catch (error) {
    console.error('Fehler beim Trennen:', error);
    updateSerialStatus();
  }
}

function updateSerialStatus() {
  const statusElement = document.getElementById('serialStatus');
  const connectBtn = document.getElementById('connectBtn');
  const disconnectBtn = document.getElementById('disconnectBtn');
  
  if (statusElement) {
    statusElement.textContent = serialConnected ? 'Verbunden' : 'Nicht verbunden';
    statusElement.style.color = serialConnected ? '#28a745' : '#dc3545';
  }
  
  if (connectBtn) connectBtn.disabled = serialConnected;
  if (disconnectBtn) disconnectBtn.disabled = !serialConnected;
}

// Buffer für eingehende Daten
let serialBuffer = '';
let serialCommandTimers = {};

async function readSerialData() {
  try {
    while (serialConnected && reader) {
      const { value, done } = await reader.read();
      if (done) break;
      
      // Daten zum Buffer hinzufügen
      serialBuffer += value;
      
      // Zeilenweise verarbeiten
      let lines = serialBuffer.split('\n');
      serialBuffer = lines.pop() || ''; // Letzten unvollständigen Teil behalten
      
      for (let line of lines) {
        const data = line.trim().toLowerCase();
        // Prüfen auf Rotationsbefehl
        if (data.startsWith('#:')) {
          const angle = parseFloat(data.substring(2));
          if (!isNaN(angle)) {
            console.log('Empfangen Rotation:', angle);
            rotation = angle;
            car.style.transform = `rotate(${rotation}deg)`;
          }
        }
        // Standard Bewegungsbefehle
        else if (data && ['w','a','s','d','q','e','r','f','t','g'].includes(data)) {
          console.log('Empfangen:', data);
          handleSerialCommand(data);
        }
      }
      
      // Auch einzelne Zeichen oder Befehle ohne Zeilenumbruch verarbeiten
      if (serialBuffer.length > 0 && !serialBuffer.startsWith('#:')) {
        const data = serialBuffer.trim().toLowerCase();
        if (data.startsWith('#:')) {
          const angle = parseFloat(data.substring(2));
          if (!isNaN(angle)) {
            console.log('Empfangen Rotation (ohne \\n):', angle);
            rotation = angle*-1;
            updateCarPosition();
            serialBuffer = ''; // Buffer leeren nach Verarbeitung
          }
        }
        else if (['w','a','s','d','q','e','r','f','t','g'].includes(data)) {
          console.log('Empfangen (ohne \\n):', data);
          handleSerialCommand(data);
          serialBuffer = ''; // Buffer leeren nach Verarbeitung
        }
      }
    }
  } catch (error) {
    console.error('Fehler beim Lesen:', error);
    serialConnected = false;
  }
}

function handleSerialCommand(command) {
  // Kontinuierliche Steuerung: Taste aktivieren
  keysPressed[command] = true;
  
  // Timer für diesen Befehl zurücksetzen
  if (serialCommandTimers[command]) {
    clearTimeout(serialCommandTimers[command]);
  }
  
  // Timer setzen, um Befehl nach kurzer Zeit zu deaktivieren
  // (falls keine neuen Befehle kommen)
  serialCommandTimers[command] = setTimeout(() => {
    keysPressed[command] = false;
    delete serialCommandTimers[command];
  }, 150); // 150ms Timeout - kann angepasst werden
}

async function sendSerialData(data) {
  if (writer && serialConnected) {
    try {
      await writer.write(data + '\n');
    } catch (error) {
      console.error('Fehler beim Senden:', error);
    }
  }
}

function degToRad(deg) {
  return deg * Math.PI / 180;
}

function updateArm() {
  // Armlänge setzen
  arm.style.height = armHeight + 'px';
  arm.style.top = -armHeight + 'px';

  // Maximaler Winkel und maximale Verschiebung der Greiferfinger
  const maxRotate = 30; // maximale Rotationswinkel
  const maxTranslate = 10; // maximale Verschiebung in Pixel

  // Interpolierte Werte abhängig vom Öffnungsgrad
  const rotateL = -5 - (maxRotate - 5) * gripperOpenAmount;
  const rotateR = 5 + (maxRotate - 5) * gripperOpenAmount;
  const translateX = maxTranslate * gripperOpenAmount;

  // Transformation der linken und rechten Greiferfinger
  fingerL.style.transform = `rotate(${rotateL}deg) translateX(-${translateX}px)`;
  fingerR.style.transform = `rotate(${rotateR}deg) translateX(${translateX}px)`;
}

function updateCarPosition() {
  car.style.left = carX + 'px';
  car.style.top = carY + 'px';
  car.style.transform = `rotate(${rotation}deg)`;
}

function moveCar(direction) {
  const rad = degToRad(rotation);
  let dx = 0, dy = 0;

  switch (direction) {
    case 'w': // vorwärts
      dx = Math.sin(rad) * step;
      dy = -Math.cos(rad) * step;
      break;
    case 's': // rückwärts
      dx = -Math.sin(rad) * step;
      dy = Math.cos(rad) * step;
      break;
    case 'q': // links drehen - nur Rotation
      rotation -= step/2; // Rotation ohne Vorwärtsbewegung
      dx = 0;
      dy = 0;
      break;
    case 'e': // rechts drehen - nur Rotation
      rotation += step/2; // Rotation ohne Vorwärtsbewegung	
      dx = 0;
      dy = 0;
      break;
  }

  carX += dx;
  carY += dy;

  // Begrenzung innerhalb des Fensters
  carX = Math.min(window.innerWidth - car.offsetWidth, Math.max(0, carX));
  carY = Math.min(window.innerHeight - car.offsetHeight, Math.max(0, carY));

  // Position und Rotation des Autos setzen

  updateCarPosition();
}

function controlLoop() {
    let changed = false;
    
    const ballToGrab = isArmOverBall();
    // Ball grabbing logic
    if (gripperOpenAmount > 0.7) {  // Gripper is open enough to grab
            if (ballToGrab) {
              possibleGrabbedBall = ballToGrab;
              ballToGrab.style.backgroundColor = 'red'; // Highlight the ball to grab
             ballToGrab.classList.remove('grabbed'); // Ensure it's not marked as grabbed
                // ballToGrab.classList.add('grabbed');
                grabbedBall = null;
            }
            else{
              possibleGrabbedBall = null; // No ball to grab
            }
    } else if (gripperOpenAmount < 0.3) {  // Gripper is closing
        if(!grabbedBall){
          if (ballToGrab && possibleGrabbedBall) {
            grabbedBall = possibleGrabbedBall;
            grabbedBall.classList.add('grabbed');
          }
        }
    }

    ballsContainer.querySelectorAll('.ball').forEach(ball => {
        if (ball !== possibleGrabbedBall) {
            ball.style.backgroundColor = 'green'; // Reset color for other balls
        } 
      });
    
    if (grabbedBall) {
        updateBallPosition();
    }

  // Armhöhe steuern mit R und F
  if (keysPressed['r']) {
    const prev = armHeight;
    armHeight = Math.max(armMin, armHeight - 0.5);
    changed ||= (prev !== armHeight);
  }
  if (keysPressed['f']) {
    const prev = armHeight;
    armHeight = Math.min(armMax, armHeight + 0.5);
    changed ||= (prev !== armHeight);
  }
  if (changed) updateArm();

  // Greifer langsam öffnen/schließen mit T und G
  if (keysPressed['t']) {
    gripperOpenAmount += 0.02; // Geschwindigkeit des Öffnens (langsamer)
    if (gripperOpenAmount > 1) gripperOpenAmount = 1;
  }
  if (keysPressed['g']) {
    gripperOpenAmount -= 0.02; // Geschwindigkeit des Schließens (langsamer)
    if (gripperOpenAmount < 0) gripperOpenAmount = 0;
  }

  updateArm();

  // Bewegung und Rotation des Autos
  ['w', 's', 'q', 'e'].forEach(key => {
    if (keysPressed[key]) moveCar(key);
  });

  // Seitwärtsbewegung mit A und D (falls benötigt)
  if (keysPressed['a']) {
    carX -= step;
    carX = Math.max(0, carX);
    car.style.left = carX + 'px';
  }
  if (keysPressed['d']) {
    carX += step;
    carX = Math.min(window.innerWidth - car.offsetWidth, carX);
    car.style.left = carX + 'px';
  }

  requestAnimationFrame(controlLoop);
}

for (let i = 0; i < 10; i++) {
    new Ball(ballsContainer);
}

// Make connectSerial and disconnectSerial globally available for buttons
window.connectSerial = connectSerial;
window.disconnectSerial = disconnectSerial;

// Event listeners
window.addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  if (['w','a','s','d','q','e','r','f','t','g'].includes(key)) {
    keysPressed[key] = true;
    e.preventDefault();
  }
});

window.addEventListener('keyup', e => {
  const key = e.key.toLowerCase();
  if (key in keysPressed) keysPressed[key] = false;
});

window.addEventListener('beforeunload', () => {
  disconnectSerial();
});

// Set initial values
car.style.left = carX + 'px';
car.style.top = carY + 'px';
car.style.transform = `rotate(${rotation}deg)`;
updateArm();

// Set initial WebSerial status
document.addEventListener('DOMContentLoaded', () => {
  updateSerialStatus();
});

// Start the control loop
controlLoop();
