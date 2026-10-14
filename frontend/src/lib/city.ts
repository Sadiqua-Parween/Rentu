export const CITIES = ['Bangalore', 'Delhi', 'Mumbai'] as const;
export type CityName = typeof CITIES[number];

export function extractCity(locality?: string): CityName {
  if (!locality) return 'Bangalore';
  const loc = locality.toLowerCase();
  if (
    loc.includes('bangalore') || 
    loc.includes('bengaluru') || 
    loc.includes('koramangala') || 
    loc.includes('kengeri') || 
    loc.includes('indiranagar') || 
    loc.includes('whitefield') || 
    loc.includes('hsr')
  ) {
    return 'Bangalore';
  }
  if (
    loc.includes('mumbai') || 
    loc.includes('bandra') || 
    loc.includes('powai') || 
    loc.includes('andheri') || 
    loc.includes('juhu') || 
    loc.includes('colaba')
  ) {
    return 'Mumbai';
  }
  if (
    loc.includes('delhi') ||
    loc.includes('saket') ||
    loc.includes('hauz') ||
    loc.includes('noida') ||
    loc.includes('gurgaon')
  ) {
    return 'Delhi';
  }
  return 'Bangalore';
}
