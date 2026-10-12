const UserProfile = require('../models/userProfile');
const overviewReportHelper = require('./overviewReportHelper');

describe('getCountryCounts', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('counts active countries only for map-eligible volunteers', async () => {
    const profiles = [
      { isActive: true, location: { country: 'United States', coords: { lat: 34, lng: -118 } } },
      { isActive: true, location: { country: ' United States of America ' } },
      { isActive: false, location: { country: 'Canada', coords: { lat: 45, lng: -75 } } },
      { isActive: true, location: { country: 'United Kingdom', coords: { lat: 0, lng: 0 } } },
      { isActive: false, location: { country: 'Reino Unido' } },
      {
        isActive: true,
        location: { country: '  ', coords: { lat: 48 } },
        homeCountry: { country: 'France' },
      },
      { isActive: true, location: { country: '' } },
    ];
    const lean = jest.fn().mockResolvedValue(profiles);
    const find = jest.spyOn(UserProfile, 'find').mockReturnValue({ lean });

    const counts = await overviewReportHelper().getCountryCounts();

    expect(find).toHaveBeenCalledWith(
      {},
      {
        isActive: 1,
        'location.country': 1,
        'location.coords.lat': 1,
        'location.coords.lng': 1,
        'homeCountry.country': 1,
      },
    );
    expect(counts).toEqual({ allTime: 4, active: 2 });
  });
});
