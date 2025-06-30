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

// Neue Wertebereiche für die Steuerung
let xValue = 0;        // Vorwärts/Rückwärts: -2047 bis 2047
let yValue = 0;        // Seitwärts: -2047 bis 2047  
let rotationValue = 0; // Rotation: -2047 bis 2047
let gripperSpeed = 0;  // Greifer Geschwindigkeit: -2047 bis 2047
let armPosition = 2047; // Arm Position: 0 bis 4095 (absolut)

// Umrechnung der Armposition in Pixelwerte
const armMin = 14, armMax = 217.883; // 20*0.7, 311.262*0.7
let armHeight = armMax; // Startwert auf Maximum
let gripperOpenAmount = 0; // Öffnungsgrad des Greifers (0 = zu, 1 = maximal offen)

// Geschwindigkeitsskalierung
const movementSpeedScale = 0.005; // Skalierungsfaktor für Bewegung
const rotationSpeedScale = 0.0005; // Skalierungsfaktor für Rotation
const gripperSpeedScale = 0.0001; // Skalierungsfaktor für Greifer (angepasst für neue Wertebereiche)

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
        const data = line.trim();
        if (data.length > 0) {
          parseSerialCommand(data);
        }
      }
      
      // Auch einzelne Befehle ohne Zeilenumbruch verarbeiten
      if (serialBuffer.length > 0) {
        const data = serialBuffer.trim();
        if (data.includes(':') || /^[A-Z]:\d+/.test(data)) {
          parseSerialCommand(data);
          serialBuffer = ''; // Buffer leeren nach Verarbeitung
        }
      }
    }
  } catch (error) {
    console.error('Fehler beim Lesen:', error);
    serialConnected = false;
  }
}

function parseSerialCommand(data) {
  console.log('Empfangen:', data);
  
  // Format: X:1234 für X-Wert, Y:-567 für Y-Wert, etc.
  if (data.includes(':')) {
    const [command, valueStr] = data.split(':');
    const value = parseInt(valueStr);
    
    if (!isNaN(value)) {
      switch (command.toUpperCase()) {
        case 'X':
          // X-Wert (Vorwärts/Rückwärts): -2047 bis 2047
          xValue = Math.max(-2047, Math.min(2047, value));
          updateSliderAndDisplay('xValue', 'xValueDisplay', xValue);
          console.log('X-Wert gesetzt:', xValue);
          break;
        case 'Y':
          // Y-Wert (Seitwärts): -2047 bis 2047
          yValue = Math.max(-2047, Math.min(2047, value));
          updateSliderAndDisplay('yValue', 'yValueDisplay', yValue);
          console.log('Y-Wert gesetzt:', yValue);
          break;
        case 'R':
          // Rotation: -2047 bis 2047
          rotationValue = Math.max(-2047, Math.min(2047, value));
          updateSliderAndDisplay('rotationValue', 'rotationValueDisplay', rotationValue);
          console.log('Rotation gesetzt:', rotationValue);
          break;
        case 'G':
          // Greifer Speed: -2047 bis 2047
          gripperSpeed = Math.max(-2047, Math.min(2047, value));
          updateSliderAndDisplay('gripperSpeed', 'gripperSpeedDisplay', gripperSpeed);
          console.log('Greifer Speed gesetzt:', gripperSpeed);
          break;
        case 'A':
          // Arm Position: 0 bis 4095
          armPosition = Math.max(0, Math.min(4095, value));
          updateSliderAndDisplay('armPosition', 'armPositionDisplay', armPosition);
          console.log('Arm Position gesetzt:', armPosition);
          break;
        default:
          console.log('Unbekannter Befehl:', command);
      }
    }
  }
}

function updateSliderAndDisplay(sliderId, displayId, value) {
  const slider = document.getElementById(sliderId);
  const display = document.getElementById(displayId);
  
  if (slider) slider.value = value;
  if (display) display.textContent = value;
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


// Bewegt das Auto basierend auf den numerischen Werten
function updateCarMovement() {
  const rad = degToRad(rotation);
  
  // Berechnung der Bewegungsgeschwindigkeit basierend auf x und y Werten
  const forwardSpeed = xValue * movementSpeedScale; // Vorwärts/Rückwärts
  const sideSpeed = yValue * movementSpeedScale;    // Seitwärts
  
  // Berechnung der Bewegungsrichtung relativ zur Roboterausrichtung
  let dx = 0, dy = 0;
  
  // Vorwärts/Rückwärts Bewegung (relativ zur Roboterausrichtung)
  dx += Math.sin(rad) * forwardSpeed;
  dy += -Math.cos(rad) * forwardSpeed;
  
  // Seitwärts Bewegung (relativ zur Roboterausrichtung)
  dx += Math.cos(rad) * sideSpeed;
  dy += Math.sin(rad) * sideSpeed;
  
  // Position aktualisieren
  carX += dx;
  carY += dy;
  
  // Rotation aktualisieren
  rotation += rotationValue * rotationSpeedScale;

  // Begrenzung innerhalb des Fensters
  carX = Math.min(window.innerWidth - carWidth, Math.max(0, carX));
  carY = Math.min(window.innerHeight - carHeight, Math.max(0, carY));

  // Position und Rotation des Autos setzen
  updateCarPosition();
}

// Aktualisiert die Armposition basierend auf dem absoluten Wert
function updateArmPosition() {
  // Umrechnung von 0-4095 auf den Pixelbereich armMin-armMax
  const normalizedPosition = armPosition / 4095; // 0-1
  armHeight = armMin + (armMax - armMin) * normalizedPosition;
  updateArm();
}

// Aktualisiert den Greifer basierend auf der Geschwindigkeit
function updateGripperMovement() {
  // Greifer Geschwindigkeit anwenden
  gripperOpenAmount += gripperSpeed * gripperSpeedScale;
  
  // Begrenzung zwischen 0 und 1
  gripperOpenAmount = Math.max(0, Math.min(1, gripperOpenAmount));
}

// Hauptsteuerungsschleife: arbeitet mit numerischen Werten
function controlLoop() {
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

    // Neue wertbasierte Steuerung
    updateCarMovement();        // Auto-Bewegung basierend auf xValue, yValue, rotationValue
    updateArmPosition();        // Arm-Position basierend auf armPosition
    updateGripperMovement();    // Greifer basierend auf gripperSpeed
    updateArm();               // Arm-Darstellung aktualisieren

    requestAnimationFrame(controlLoop);
}

// Create balls
for (let i = 0; i < 3; i++) {
    new Ball(ballsContainer);
}

// Make connectSerial and disconnectSerial globally available for buttons
window.connectSerial = connectSerial;
window.disconnectSerial = disconnectSerial;

// Tastatur-Steuerung ist nicht mehr aktiv - nur noch numerische Werte werden verwendet
// Die Tastatur-Events bleiben für Kompatibilität, werden aber nicht mehr genutzt

// Neue numerische Steuerung mit Slidern
function updateControls() {
  // X-Wert (Vorwärts/Rückwärts)
  const xSlider = document.getElementById('xValue');
  const xDisplay = document.getElementById('xValueDisplay');
  if (xSlider) {
    xSlider.addEventListener('input', (e) => {
      xValue = parseInt(e.target.value);
      if (xDisplay) xDisplay.textContent = xValue;
    });
  }

  // Y-Wert (Seitwärts)
  const ySlider = document.getElementById('yValue');
  const yDisplay = document.getElementById('yValueDisplay');
  if (ySlider) {
    ySlider.addEventListener('input', (e) => {
      yValue = parseInt(e.target.value);
      if (yDisplay) yDisplay.textContent = yValue;
    });
  }

  // Rotation
  const rotationSlider = document.getElementById('rotationValue');
  const rotationDisplay = document.getElementById('rotationValueDisplay');
  if (rotationSlider) {
    rotationSlider.addEventListener('input', (e) => {
      rotationValue = parseInt(e.target.value);
      if (rotationDisplay) rotationDisplay.textContent = rotationValue;
    });
  }

  // Greifer Speed
  const gripperSlider = document.getElementById('gripperSpeed');
  const gripperDisplay = document.getElementById('gripperSpeedDisplay');
  if (gripperSlider) {
    gripperSlider.addEventListener('input', (e) => {
      gripperSpeed = parseInt(e.target.value);
      if (gripperDisplay) gripperDisplay.textContent = gripperSpeed;
    });
  }

  // Arm Position
  const armSlider = document.getElementById('armPosition');
  const armDisplay = document.getElementById('armPositionDisplay');
  if (armSlider) {
    armSlider.addEventListener('input', (e) => {
      armPosition = parseInt(e.target.value);
      if (armDisplay) armDisplay.textContent = armPosition;
    });
  }
}

// Reset-Funktionen für einzelne Werte
function resetX() {
  xValue = 0;
  const slider = document.getElementById('xValue');
  const display = document.getElementById('xValueDisplay');
  if (slider) slider.value = 0;
  if (display) display.textContent = 0;
}

function resetY() {
  yValue = 0;
  const slider = document.getElementById('yValue');
  const display = document.getElementById('yValueDisplay');
  if (slider) slider.value = 0;
  if (display) display.textContent = 0;
}

function resetRotation() {
  rotationValue = 0;
  const slider = document.getElementById('rotationValue');
  const display = document.getElementById('rotationValueDisplay');
  if (slider) slider.value = 0;
  if (display) display.textContent = 0;
}

function resetGripperSpeed() {
  gripperSpeed = 0;
  const slider = document.getElementById('gripperSpeed');
  const display = document.getElementById('gripperSpeedDisplay');
  if (slider) slider.value = 0;
  if (display) display.textContent = 0;
}

function resetAllValues() {
  resetX();
  resetY();
  resetRotation();
  resetGripperSpeed();
  
  // Arm Position zurück zur Mitte
  armPosition = 2047;
  const armSlider = document.getElementById('armPosition');
  const armDisplay = document.getElementById('armPositionDisplay');
  if (armSlider) armSlider.value = 2047;
  if (armDisplay) armDisplay.textContent = 2047;
}

// Globale Reset-Funktionen verfügbar machen
window.resetX = resetX;
window.resetY = resetY;
window.resetRotation = resetRotation;
window.resetGripperSpeed = resetGripperSpeed;
window.resetAllValues = resetAllValues;

// Ensure the page can receive focus for keyboard events
document.addEventListener('DOMContentLoaded', () => {
  document.body.tabIndex = 0;
  document.body.focus();
  console.log('Robot simulation loaded - numerical controls ready');
  updateSerialStatus();
  updateControls();
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
