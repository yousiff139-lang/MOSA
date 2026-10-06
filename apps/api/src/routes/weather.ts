import { FastifyInstance } from 'fastify';
import { verifyTenant } from '../lib/permissions';
import { prisma } from '../lib/prisma';

export default async function weatherRoutes(server: FastifyInstance) {
  server.addHook('preHandler', verifyTenant);

  const getWeatherForHome = async (user: any) => {
    let lat = 33.3152;
    let lon = 44.3661;
    let cityName = 'بغداد';

    if (user?.activeHomeId) {
      const home = await prisma.home.findUnique({
        where: { id: user.activeHomeId }
      });
      if (home && (home as any).latitude && (home as any).longitude) {
        lat = Number((home as any).latitude);
        lon = Number((home as any).longitude);
        cityName = home.name || cityName;
      }
    }

    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch weather');
    }

    const data = await response.json();
    return {
      city: cityName,
      temperature: data.current.temperature_2m,
      humidity: data.current.relative_humidity_2m,
      wind_speed: data.current.wind_speed_10m,
      precipitation: data.current.precipitation,
      description: 'متاح',
      isDay: data.current.is_day,
    };
  };

  server.get('/', async (req, reply) => {
    try {
      const weatherData = await getWeatherForHome(req.user);
      return reply.send(weatherData);
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Failed to retrieve weather data' });
    }
  });

  server.get('/current', async (req, reply) => {
    try {
      const weatherData = await getWeatherForHome(req.user);
      return reply.send(weatherData);
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Failed to retrieve weather data' });
    }
  });
}
