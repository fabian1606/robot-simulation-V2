// Referenzen auf die Hauptelemente des Autos und Greifarms
const car = document.getElementById('car');
const arm = document.getElementById('arm');
const wrist = document.getElementById('wrist');
const fingerL = document.getElementById('fingerL');
const fingerR = document.getElementById('fingerR');

// Referenzen auf die vier Räder
const wheel1 = document.getElementById('wheel1');
const wheel2 = document.getElementById('wheel2');
const wheel3 = document.getElementById('wheel3');
const wheel4 = document.getElementById('wheel4');

// Ball functionality
const ballsContainer = document.getElementById('balls-container');
let grabbedBall = null;
let possibleGrabbedBall = null;

// Car dimensions and positioning
const carWidth = 127.804;   // 182.577 * 0.7
const carHeight = 197.087;  // 281.553 * 0.7

let carX = (window.innerWidth - carWidth) / 2;
let carY = (window.innerHeight - carHeight) / 2;
let rotation = 0;

// Separate Geschwindigkeitsvariablen
let movementSpeed = 2; // Bewegungsgeschwindigkeit
let rotationSpeed = 0.5; // Rotationsgeschwindigkeit

// Armhöhe (Steuerung des Arms)
let armHeight = 217.883;    // 311.262 * 0.7
const armMin = 14, armMax = 217.883; // 20*0.7, 311.262*0.7
let gripperOpenAmount = 0; // Öffnungsgrad des Greifers (0 = zu, 1 = maximal offen)
let keysPressed = {}; // Merkt gedrückte Tasten

// Basiswerte für Arm und Handgelenk (Positionierung)
const armBaseHeight = 217.883;       // 311.262 * 0.7
const wristBaseHeight = 53.785;      // 76.836 * 0.7
const wristBaseWidth = 59.336;       // 84.765 * 0.7
const wristOffsetY = -42.736;        // -61.051 * 0.7
const wristOffsetX = -5.431;         // -7.044 * 0.7
const fingerL_X = -31.732;           // -45.332 * 0.7
const fingerR_X = 44.672;            // 65.245 * 0.7
const fingerY = -169.867;            // -240.239 * 0.7

// WebSerial-Variablen
let port = null;
let reader = null;
let writer = null;
let serialConnected = false;
let serialBuffer = '';
let serialCommandTimers = {};

// Ball class
class Ball {
    constructor(parent) {
        this.element = document.createElement('div');
        this.element.className = 'ball';
        this.element.style.left = Math.random() * (parent.clientWidth - 80) + 'px';
        this.element.style.top = Math.random() * (parent.clientHeight - 80) + 'px';
        this.element.style.backgroundColor = "green";
        parent.appendChild(this.element);
    }
}

// Ball detection functions
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
        
        // Check if gripper tip is near the ball (increased radius for larger balls)
        if (Math.abs(gripperTipX - ballCenterX) < 50 &&
            Math.abs(gripperTipY - ballCenterY) < 50) {
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
        
        // Center the 80x80px ball on the gripper tip (40px offset for centering)
        grabbedBall.style.left = (gripperTipX - 40) + 'px';
        grabbedBall.style.top = (gripperTipY - 40) + 'px';
    }
}

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
            updateCarPosition();
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

// Hilfsfunktion: Grad in Radiant umrechnen
function degToRad(deg) {
  return deg * Math.PI / 180;
}

// Aktualisiert die Position und Darstellung des Arms und Greifers
function updateArm() {
  // 1. Der Arm wird von unten nach oben skaliert (bottom bleibt fixiert, Höhe verändert sich)
  arm.style.height = armHeight + 'px';
  arm.style.bottom = '0px';
  arm.style.top = ''; // top zurücksetzen, um Konflikte zu vermeiden

  // Berechnet die obere Kante des Arms relativ zum Auto-Container
  const armTop = carHeight - armHeight;

  // 2. Das Handgelenk folgt der Armspitze, bleibt aber in der Größe konstant
  wrist.style.left = wristOffsetX + 'px';
  wrist.style.top = (armTop + wristOffsetY) + 'px';
  wrist.style.height = wristBaseHeight + 'px';
  wrist.style.width = wristBaseWidth + 'px';

  // 3. Die Greiferfinger folgen ebenfalls der Armspitze, bleiben aber in der Größe konstant
  fingerL.style.left = fingerL_X + 'px';
  fingerL.style.top = (armTop + fingerY) + 'px';
  fingerR.style.left = fingerR_X + 'px';
  fingerR.style.top = (armTop + fingerY) + 'px';

  // 4. Animation für das Öffnen und Schließen der Greiferfinger
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


// Bewegt das Auto in die gewünschte Richtung
function moveCar(direction) {
  const rad = degToRad(rotation);
  let dx = 0, dy = 0;

  switch (direction) {
    case 'w': // vorwärts
      dx = Math.sin(rad) * movementSpeed;
      dy = -Math.cos(rad) * movementSpeed;
      break;
    case 's': // rückwärts
      dx = -Math.sin(rad) * movementSpeed;
      dy = Math.cos(rad) * movementSpeed;
      break;
    case 'a': // links seitlich (relativ zur Roboterausrichtung)
      dx = -Math.cos(rad) * movementSpeed;
      dy = -Math.sin(rad) * movementSpeed;
      break;
    case 'd': // rechts seitlich (relativ zur Roboterausrichtung)
      dx = Math.cos(rad) * movementSpeed;
      dy = Math.sin(rad) * movementSpeed;
      break;
    case 'q': // links drehen - nur Rotation
      rotation -= rotationSpeed;
      dx = 0;
      dy = 0;
      break;
    case 'e': // rechts drehen - nur Rotation
      rotation += rotationSpeed;
      dx = 0;
      dy = 0;
      break;
  }

  carX += dx;
  carY += dy;

  // Begrenzung innerhalb des Fensters
  carX = Math.min(window.innerWidth - carWidth, Math.max(0, carX));
  carY = Math.min(window.innerHeight - carHeight, Math.max(0, carY));

  // Position und Rotation des Autos setzen
  updateCarPosition();
}

// Hauptsteuerungsschleife: prüft gedrückte Tasten und aktualisiert Positionen/Animationen
function controlLoop() {
    let changed = false;
    
    const ballToGrab = isArmOverBall();
    
    // Ball grabbing logic
    if (gripperOpenAmount > 0.7) {  // Gripper is open enough to grab
        if (ballToGrab) {
            possibleGrabbedBall = ballToGrab;
            ballToGrab.style.backgroundColor = 'red'; // Highlight the ball to grab
            ballToGrab.classList.remove('grabbed'); // Ensure it's not marked as grabbed
            grabbedBall = null;
        } else {
            possibleGrabbedBall = null; // No ball to grab
        }
    } else if (gripperOpenAmount < 0.3) {  // Gripper is closing
        if (!grabbedBall) {
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

    // Bewegung und Rotation des Autos (inkl. Seitwärtsbewegung)
    ['w', 's', 'a', 'd', 'q', 'e'].forEach(key => {
        if (keysPressed[key]) moveCar(key);
    });

    requestAnimationFrame(controlLoop);
}

// Create balls
for (let i = 0; i < 3; i++) {
    new Ball(ballsContainer);
}

// Make connectSerial and disconnectSerial globally available for buttons
window.connectSerial = connectSerial;
window.disconnectSerial = disconnectSerial;

// Tastendruck-Handler: merkt gedrückte Steuerungstasten
document.addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  if (['w','a','s','d','q','e','r','f','t','g'].includes(key)) {
    keysPressed[key] = true;
    e.preventDefault();
    console.log('Key pressed:', key); // Debug output
  }
});

// Tastenloslassen-Handler: setzt gedrückte Tasten zurück
document.addEventListener('keyup', e => {
  const key = e.key.toLowerCase();
  if (['w','a','s','d','q','e','r','f','t','g'].includes(key)) {
    keysPressed[key] = false;
    console.log('Key released:', key); // Debug output
  }
});

// Geschwindigkeitssteuerung mit Slidern
function updateSpeedControls() {
  const movementSlider = document.getElementById('movementSpeed');
  const rotationSlider = document.getElementById('rotationSpeed');
  const movementSpeedValue = document.getElementById('movementSpeedValue');
  const rotationSpeedValue = document.getElementById('rotationSpeedValue');

  if (movementSlider) {
    movementSlider.addEventListener('input', (e) => {
      movementSpeed = parseFloat(e.target.value);
      if (movementSpeedValue) {
        movementSpeedValue.textContent = movementSpeed;
      }
    });
  }

  if (rotationSlider) {
    rotationSlider.addEventListener('input', (e) => {
      rotationSpeed = parseFloat(e.target.value);
      if (rotationSpeedValue) {
        rotationSpeedValue.textContent = rotationSpeed;
      }
    });
  }
}

// Ensure the page can receive focus for keyboard events
document.addEventListener('DOMContentLoaded', () => {
  document.body.tabIndex = 0;
  document.body.focus();
  console.log('Robot simulation loaded - keyboard controls ready');
  updateSerialStatus();
  updateSpeedControls();
});

window.addEventListener('beforeunload', () => {
  disconnectSerial();
});

// Zentriert das Auto beim Start im Fenster
function centerCar() {
  carX = (window.innerWidth - carWidth) / 2;
  carY = (window.innerHeight - carHeight) / 2;
  car.style.left = carX + 'px';
  car.style.top = carY + 'px';
  car.style.transform = `rotate(${rotation}deg)`;
}

// Initialisierung: Auto zentrieren, Arm und Räder setzen, Steuerung und Animation starten
centerCar();
updateArm();
controlLoop();
controlLoop();
