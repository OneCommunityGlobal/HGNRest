
const mongoose = require('mongoose');
const { fetchImagesFromAzureBlobStorage, saveImagestoAzureBlobStorage } = require('../../utilities/AzureBlobImages');
const userProfile = require('../../models/userProfile');

const biddingHomeController = (BiddingHome) => {
  const getBiddings = async (req, res) => {
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
      if (village) query.village = village;

      const total = await BiddingHome.countDocuments(query);
      const totalPages = Math.ceil(total / sizeNum);

      if (pageNum > totalPages && totalPages > 0) {
        return res.status(404).json({ error: 'Page not found' });
      }

      const listings = await BiddingHome.find(query)
        .populate([
          { path: 'createdBy', select: '_id firstName lastName' },
          { path: 'updatedBy', select: '_id firstName lastName' }
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

      const processedBiddings = await Promise.all(listings.map(async listing => {
        let images = [];
        try {
          if (listing.images && listing.images.length > 0) {
            images = await fetchImagesFromAzureBlobStorage(listing.images);
          }
        } catch (error) {
          images = ['https://via.placeholder.com/300x200?text=Unit'];
        }
        return {
          ...listing,
          images: images.length > 0 ? images : ['https://via.placeholder.com/300x200?text=Unit'],
          createdOn: listing.createdOn ? listing.createdOn.toISOString().split('T')[0] : null,
          updatedOn: listing.updatedOn ? listing.updatedOn.toISOString().split('T')[0] : null,
        };
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

  const getListingById = async (req, res) => {
    try {
      const id = req.headers['id'];
      if (!id) return res.status(400).json({ error: 'Missing listing id in header' });
      const listing = await BiddingHome.findById(id)
        .populate([
          { path: 'createdBy', select: '_id firstName lastName' },
          { path: 'updatedBy', select: '_id firstName lastName' }
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

  const createListing = async (req, res) => {
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
        location
      } = req.body;
      const images = req.files;

      if (!title || !initialPrice || !createdBy || !updatedBy || !location) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      if (!mongoose.Types.ObjectId.isValid(createdBy) || !mongoose.Types.ObjectId.isValid(updatedBy)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      let listingData = {
        title,
        description,
        initialPrice: parseFloat(initialPrice),
        currentPrice: parseFloat(initialPrice),
        finalPrice: null,
        createdBy,
        updatedBy,
        status: status || 'draft',
        village,
        amenities: Array.isArray(amenities) ? amenities : (amenities ? [amenities] : []),
        location
      };

      if (images && images.length) {
        try {
          listingData.images = await saveImagestoAzureBlobStorage(images, title);
        } catch (error) {
          listingData.images = images.map((image, idx) => `image-${idx}-${Date.now()}`);
        }
      }

      const newListing = new BiddingHome(listingData);
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

  const updateListing = async (req, res) => {
    try {
      const id = req.headers['id'];
      if (!id) return res.status(400).json({ error: 'Missing listing id in header' });
      const updateData = req.body;
      if (req.files && req.files.length) {
        // Save images to Azure or your storage and update updateData.images
        // Example: updateData.images = await saveImagestoAzureBlobStorage(req.files);
      }
      const updated = await BiddingHome.findByIdAndUpdate(id, updateData, { new: true });
      if (!updated) {
        return res.status(404).json({ error: 'Listing not found' });
      }
      res.json({ status: 200, message: 'Listing updated', data: updated });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  };

  const deleteListing = async (req, res) => {
    try {
      const id = req.headers['id'];
      if (!id) return res.status(400).json({ error: 'Missing listing id in header' });
      const deleted = await BiddingHome.findByIdAndDelete(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Listing not found' });
      }
      res.json({ status: 200, message: 'Listing deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  };

  return {
    getBiddings,
    getListingById,
    createListing,
    updateListing,
    deleteListing
  };
};

module.exports