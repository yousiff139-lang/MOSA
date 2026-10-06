
#ifndef AUDIO_ENGINE_H
#define AUDIO_ENGINE_H

#include <Arduino.h>

class AudioEngine {
public:
    static void init();
    static void loop();
private:
    static void recordAndStream();
    static bool detectWakeWord();
};

#endif
