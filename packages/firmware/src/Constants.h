#pragma once

// Timing Constants
#define WS_MAX_AUTH_FAILS        5
#define WS_AUTH_LOCKOUT_MS       60000UL
#define PIR_DEBOUNCE_MS          5000UL
#define PIR_AUTO_OFF_MS          120000UL
#define WIFI_WATCHDOG_MS         600000UL
#define WIFI_AP_FALLBACK_MS      120000UL
#define WIFI_BACKOFF_MAX_MS      60000UL
#define MQTT_BACKOFF_MAX_MS      60000UL
#define MQTT_HEARTBEAT_MS        30000UL
#define COMPRESSOR_DELAY_MS      180000UL
#define SENSOR_INTERVAL_MS       60000UL
#define BROADCAST_THROTTLE_MS    500UL
#define FLUSH_INTERVAL_MS        10000UL
#define DISPLAY_PAGE_MS          5000UL
#define DISPLAY_SLEEP_MS         300000UL
#define SWITCH_DEBOUNCE_MS       12UL
#define SWITCH_REFRACTORY_MS     75UL
#define STAGGER_DELAY_MS         200UL
#define KWH_SAVE_INTERVAL_MS     3600000UL

// Safety Limits  
#define MAX_DEVICES              32
#define MAX_SCENES               10
#define MAX_WIFI_NETWORKS        3
#define MAX_JSON_SIZE            8192
#define MAX_PAYLOAD_SIZE         4096
#define MIN_FREE_HEAP_BYTES      8192
#define MAX_CURRENT_AMPS         20.0f
#define MAX_POWER_WATTS          4400.0f
#define TEMP_MIN_C               -40.0f
#define TEMP_MAX_C               80.0f
#define HUMIDITY_MIN_PCT         0.0f
#define HUMIDITY_MAX_PCT         100.0f

// GPIO Validation
#define GPIO_STRAPPING_PINS      {0, 3, 45, 46}
#define GPIO_USB_PINS            {19, 20}
#define GPIO_FLASH_PINS_START    26
#define GPIO_FLASH_PINS_END      37
#define GPIO_CLASSIC_FLASH_START 6
#define GPIO_CLASSIC_FLASH_END   11
