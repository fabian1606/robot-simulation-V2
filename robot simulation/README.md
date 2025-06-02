# Robot Simulator mit WebSerial-Steuerung

Dieser Robot-Simulator kann sowohl über die Tastatur als auch über eine serielle Verbindung (WebSerial API) gesteuert werden.

## Steuerungsbefehle

Die folgenden Buchstaben können sowohl über die Tastatur als auch über die serielle Verbindung gesendet werden:

### Fahrzeugbewegung:
- `w` - Vorwärts fahren
- `s` - Rückwärts fahren  
- `a` - Seitlich nach links
- `d` - Seitlich nach rechts
- `q` - Nach links drehen
- `e` - Nach rechts drehen

### Armsteuerung:
- `r` - Arm heben
- `f` - Arm senken
- `t` - Greifer öffnen
- `g` - Greifer schließen

## WebSerial-Verwendung

### Voraussetzungen:
- Chrome/Edge Browser (WebSerial API wird benötigt)
- Serielles Gerät (Arduino, ESP32, etc.)

### Verbindung herstellen:
1. Klicken Sie auf "Verbinden" im Info-Panel
2. Wählen Sie das gewünschte serielle Gerät aus
3. Die Verbindung wird mit 9600 Baud hergestellt

### Serielles Protokoll:
- Baudrate: 9600
- Datenbits: 8
- Stoppbits: 1  
- Parität: Keine
- Kommandos: Einzelne Buchstaben (w,a,s,d,q,e,r,f,t,g)
- **Kontinuierliche Steuerung**: Senden Sie den gleichen Buchstaben wiederholt (z.B. alle 50ms) für kontinuierliche Bewegung
- Zeilenende: `\n` (Optional)

### Arduino-Beispiele:

Das Repository enthält zwei Arduino-Beispiele:

1. **`simple_arduino_example.ino`** - Einfaches Beispiel mit einem Button
2. **`arduino_example.ino`** - Vollständiges Beispiel mit allen Steuerungstasten

#### Einfaches Beispiel (Ein Button):
```cpp
const int BUTTON_PIN = 2;
const unsigned long SEND_INTERVAL = 50; // Alle 50ms senden

void setup() {
  Serial.begin(9600);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
}

void loop() {
  if (millis() % SEND_INTERVAL == 0) {
    if (digitalRead(BUTTON_PIN) == LOW) {
      Serial.print("w"); // Vorwärts fahren
    }
  }
  delay(1);
}
```

**Verdrahtung**: Button zwischen Pin 2 und GND

## Browser-Kompatibilität

WebSerial wird nur von folgenden Browsern unterstützt:
- Chrome 89+
- Edge 89+
- Opera 76+

Firefox und Safari unterstützen WebSerial derzeit nicht.

## Sicherheitshinweise

- WebSerial erfordert eine sichere Verbindung (HTTPS oder localhost)
- Der Benutzer muss die Verbindung explizit autorisieren
- Die Seite zeigt den Verbindungsstatus an

## Fehlerbehebung

- **"WebSerial nicht unterstützt"**: Verwenden Sie Chrome oder Edge
- **Gerät nicht gefunden**: Stellen Sie sicher, dass das Gerät angeschlossen und verfügbar ist
- **Verbindung fehlgeschlagen**: Überprüfen Sie, ob das Gerät bereits von einer anderen Anwendung verwendet wird
