/*
 * Robot Simulator WebSerial Controller
 * Sendet kontinuierlich Befehle an den Browser während Buttons gedrückt werden
 */

// Pin-Definitionen für Buttons
const int BUTTON_FORWARD = 11;   // w - Vorwärts
const int BUTTON_BACKWARD = 10;  // s - Rückwärts
const int BUTTON_LEFT = 9;      // a - Links
const int BUTTON_RIGHT = 8;     // d - Rechts
const int BUTTON_TURN_LEFT = 7; // q - Links drehen
const int BUTTON_TURN_RIGHT = 6;// e - Rechts drehen
const int BUTTON_ARM_UP = 5;    // r - Arm heben
const int BUTTON_ARM_DOWN = 4;  // f - Arm senken
const int BUTTON_GRIP_OPEN = 3;// t - Greifer öffnen
const int BUTTON_GRIP_CLOSE = 2;// g - Greifer schließen

// Timing für kontinuierliche Befehle
const unsigned long SEND_INTERVAL = 50; // Alle 50ms senden (20 Hz)
unsigned long lastSendTime = 0;

void setup() {
  Serial.begin(9600);
  
  // Alle Button-Pins als Input mit Pull-up Widerstand
  pinMode(BUTTON_FORWARD, INPUT_PULLUP);
  pinMode(BUTTON_BACKWARD, INPUT_PULLUP);
  pinMode(BUTTON_LEFT, INPUT_PULLUP);
  pinMode(BUTTON_RIGHT, INPUT_PULLUP);
  pinMode(BUTTON_TURN_LEFT, INPUT_PULLUP);
  pinMode(BUTTON_TURN_RIGHT, INPUT_PULLUP);
  pinMode(BUTTON_ARM_UP, INPUT_PULLUP);
  pinMode(BUTTON_ARM_DOWN, INPUT_PULLUP);
  pinMode(BUTTON_GRIP_OPEN, INPUT_PULLUP);
  pinMode(BUTTON_GRIP_CLOSE, INPUT_PULLUP);
  
  Serial.println("Robot Controller bereit!");
}

void loop() {
  unsigned long currentTime = millis();
  
  // Nur alle SEND_INTERVAL Millisekunden senden
  if (currentTime - lastSendTime >= SEND_INTERVAL) {
    
    // Alle Buttons prüfen und entsprechende Befehle senden
    if (digitalRead(BUTTON_FORWARD) == LOW) {
      Serial.print("w");
    }
    if (digitalRead(BUTTON_BACKWARD) == LOW) {
      Serial.print("s");
    }
    if (digitalRead(BUTTON_LEFT) == LOW) {
      Serial.print("a");
    }
    if (digitalRead(BUTTON_RIGHT) == LOW) {
      Serial.print("d");
    }
    if (digitalRead(BUTTON_TURN_LEFT) == LOW) {
      Serial.print("q");
    }
    if (digitalRead(BUTTON_TURN_RIGHT) == LOW) {
      Serial.print("e");
    }
    if (digitalRead(BUTTON_ARM_UP) == LOW) {
      Serial.print("r");
    }
    if (digitalRead(BUTTON_ARM_DOWN) == LOW) {
      Serial.print("f");
    }
    if (digitalRead(BUTTON_GRIP_OPEN) == LOW) {
      Serial.print("t");
    }
    if (digitalRead(BUTTON_GRIP_CLOSE) == LOW) {
      Serial.print("g");
    }
    
    lastSendTime = currentTime;
  }
  
  // Kurze Pause für Stabilität
  delay(1);
}

/*
 * Verdrahtung:
 * 
 * Button Vorwärts    -> Pin 2  -> GND
 * Button Rückwärts   -> Pin 3  -> GND
 * Button Links       -> Pin 4  -> GND
 * Button Rechts      -> Pin 5  -> GND
 * Button Links drehen-> Pin 6  -> GND
 * Button Rechts drehen->Pin 7  -> GND
 * Button Arm heben   -> Pin 8  -> GND
 * Button Arm senken  -> Pin 9  -> GND
 * Button Greifer auf -> Pin 10 -> GND
 * Button Greifer zu  -> Pin 11 -> GND
 * 
 * Hinweis: INPUT_PULLUP verwendet interne Pull-up Widerstände,
 * daher müssen die Buttons zwischen Pin und GND geschaltet werden.
 * Button gedrückt = LOW, Button nicht gedrückt = HIGH
 */
