/*
 * Einfaches Beispiel mit nur einem Button
 * Sendet 'w' (vorwärts) solange der Button gedrückt wird
 */

const int BUTTON_PIN = 2;  // Button an Pin 2
const unsigned long SEND_INTERVAL = 50; // Alle 50ms senden
unsigned long lastSendTime = 0;

void setup() {
  Serial.begin(9600);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  Serial.println("Einfacher Robot Controller bereit!");
}

void loop() {
  unsigned long currentTime = millis();
  
  // Nur alle SEND_INTERVAL Millisekunden senden
  if (currentTime - lastSendTime >= SEND_INTERVAL) {
    
    // Button prüfen (LOW = gedrückt wegen INPUT_PULLUP)
    if (digitalRead(BUTTON_PIN) == LOW) {
      Serial.print("w"); // Vorwärts fahren
    }
    
    lastSendTime = currentTime;
  }
  
  delay(1);
}

/*
 * Verdrahtung:
 * Button -> Pin 2 -> GND
 * 
 * Kein Pull-up Widerstand nötig, da INPUT_PULLUP verwendet wird
 */
