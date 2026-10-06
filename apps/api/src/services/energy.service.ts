// @ts-ignore
import fetch from 'node-fetch';

export class EnergyEngine {
  private static WEATHER_API_URL = 'https://api.openweathermap.org/data/2.5/forecast';
  private static API_KEY = process.env.WEATHER_API_KEY || 'demo_key'; // Replace with real key

  static start() {
    setInterval(async () => {
      try {
        console.log('⚡ Energy Grid & Solar Optimization Engine running...');
        
        // This simulates a call to a Weather API to get cloud coverage for tomorrow
        // if (this.API_KEY !== 'demo_key') {
        //   const res = await fetch(`${this.WEATHER_API_URL}?lat=24.7136&lon=46.6753&appid=${this.API_KEY}`);
        //   const data = await res.json();
        // }

        // Mock optimization logic:
        const tomorrowForecast = 'CLOUDY'; // 'SUNNY' or 'CLOUDY'
        
        if (tomorrowForecast === 'CLOUDY') {
          console.log('⚡ Forecast is CLOUDY. Instructing house battery to charge from the grid tonight during off-peak hours.');
          // Emit MQTT command to battery inverter
          // server.mqtt.publish('mosa/energy/inverter/command', JSON.stringify({ action: 'CHARGE_FROM_GRID' }));
        } else {
          console.log('⚡ Forecast is SUNNY. Battery will rely on solar panels tomorrow. Saving grid money.');
        }

      } catch (e) {
        console.error('Energy Engine error:', e);
      }
    }, 12 * 60 * 60 * 1000); // Run every 12 hours

    console.log('⚡ Energy Engine started');
  }
}
