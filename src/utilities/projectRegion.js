const REGION_COUNTRIES = {
  Asia: new Set(['China', 'India', 'Indonesia', 'Japan', 'Malaysia', 'Nepal', 'Philippines', 'Singapore', 'South Korea', 'Thailand', 'Vietnam']),
  'North America': new Set(['Canada', 'Mexico', 'United States', 'USA']),
  Europe: new Set(['France', 'Germany', 'Italy', 'Netherlands', 'Portugal', 'Spain', 'Sweden', 'Switzerland', 'United Kingdom', 'UK']),
  'South America': new Set(['Argentina', 'Brazil', 'Chile', 'Colombia', 'Ecuador', 'Peru', 'Uruguay']),
  Africa: new Set(['Egypt', 'Ethiopia', 'Ghana', 'Kenya', 'Morocco', 'Nigeria', 'South Africa', 'Tanzania', 'Uganda']),
  'Middle East': new Set(['Israel', 'Jordan', 'Lebanon', 'Oman', 'Qatar', 'Saudi Arabia', 'United Arab Emirates']),
};

const getProjectRegion = (country) => {
  const normalizedCountry = String(country || '').trim().toLowerCase();
  const entry = Object.entries(REGION_COUNTRIES).find(([, countries]) =>
    [...countries].some((name) => name.toLowerCase() === normalizedCountry),
  );

  return entry ? entry[0] : 'Other';
};

module.exports = { getProjectRegion };
