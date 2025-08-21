// Real-time data service for providing current time, location, and weather information

export interface RealTimeData {
  currentTime: string;
  timezone: string;
  location?: {
    city: string;
    country: string;
    timezone?: string;
    coordinates?: {
      lat: number;
      lon: number;
    };
  };
  weather?: {
    temperature: number;
    description: string;
    humidity: number;
    windSpeed: number;
  };
}

export async function getCurrentTime(userTimezone?: string): Promise<{currentTime: string, timezone: string}> {
  const now = new Date();
  const timezone = userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  const currentTime = now.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
    timeZoneName: 'short'
  });
  
  return {
    currentTime,
    timezone
  };
}

export async function getLocationInfo(ip?: string): Promise<{city: string, country: string, timezone: string, coordinates?: {lat: number, lon: number}} | null> {
  try {
    // Using ip-api.com for IP geolocation (free, no API key required)
    const response = await fetch(`http://ip-api.com/json/${ip || ''}?fields=status,country,city,lat,lon,timezone`);
    const data = await response.json();
    
    if (data.status === 'success') {
      return {
        city: data.city,
        country: data.country,
        timezone: data.timezone,
        coordinates: {
          lat: data.lat,
          lon: data.lon
        }
      };
    }
  } catch (error) {
    console.error("Location lookup error:", error);
  }
  
  return null;
}

export async function getWeatherInfo(lat: number, lon: number): Promise<{temperature: number, description: string, humidity: number, windSpeed: number} | null> {
  try {
    // Using OpenWeatherMap API - in production you'd need an API key
    // For demo purposes, we'll use a mock weather service or try the free tier
    
    // Try wttr.in as a free weather service
    const response = await fetch(`https://wttr.in/${lat},${lon}?format=j1`, {
      headers: {
        'User-Agent': 'SaiKaki-Bot/1.0'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      const current = data.current_condition[0];
      
      return {
        temperature: parseInt(current.temp_C),
        description: current.weatherDesc[0].value,
        humidity: parseInt(current.humidity),
        windSpeed: parseInt(current.windspeedKmph)
      };
    }
  } catch (error) {
    console.error("Weather lookup error:", error);
  }
  
  return null;
}

export async function getRealTimeData(userIP?: string, userLat?: number, userLon?: number): Promise<RealTimeData> {
  let locationData = null;
  let weatherData = null;
  
  // If user provided coordinates, use them for more accurate data
  if (userLat && userLon) {
    try {
      // Try to get timezone from coordinates using TimeZoneDB API (free tier)
      // As fallback, we'll use user's browser timezone
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      locationData = {
        city: 'Your precise location',
        country: 'Based on GPS',
        timezone: userTimezone,
        coordinates: { lat: userLat, lon: userLon }
      };
      
      weatherData = await getWeatherInfo(userLat, userLon);
    } catch (error) {
      console.error("Coordinate-based location error:", error);
    }
  } else {
    // Fall back to IP-based location
    locationData = await getLocationInfo(userIP);
    if (locationData && locationData.coordinates) {
      weatherData = await getWeatherInfo(locationData.coordinates.lat, locationData.coordinates.lon);
    }
  }
  
  const timezone = locationData?.timezone || 'UTC';
  const timeData = await getCurrentTime(timezone);
  
  return {
    currentTime: timeData.currentTime,
    timezone: timeData.timezone,
    location: locationData || undefined,
    weather: weatherData || undefined
  };
}

export function formatRealTimeDataForAI(data: RealTimeData): string {
  let formatted = `*Real-time info:*\n`;
  formatted += `🕐 Current time: ${data.currentTime}\n`;
  
  if (data.location) {
    formatted += `📍 Location: ${data.location.city}, ${data.location.country}\n`;
  }
  
  if (data.weather) {
    formatted += `🌡️ Weather: ${data.weather.temperature}°C, ${data.weather.description}\n`;
    formatted += `💧 Humidity: ${data.weather.humidity}%\n`;
    formatted += `💨 Wind: ${data.weather.windSpeed} km/h\n`;
  }
  
  return formatted;
}