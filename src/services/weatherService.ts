import * as Location from 'expo-location';
import {
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  CloudDrizzle,
  CloudLightning,
  CloudFog,
  Snowflake,
} from 'lucide-react-native';
import { storage } from '../utils/queryPersister';

export const CACHE_KEY_PAYLOAD = 'cached_weather_payload_v2';
export const CACHE_KEY_LEGACY = 'cached_weather';
export const CACHE_KEY_TIME = 'cached_weather_time';
export const WEATHER_CACHE_TTL_MS = 1800000; // 30 mins (1,800,000 ms)

export interface DailyForecast {
  day: string;
  dateLabel: string;
  code: number;
  tempMax: number;
  tempMin: number;
  precipSum: number;
  rainChanceMax: number;
  windMax: number;
}

export interface HourlyRainSlot {
  hour: string;
  prob: number;
  code: number;
  temp: number;
}

export interface StormAlert {
  level: 'WATCH' | 'WARNING' | 'SEVERE';
  message: string;
}

export interface WeatherInfo {
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  code: number;
  label: string;
  locationName: string;
  lastUpdated?: string;
  rainChance?: number;
  rainTime?: string;
  dailyForecast: DailyForecast[];
  hourlyRain: HourlyRainSlot[];
  stormAlert: StormAlert | null;
}

export interface WeatherSnapshot {
  temp: number;
  tempStr: string;
  rainChance?: number;
  rainStr?: string;
  code: number;
  label: string;
  locationName: string;
  isFresh: boolean;
  lastUpdated?: string;
}

export let memoryWeatherCache: WeatherSnapshot | null = null;

type WeatherSubscriber = (weather: WeatherInfo) => void;
const subscribers = new Set<WeatherSubscriber>();

export function subscribeToWeatherUpdates(cb: (weather: WeatherInfo) => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

function notifySubscribers(weather: WeatherInfo) {
  subscribers.forEach((cb) => {
    try {
      cb(weather);
    } catch (err) {
      console.error('[weatherService] Subscriber error:', err);
    }
  });
}

// Weather Code mapping helper
export function getWeatherDetails(code: number) {
  if (code === 0) return { label: 'Clear Sky', icon: Sun, color: '#fbbf24' };
  if ([1, 2, 3].includes(code)) return { label: 'Partly Cloudy', icon: CloudSun, color: '#38bdf8' };
  if ([45, 48].includes(code)) return { label: 'Foggy', icon: CloudFog, color: '#94a3b8' };
  if ([51, 53, 55].includes(code)) return { label: 'Drizzle', icon: CloudDrizzle, color: '#7dd3fc' };
  if ([61, 63, 65, 80, 81, 82].includes(code)) return { label: 'Rainy', icon: CloudRain, color: '#3b82f6' };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: 'Snowy', icon: Snowflake, color: '#c7d2fe' };
  if ([95, 96, 99].includes(code)) return { label: 'Thunderstorm', icon: CloudLightning, color: '#a855f7' };
  return { label: 'Cloudy', icon: Cloud, color: '#64748b' };
}

export function getRainChanceColor(chance: number): string {
  if (chance >= 60) return '#ef4444';
  if (chance >= 30) return '#fbbf24';
  return '#10b981';
}

export function getRainBarColor(chance: number): string {
  if (chance >= 60) return '#ef4444';
  if (chance >= 30) return '#fbbf24';
  return '#60a5fa';
}

// Helper to parse YYYY-MM-DD date as local midnight to avoid UTC offset shifting
export function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date(dateStr);
}

export function generateFallbackDailyForecast(): DailyForecast[] {
  const now = new Date();
  const days: DailyForecast[] = [];
  const codes = [2, 1, 61, 3, 0, 1, 2];
  const maxTemps = [31, 32, 29, 30, 33, 31, 30];
  const minTemps = [25, 25, 24, 24, 26, 25, 24];
  const rainMax = [40, 20, 70, 30, 10, 25, 35];

  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    days.push({
      day: i === 0 ? 'Today' : d.toLocaleDateString([], { weekday: 'short' }),
      dateLabel: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      code: codes[i % codes.length],
      tempMax: maxTemps[i % maxTemps.length],
      tempMin: minTemps[i % minTemps.length],
      precipSum: i === 2 ? 12.5 : 0,
      rainChanceMax: rainMax[i % rainMax.length],
      windMax: 12 + (i % 5),
    });
  }
  return days;
}

export function generateFallbackHourlyRain(): HourlyRainSlot[] {
  const now = new Date();
  const slots: HourlyRainSlot[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getTime() + i * 3600000);
    slots.push({
      hour: d.toLocaleTimeString([], { hour: 'numeric', hour12: true }),
      prob: Math.max(10, Math.min(80, Math.round(30 + Math.sin(i) * 30))),
      code: 2,
      temp: 30,
    });
  }
  return slots;
}

export function deriveStormAlert(
  dailyForecast: DailyForecast[],
  hourlyRain: HourlyRainSlot[]
): StormAlert | null {
  for (const slot of hourlyRain) {
    if ([95, 96, 99].includes(slot.code)) {
      return {
        level: 'WARNING',
        message: `Thunderstorm expected around ${slot.hour}`,
      };
    }
  }

  for (const day of dailyForecast.slice(0, 3)) {
    const timeRef = day.day.toLowerCase() === 'today' ? 'today' : `on ${day.day}`;

    if ([95, 96, 99].includes(day.code)) {
      return {
        level: 'WARNING',
        message: `Thunderstorm expected ${timeRef}`,
      };
    }
    if (day.windMax > 60) {
      return {
        level: 'WARNING',
        message: `Strong winds up to ${day.windMax} km/h expected ${timeRef}`,
      };
    }
    if (day.precipSum > 50) {
      return {
        level: 'WARNING',
        message: `Heavy rain (${day.precipSum}mm) expected ${timeRef}`,
      };
    }
    if (day.windMax > 40) {
      return {
        level: 'WATCH',
        message: `Moderate winds up to ${day.windMax} km/h expected ${timeRef}`,
      };
    }
    if (day.precipSum > 20) {
      return {
        level: 'WATCH',
        message: `Moderate rain (${day.precipSum}mm) expected ${timeRef}`,
      };
    }
  }

  return null;
}

export function getLiveWeatherSnapshot(): WeatherSnapshot {
  try {
    const cachedPayloadRaw =
      storage.getString(CACHE_KEY_PAYLOAD) || storage.getString(CACHE_KEY_LEGACY);
    const cachedTimeRaw = storage.getString(CACHE_KEY_TIME);
    const cachedTime = cachedTimeRaw ? Number(cachedTimeRaw) : 0;

    if (cachedPayloadRaw) {
      const parsed = JSON.parse(cachedPayloadRaw);
      const weatherData: Partial<WeatherInfo> = parsed.weather || parsed;
      const timestamp = parsed.timestamp || cachedTime || 0;
      const isFresh = timestamp > 0 && Date.now() - timestamp < WEATHER_CACHE_TTL_MS;

      const temp = weatherData.temp !== undefined ? weatherData.temp : 29;
      const code = weatherData.code !== undefined ? weatherData.code : 1;
      const details = getWeatherDetails(code);
      const label = weatherData.label || details.label;
      const locationName = weatherData.locationName || parsed.city || 'Manila, PH';
      const rainChance = weatherData.rainChance;
      const lastUpdated =
        weatherData.lastUpdated ||
        (timestamp > 0
          ? new Date(timestamp).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })
          : undefined);

      const snapshot: WeatherSnapshot = {
        temp,
        tempStr: `${temp}°C`,
        rainChance,
        rainStr: rainChance !== undefined ? `🌧️ ${rainChance}%` : undefined,
        code,
        label,
        locationName,
        isFresh,
        lastUpdated,
      };

      memoryWeatherCache = snapshot;
      return snapshot;
    }
  } catch (error) {
    console.warn('[weatherService] Failed to read live weather snapshot from MMKV:', error);
  }

  if (memoryWeatherCache) {
    return memoryWeatherCache;
  }

  const defaultSnapshot: WeatherSnapshot = {
    temp: 29,
    tempStr: '29°C',
    rainChance: 20,
    rainStr: '🌧️ 20%',
    code: 1,
    label: 'Partly Cloudy',
    locationName: 'Manila, PH',
    isFresh: false,
    lastUpdated: undefined,
  };
  memoryWeatherCache = defaultSnapshot;
  return defaultSnapshot;
}

export async function fetchFreshWeather(force: boolean = false): Promise<WeatherInfo | null> {
  try {
    if (!force) {
      const cachedPayloadRaw =
        storage.getString(CACHE_KEY_PAYLOAD) || storage.getString(CACHE_KEY_LEGACY);
      const cachedTimeRaw = storage.getString(CACHE_KEY_TIME);
      const cachedTime = cachedTimeRaw ? Number(cachedTimeRaw) : 0;

      if (cachedPayloadRaw) {
        try {
          const parsed = JSON.parse(cachedPayloadRaw);
          const weatherData = (parsed.weather || parsed) as WeatherInfo;
          const timestamp = parsed.timestamp || cachedTime;

          if (
            weatherData &&
            weatherData.rainChance !== undefined &&
            Array.isArray(weatherData.dailyForecast) &&
            weatherData.dailyForecast.length > 0 &&
            Array.isArray(weatherData.hourlyRain) &&
            Date.now() - timestamp < WEATHER_CACHE_TTL_MS
          ) {
            const date = new Date(timestamp);
            weatherData.lastUpdated = date.toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            });

            memoryWeatherCache = {
              temp: weatherData.temp,
              tempStr: `${weatherData.temp}°C`,
              rainChance: weatherData.rainChance,
              rainStr:
                weatherData.rainChance !== undefined
                  ? `🌧️ ${weatherData.rainChance}%`
                  : undefined,
              code: weatherData.code,
              label: weatherData.label,
              locationName: weatherData.locationName,
              isFresh: true,
              lastUpdated: weatherData.lastUpdated,
            };

            notifySubscribers(weatherData);
            return weatherData;
          }
        } catch (_) {
          // ignore cache error and fetch fresh
        }
      }
    }

    // 1. Geolocate using Native GPS or cached geocode fallback
    let lat = 14.5995;
    let lon = 120.9842;
    let city = 'Manila, PH';
    let nativeGeoSuccess = false;

    // Check cached geocode coordinates
    try {
      const cachedPayloadRaw = storage.getString(CACHE_KEY_PAYLOAD);
      if (cachedPayloadRaw) {
        const parsed = JSON.parse(cachedPayloadRaw);
        if (parsed.lat && parsed.lon && parsed.city) {
          lat = parsed.lat;
          lon = parsed.lon;
          city = parsed.city;
        }
      }
    } catch (_) {}

    try {
      const permissionResult = await Promise.race([
        Location.requestForegroundPermissionsAsync(),
        new Promise<any>((resolve) => setTimeout(() => resolve({ status: 'denied' }), 3000)),
      ]);
      const status = permissionResult?.status;

      if (status === 'granted') {
        const positionPromise = Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const timeoutPromise = new Promise<Location.LocationObject | null>((resolve) =>
          setTimeout(() => resolve(null), 3000)
        );

        let position = await Promise.race([positionPromise, timeoutPromise]);
        if (!position) {
          position = await Promise.race([
            Location.getLastKnownPositionAsync(),
            new Promise<any>((resolve) => setTimeout(() => resolve(null), 3000)),
          ]);
        }

        if (position && position.coords) {
          lat = position.coords.latitude;
          lon = position.coords.longitude;
          nativeGeoSuccess = true;
        }
      }
    } catch (err) {
      console.warn('[weatherService] Native expo-location failed/denied:', err);
    }

    // Fallback to IP Geolocation if Native GPS is unavailable
    if (!nativeGeoSuccess) {
      try {
        const ipRes = await fetch('https://freeipapi.com/api/json');
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData.latitude && ipData.longitude) {
            lat = ipData.latitude;
            lon = ipData.longitude;
            city = ipData.cityName ? `${ipData.cityName}, ${ipData.countryCode || 'PH'}` : city;
          }
        } else {
          const ipRes2 = await fetch('https://ipapi.co/json/');
          if (ipRes2.ok) {
            const ipData2 = await ipRes2.json();
            if (ipData2.latitude && ipData2.longitude) {
              lat = ipData2.latitude;
              lon = ipData2.longitude;
              city = ipData2.city ? `${ipData2.city}, ${ipData2.country_code || 'PH'}` : city;
            }
          }
        }
      } catch (err) {
        console.error('[weatherService] Failed IP geolocation fallback:', err);
      }
    }

    // Reverse geocode active coordinates
    try {
      const geoRes = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
      );
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        const detectedCity = geoData.locality || geoData.city || geoData.principalSubdivision;
        if (detectedCity) {
          city = `${detectedCity}, ${geoData.countryCode || 'PH'}`;
        }
      }
    } catch (err) {
      console.warn('[weatherService] Failed reverse geocoding active coordinates:', err);
    }

    // 2. Fetch Open-Meteo Weather with 7-day daily and hourly forecast
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=precipitation_probability,weather_code,temperature_2m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max&forecast_days=7&timezone=auto`
    );
    if (!weatherRes.ok) {
      throw new Error(`Open-Meteo API returned status ${weatherRes.status}`);
    }
    const weatherData = await weatherRes.json();
    const current = weatherData.current;
    const details = getWeatherDetails(current.weather_code);
    const lastUpdatedStr = new Date().toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const nowTime = Date.now();
    let maxProb = 0;
    let maxProbTimeStr = '';
    let firstRainTimeStr = '';

    const hourlyRain: HourlyRainSlot[] = [];
    if (
      weatherData.hourly &&
      Array.isArray(weatherData.hourly.time) &&
      Array.isArray(weatherData.hourly.precipitation_probability)
    ) {
      const times = weatherData.hourly.time as string[];
      const probs = weatherData.hourly.precipitation_probability as number[];
      const hourlyCodes = (weatherData.hourly.weather_code as number[]) ?? [];
      const hourlyTemps = (weatherData.hourly.temperature_2m as number[]) ?? [];

      for (let i = 0; i < times.length; i++) {
        const hourTime = new Date(times[i]).getTime();
        if (hourTime >= nowTime - 3600000 && hourTime <= nowTime + 24 * 3600000) {
          const prob = probs[i] ?? 0;
          if (prob > maxProb) {
            maxProb = prob;
            const d = new Date(times[i]);
            maxProbTimeStr = d.toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            });
          }
          if (prob >= 35 && !firstRainTimeStr) {
            const d = new Date(times[i]);
            firstRainTimeStr = d.toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            });
          }
        }

        // Collect next 18 hours for timeline
        if (hourTime >= nowTime && hourTime <= nowTime + 18 * 3600000) {
          const d = new Date(times[i]);
          hourlyRain.push({
            hour: d.toLocaleTimeString([], { hour: 'numeric', hour12: true }),
            prob: probs[i] ?? 0,
            code: hourlyCodes[i] ?? 0,
            temp: Math.round(hourlyTemps[i] ?? 0),
          });
        }
      }
    }

    const rainTime = firstRainTimeStr || maxProbTimeStr || '';

    // Parse 7 days daily forecast
    const dailyForecast: DailyForecast[] = [];
    if (weatherData.daily && Array.isArray(weatherData.daily.time)) {
      const dTimes = weatherData.daily.time as string[];
      const dCodes = (weatherData.daily.weather_code as number[]) ?? [];
      const dMaxT = (weatherData.daily.temperature_2m_max as number[]) ?? [];
      const dMinT = (weatherData.daily.temperature_2m_min as number[]) ?? [];
      const dPrecip = (weatherData.daily.precipitation_sum as number[]) ?? [];
      const dRainMax = (weatherData.daily.precipitation_probability_max as number[]) ?? [];
      const dWindMax = (weatherData.daily.wind_speed_10m_max as number[]) ?? [];

      for (let i = 0; i < dTimes.length; i++) {
        const d = parseLocalDate(dTimes[i]);
        const isToday = d.toDateString() === new Date().toDateString();
        dailyForecast.push({
          day: isToday ? 'Today' : d.toLocaleDateString([], { weekday: 'short' }),
          dateLabel: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
          code: dCodes[i] ?? 0,
          tempMax: Math.round(dMaxT[i] ?? 0),
          tempMin: Math.round(dMinT[i] ?? 0),
          precipSum: Math.round((dPrecip[i] ?? 0) * 10) / 10,
          rainChanceMax: dRainMax[i] ?? 0,
          windMax: Math.round(dWindMax[i] ?? 0),
        });
      }
    }

    const stormAlert = deriveStormAlert(dailyForecast, hourlyRain);

    const newWeather: WeatherInfo = {
      temp: Math.round(current.temperature_2m),
      feelsLike: Math.round(current.apparent_temperature),
      humidity: current.relative_humidity_2m,
      windSpeed: Math.round(current.wind_speed_10m),
      code: current.weather_code,
      label: details.label,
      locationName: city,
      lastUpdated: lastUpdatedStr,
      rainChance: maxProb,
      rainTime,
      dailyForecast: dailyForecast.length > 0 ? dailyForecast : generateFallbackDailyForecast(),
      hourlyRain: hourlyRain.length > 0 ? hourlyRain : generateFallbackHourlyRain(),
      stormAlert,
    };

    try {
      const payload = {
        timestamp: Date.now(),
        lat,
        lon,
        city,
        weather: newWeather,
      };
      storage.set(CACHE_KEY_PAYLOAD, JSON.stringify(payload));
      storage.set(CACHE_KEY_LEGACY, JSON.stringify(newWeather));
      storage.set(CACHE_KEY_TIME, Date.now().toString());
    } catch (e) {
      console.warn('[weatherService] Failed to persist weather to MMKV:', e);
    }

    memoryWeatherCache = {
      temp: newWeather.temp,
      tempStr: `${newWeather.temp}°C`,
      rainChance: newWeather.rainChance,
      rainStr:
        newWeather.rainChance !== undefined ? `🌧️ ${newWeather.rainChance}%` : undefined,
      code: newWeather.code,
      label: newWeather.label,
      locationName: newWeather.locationName,
      isFresh: true,
      lastUpdated: newWeather.lastUpdated,
    };

    notifySubscribers(newWeather);
    return newWeather;
  } catch (err) {
    console.error('[weatherService] Failed to fetch mobile weather details:', err);
    return null;
  }
}
