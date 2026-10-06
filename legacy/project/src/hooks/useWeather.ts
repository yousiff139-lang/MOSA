import { useState, useEffect } from 'react';

interface WeatherData {
  temp: number;
  condition: 'clear' | 'cloudy' | 'rain' | 'snow' | 'thunderstorm' | 'unknown';
}

export function useWeather(lat: number = 24.7136, lon: number = 46.6753) {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await response.json();
        const code = data.current_weather.weathercode;
        let condition: WeatherData['condition'] = 'unknown';
        
        if (code === 0) condition = 'clear';
        else if (code >= 1 && code <= 3) condition = 'cloudy';
        else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) condition = 'rain';
        else if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) condition = 'snow';
        else if (code >= 95 && code <= 99) condition = 'thunderstorm';

        setWeather({
          temp: data.current_weather.temperature,
          condition
        });
      } catch (err) {
        console.error("Failed to fetch weather", err);
      }
    };

    fetchWeather();
    // Update every 30 minutes
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [lat, lon]);

  return weather;
}
