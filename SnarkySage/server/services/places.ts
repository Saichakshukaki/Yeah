// Places and Points of Interest service for finding nearby locations

export interface PlaceResult {
  name: string;
  type: string;
  address: string;
  distance?: number;
  rating?: number;
  coordinates: {
    lat: number;
    lon: number;
  };
}

export async function findNearbyPlaces(
  lat: number, 
  lon: number, 
  type: string, 
  radius: number = 5000
): Promise<PlaceResult[]> {
  try {
    // Using Overpass API (OpenStreetMap data) for nearby places
    // This is free and doesn't require API keys
    const query = buildOverpassQuery(lat, lon, type, radius);
    
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`
    });

    if (!response.ok) {
      throw new Error('Overpass API request failed');
    }

    const data = await response.json();
    return parseOverpassResults(data, lat, lon);
  } catch (error) {
    console.error('Places search error:', error);
    return [];
  }
}

function buildOverpassQuery(lat: number, lon: number, type: string, radius: number): string {
  let amenityFilter = '';
  
  // Map common search terms to OSM amenity types
  switch (type.toLowerCase()) {
    case 'restaurant':
    case 'restaurants':
    case 'food':
    case 'eat':
      amenityFilter = 'amenity~"^(restaurant|fast_food|cafe|bar|pub)$"';
      break;
    case 'gas':
    case 'gas station':
    case 'fuel':
    case 'petrol':
      amenityFilter = 'amenity="fuel"';
      break;
    case 'hospital':
    case 'medical':
    case 'doctor':
      amenityFilter = 'amenity~"^(hospital|clinic|doctors)$"';
      break;
    case 'bank':
    case 'atm':
      amenityFilter = 'amenity~"^(bank|atm)$"';
      break;
    case 'pharmacy':
    case 'medicine':
      amenityFilter = 'amenity="pharmacy"';
      break;
    case 'grocery':
    case 'store':
    case 'supermarket':
      amenityFilter = 'shop~"^(supermarket|convenience)$"';
      break;
    case 'hotel':
    case 'accommodation':
      amenityFilter = 'tourism~"^(hotel|motel|hostel)$"';
      break;
    default:
      amenityFilter = `amenity~"${type}"`;
  }

  return `
    [out:json][timeout:25];
    (
      node[${amenityFilter}](around:${radius},${lat},${lon});
      way[${amenityFilter}](around:${radius},${lat},${lon});
      relation[${amenityFilter}](around:${radius},${lat},${lon});
    );
    out center meta;
  `;
}

function parseOverpassResults(data: any, userLat: number, userLon: number): PlaceResult[] {
  const results: PlaceResult[] = [];

  if (!data.elements) return results;

  for (const element of data.elements) {
    if (!element.tags) continue;

    let lat = element.lat;
    let lon = element.lon;

    // For ways and relations, use center coordinates
    if (element.center) {
      lat = element.center.lat;
      lon = element.center.lon;
    }

    if (!lat || !lon) continue;

    const name = element.tags.name || element.tags.brand || 'Unnamed Location';
    const amenity = element.tags.amenity || element.tags.shop || element.tags.tourism || 'place';
    
    // Calculate distance
    const distance = calculateDistance(userLat, userLon, lat, lon);

    const place: PlaceResult = {
      name,
      type: amenity,
      address: buildAddress(element.tags),
      distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
      coordinates: { lat, lon }
    };

    results.push(place);
  }

  // Sort by distance and limit to top 10
  return results
    .sort((a, b) => (a.distance || 0) - (b.distance || 0))
    .slice(0, 10);
}

function buildAddress(tags: any): string {
  const parts = [];
  
  if (tags['addr:housenumber']) parts.push(tags['addr:housenumber']);
  if (tags['addr:street']) parts.push(tags['addr:street']);
  if (tags['addr:city']) parts.push(tags['addr:city']);
  if (tags['addr:postcode']) parts.push(tags['addr:postcode']);
  
  return parts.length > 0 ? parts.join(', ') : 'Address not available';
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function formatPlacesForAI(places: PlaceResult[], searchType: string): string {
  if (places.length === 0) {
    return `No ${searchType} found nearby. Try being more specific or expanding your search area.`;
  }

  let formatted = `📍 **Nearby ${searchType}:**\n\n`;
  
  places.slice(0, 5).forEach((place, index) => {
    const distanceText = place.distance! < 1 
      ? `${Math.round(place.distance! * 1000)}m away` 
      : `${place.distance!.toFixed(1)}km away`;
      
    formatted += `${index + 1}. **${place.name}**\n`;
    formatted += `   📍 ${distanceText}`;
    
    // Add precise location details for the nearest one
    if (index === 0) {
      formatted += ` (nearest location)`;
    }
    formatted += `\n`;
    
    if (place.address !== 'Address not available') {
      formatted += `   🏠 ${place.address}\n`;
    }
    formatted += `   🏷️ ${place.type}\n\n`;
  });

  formatted += `\n💡 *Distances calculated from your exact location for precision.*`;
  return formatted;
}