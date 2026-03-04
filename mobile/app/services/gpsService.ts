import * as Location from 'expo-location';

interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
}

interface LocationSubscription {
  remove: () => void;
}

class GPSService {
  private currentLocation: LocationCoords | null = null;
  private accuracy: number | null = null;
  private tracking = false;
  private locationSubscription: LocationSubscription | null = null;

  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  }

  async getCurrentLocation(): Promise<LocationCoords | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.warn('Location permission denied');
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 0,
        distanceInterval: 0,
      });

      this.currentLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        altitude: location.coords.altitude || undefined,
        heading: location.coords.heading || undefined,
        speed: location.coords.speed || undefined,
      };

      this.accuracy = location.coords.accuracy;

      return this.currentLocation;
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  async startTracking(): Promise<LocationSubscription | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.warn('Location permission denied');
        return null;
      }

      this.tracking = true;

      // Use significant change mode for battery efficiency
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // Update every 5 seconds minimum
          distanceInterval: 10, // Update every 10 meters minimum (significant change)
        },
        (location) => {
          this.currentLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || undefined,
            altitude: location.coords.altitude || undefined,
            heading: location.coords.heading || undefined,
            speed: location.coords.speed || undefined,
          };

          this.accuracy = location.coords.accuracy;
        }
      );

      return this.locationSubscription;
    } catch (error) {
      console.error('Error starting location tracking:', error);
      return null;
    }
  }

  stopTracking(): void {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }
    this.tracking = false;
  }

  getCurrentCoordinates(): LocationCoords | null {
    return this.currentLocation;
  }

  getAccuracy(): number | null {
    return this.accuracy;
  }

  isTracking(): boolean {
    return this.tracking;
  }

  calculateDistance(
    point1: LocationCoords,
    point2: LocationCoords
  ): number {
    const R = 6371; // Radius of the Earth in kilometers

    const lat1Rad = this.toRadians(point1.latitude);
    const lat2Rad = this.toRadians(point2.latitude);
    const deltaLat = this.toRadians(point2.latitude - point1.latitude);
    const deltaLon = this.toRadians(point2.longitude - point1.longitude);

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1Rad) *
        Math.cos(lat2Rad) *
        Math.sin(deltaLon / 2) *
        Math.sin(deltaLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance * 1000; // Return in meters
  }

  private toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  async getAddressFromCoordinates(
    coords: LocationCoords
  ): Promise<string | null> {
    try {
      const addresses = await Location.reverseGeocodeAsync({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });

      if (addresses.length > 0) {
        const address = addresses[0];
        return `${address.street || ''} ${address.city || ''} ${address.region || ''}`.trim();
      }

      return null;
    } catch (error) {
      console.error('Error getting address from coordinates:', error);
      return null;
    }
  }

  async getCoordinatesFromAddress(address: string): Promise<LocationCoords | null> {
    try {
      const geocoded = await Location.geocodeAsync(address);

      if (geocoded.length > 0) {
        const coords = geocoded[0];
        return {
          latitude: coords.latitude,
          longitude: coords.longitude,
        };
      }

      return null;
    } catch (error) {
      console.error('Error geocoding address:', error);
      return null;
    }
  }
}

export const gpsService = new GPSService();
