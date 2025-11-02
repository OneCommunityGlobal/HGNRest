
const mongoose = require('mongoose');
const { fetchImagesFromAzureBlobStorage, saveImagestoAzureBlobStorage } = require('../../utilities/AzureBlobImages');
const userProfile = require('../../models/userProfile');

const biddingController = (Bidding) => {
  const getBidListings = async (req, res) => {
    try {
      const page = req.headers['page'] || 1;
      const size = req.headers['size'] || 10;
      const village = req.headers['village'];

      const pageNum = parseInt(page, 10);
      const sizeNum = parseInt(size, 10);

      if (Number.isNaN(pageNum)) return res.status(400).json({ error: 'Invalid page number' });
      if (Number.isNaN(sizeNum) || sizeNum < 1 || sizeNum > 100) {
        return res.status(400).json({ error: 'Invalid page size (1-100)' });
      }

      const skip = (pageNum - 1) * sizeNum;
      const query = {};
      if (village) {
        if (!mongoose.Types.ObjectId.isValid(village)) {
          return res.status(400).json({ error: 'Invalid village id' });
        }
        query.village = mongoose.Types.ObjectId(village);
      }

      const total = await Bidding.countDocuments(query);
      const totalPages = Math.ceil(total / sizeNum);

      if (pageNum > totalPages && totalPages > 0) {
        return res.status(404).json({ error: 'Page not found' });
      }

      const listings = await Bidding.find(query)
        .populate([
          { path: 'createdBy', select: '_id firstName lastName' },
          { path: 'updatedBy', select: '_id firstName lastName' },
          { path: 'villages' }
        ])
        .sort({ updatedOn: -1 })
        .skip(skip)
        .limit(sizeNum)
        .lean()
        .exec();

      if (!listings.length) {
        return res.status(200).json({
          status: 200,
          message: 'No biddings found',
          data: {
            items: [],
            pagination: {
              total: 0,
              totalPages: 0,
              currentPage: pageNum,
              pageSize: sizeNum
            }
          }
        });
      }

      const processedBiddings = listings.map(listing => ({
        ...listing,
        createdOn: listing.createdOn ? listing.createdOn.toISOString().split('T')[0] : null,
        updatedOn: listing.updatedOn ? listing.updatedOn.toISOString().split('T')[0] : null,
      }));

      res.json({
        status: 200,
        message: 'Biddings retrieved successfully',
        data: {
          items: processedBiddings,
          pagination: {
            total,
            totalPages,
            currentPage: pageNum,
            pageSize: sizeNum
          }
        }
      });

    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  };

  const getBidListingById = async (req, res) => {
    try {
      const id = req.headers['id'];
      if (!id) return res.status(400).json({ error: 'Missing listing id in header' });
      const listing = await Bidding.findById(id)
        .populate([
          { path: 'createdBy', select: '_id firstName lastName' },
          { path: 'updatedBy', select: '_id firstName lastName' },
          { path: 'villages' }
        ])
        .lean();
      if (!listing) {
        return res.status(404).json({ error: 'Listing not found' });
      }
      res.json({ status: 200, data: listing });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  };

  const createBidListing = async (req, res) => {
    try {
      const {
        title,
        description,
        initialPrice,
        createdBy,
        updatedBy,
        village,
        amenities,
        status,
        location,
        finalPrice,
        images
      } = req.body;

      if (!title || !initialPrice || !createdBy || !updatedBy || !location || !finalPrice || !village) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      if (
        !mongoose.Types.ObjectId.isValid(createdBy) ||
        !mongoose.Types.ObjectId.isValid(updatedBy) ||
        !mongoose.Types.ObjectId.isValid(village)
      ) {
        return res.status(400).json({ error: 'Invalid user or village ID' });
      }

      let listingData = {
        title,
        description,
        initialPrice: parseFloat(initialPrice),
        currentPrice: parseFloat(initialPrice),
        finalPrice: parseFloat(finalPrice),
        createdBy,
        updatedBy,
        status: status || 'draft',
        village,
        amenities: Array.isArray(amenities) ? amenities : (amenities ? [amenities] : []),
        location,
        images: Array.isArray(images) ? images : (images ? [images] : [])
      };

      const newListing = new Bidding(listingData);
      const savedListing = await newListing.save();

      res.status(201).json({
        status: 201,
        message: 'Bidding listing created successfully',
        data: savedListing
      });

    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  };

  const updateBidListing = async (req, res) => {
    try {
      const id = req.headers['id'];
      if (!id) return res.status(400).json({ error: 'Missing listing id in header' });
      const updateData = req.body;

      // Expecting images as URLs/keys from frontend
      if (updateData.images && !Array.isArray(updateData.images)) {
        updateData.images = [updateData.images];
      }

      const updated = await Bidding.findByIdAndUpdate(id, updateData, { new: true });
      if (!updated) {
        return res.status(404).json({ error: 'Listing not found' });
      }
      res.json({ status: 200, message: 'Listing updated', data: updated });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  };

  const deleteBidListing = async (req, res) => {
    try {
      const id = req.headers['id'];
      if (!id) return res.status(400).json({ error: 'Missing listing id in header' });
      const deleted = await Bidding.findByIdAndDelete(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Listing not found' });
      }
      res.json({ status: 200, message: 'Listing deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  };

  return {
    getBidListings,
    getBidListingById,
    createBidListing,
    updateBidListing,
    deleteBidListing
  };
};

module.exports = biddingController;