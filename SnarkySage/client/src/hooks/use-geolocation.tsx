import { useState, useEffect } from 'react';

export interface GeolocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface GeolocationState {
  data: GeolocationData | null;
  error: string | null;
  loading: boolean;
  hasPermission: boolean;
  requestPermission: () => Promise<void>;
}

export function useGeolocation(): GeolocationState {
  const [data, setData] = useState<GeolocationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);

  const requestPermission = async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000 // Cache for 1 minute
          }
        );
      });

      const locationData: GeolocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp
      };

      setData(locationData);
      setHasPermission(true);
      setError(null);

      // Store in localStorage for future use
      localStorage.setItem('userLocation', JSON.stringify(locationData));
    } catch (err: any) {
      let errorMessage = 'Unable to retrieve your location';
      
      switch (err.code) {
        case err.PERMISSION_DENIED:
          errorMessage = 'Location access denied by user';
          break;
        case err.POSITION_UNAVAILABLE:
          errorMessage = 'Location information is unavailable';
          break;
        case err.TIMEOUT:
          errorMessage = 'Location request timed out';
          break;
      }
      
      setError(errorMessage);
      setHasPermission(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check if we have cached location data
    const cachedLocation = localStorage.getItem('userLocation');
    if (cachedLocation) {
      try {
        const parsed = JSON.parse(cachedLocation);
        const age = Date.now() - parsed.timestamp;
        
        // Use cached data if less than 5 minutes old
        if (age < 5 * 60 * 1000) {
          setData(parsed);
          setHasPermission(true);
        }
      } catch (err) {
        localStorage.removeItem('userLocation');
      }
    }
  }, []);

  return {
    data,
    error,
    loading,
    hasPermission,
    requestPermission
  };
}