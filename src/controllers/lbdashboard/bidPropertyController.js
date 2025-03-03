const mongoose = require('mongoose');

const bidPropertyController = (BidProperty) => {
  const fetchProperty = async (req, res) => {
    try {
      const PropId = req.params.id;

      const property = await Listing.findById(listingId)
        .select('images description amenities price')
        .exec();

      if (!property) {
        return res.status(404).send('Property not found');
      }

      res.status(200).send(property);


    } catch (error) {
      console.error('Error fetching property details:', error);
      res.status(500).send('Internal server error');
    }
  }

  return fetchProperty;

}

module.exports = bidPropertyController;