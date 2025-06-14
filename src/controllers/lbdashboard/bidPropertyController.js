const mongoose = require('mongoose');

const bidPropertyController = (BidProperty) => {
  const fetchProperty = async (req, res) => {
    try {
      const PropId = req.params.propertyId;

      const property = await BidProperty.findById(PropId)
        .select('images description amenities price status title description perUnit createdBy updatedBy availability createOn updateOn __v')
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

  return { fetchProperty };

};

module.exports = bidPropertyController;