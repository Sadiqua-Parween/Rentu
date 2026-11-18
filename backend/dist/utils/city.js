"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CITIES = void 0;
exports.extractCity = extractCity;
exports.CITIES = [
    'Delhi',
    'Bangalore',
    'Mumbai',
    'Hyderabad',
    'Chennai',
    'Kolkata',
    'Pune',
    'Ahmedabad',
    'Jaipur',
    'Lucknow',
    'Chandigarh',
    'Noida',
    'Gurgaon',
    'Indore',
    'Kochi',
    'Bhopal',
    'Patna',
    'Other',
];
function extractCity(locality) {
    if (!locality)
        return 'Delhi';
    const loc = locality.toLowerCase();
    if (loc.includes('bangalore') ||
        loc.includes('bengaluru') ||
        loc.includes('koramangala') ||
        loc.includes('kengeri') ||
        loc.includes('indiranagar') ||
        loc.includes('whitefield') ||
        loc.includes('hsr')) {
        return 'Bangalore';
    }
    if (loc.includes('mumbai') ||
        loc.includes('bandra') ||
        loc.includes('powai') ||
        loc.includes('andheri') ||
        loc.includes('juhu') ||
        loc.includes('colaba')) {
        return 'Mumbai';
    }
    if (loc.includes('hyderabad') || loc.includes('secunderabad'))
        return 'Hyderabad';
    if (loc.includes('chennai'))
        return 'Chennai';
    if (loc.includes('kolkata'))
        return 'Kolkata';
    if (loc.includes('pune'))
        return 'Pune';
    if (loc.includes('noida'))
        return 'Noida';
    if (loc.includes('gurgaon') || loc.includes('gurugram'))
        return 'Gurgaon';
    if (loc.includes('jaipur'))
        return 'Jaipur';
    if (loc.includes('chandigarh'))
        return 'Chandigarh';
    if (loc.includes('lucknow'))
        return 'Lucknow';
    if (loc.includes('ahmedabad'))
        return 'Ahmedabad';
    if (loc.includes('patna'))
        return 'Patna';
    return 'Delhi';
}
