const mongoose = require('mongoose');
const { fetchImagesFromAzureBlobStorage, saveImagestoAzureBlobStorage } = require('../../utilities/AzureBlobImages');
const userProfile = require('../../models/userProfile');

const listingsController = (ListingHome) => {
  const getListings = async (req, res) => {
    try {
      const page = req.headers['page'] || 1;
      const size = req.headers['size'] || 10;
      const village = req.headers['village'];
      const availableFrom = req.headers['availablefrom'];
      const availableTo = req.headers['availableto'];

      const pageNum = parseInt(page, 10);
      const sizeNum = parseInt(size, 10);

      if (Number.isNaN(pageNum)) return res.status(400).json({ error: 'Invalid page number' });
      if (Number.isNaN(sizeNum) || sizeNum < 1 || sizeNum > 100) {
        return res.status(400).json({ error: 'Invalid page size (1-100)' });
      }

      const skip = (pageNum - 1) * sizeNum;

      const query = {};
      if (village) query.village = village;

      if (availableFrom || availableTo) {
        query.$and = [];
        if (availableFrom) {
          query.$and.push({ availableTo: { $gte: new Date(availableFrom) } });
        }
        if (availableTo) {
          query.$and.push({ availableFrom: { $lte: new Date(availableTo) } });
        }
      }

      const total = await ListingHome.countDocuments(query);
      const totalPages = Math.ceil(total / sizeNum);

      if (pageNum > totalPages && totalPages > 0) {
        return res.status(404).json({ error: 'Page not found' });
      }

      const listings = await ListingHome.find(query)
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
          message: 'No listings found',
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

      const processedListings = await Promise.all(listings.map(async listing => {
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
          availableFrom: listing.availableFrom ? listing.availableFrom.toISOString().split('T')[0] : null,
          availableTo: listing.availableTo ? listing.availableTo.toISOString().split('T')[0] : null,
        };
      }));

      res.json({
        status: 200,
        message: 'Listings retrieved successfully',
        data: {
          items: processedListings,
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

  const createListing = async (req, res) => {
    try {
      const {
        title,
        description,
        price,
        perUnit,
        createdBy,
        updatedBy,
        availableFrom,
        availableTo,
        village,
        coordinates,
        amenities,
        status
      } = req.body;
      const images = req.files;

      const isComplete = status === 'complete';

      if (!(status === 'complete' || status === 'draft')) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      if (isComplete) {
        if (!title || !description || !price || !perUnit || !createdBy || !availableFrom || !availableTo || !village || !amenities || !updatedBy) {
          return res.status(400).json({
            error: 'Missing required fields for complete listing',
            details: {
              title: !title ? 'Required' : null,
              description: !description ? 'Required' : null,
              price: !price ? 'Required' : null,
              perUnit: !perUnit ? 'Required' : null,
              createdBy: !createdBy ? 'Required' : null,
              availableFrom: !availableFrom ? 'Required' : null,
              availableTo: !availableTo ? 'Required' : null,
              village: !village ? 'Required' : null,
              amenities: !amenities ? 'Required' : null,
              updatedBy: !updatedBy ? 'Required' : null
            }
          });
        }
      }
      else if (!isComplete) {
        if (!title || !price || !perUnit || !createdBy || !updatedBy) {
          return res.status(400).json({
            error: "Missing required fields to create a draft",
            details: {
              title: !title ? 'Required' : null,
              price: !price ? 'Required' : null,
              perUnit: !perUnit ? 'Required' : null,
              createdBy: !createdBy ? 'Required' : null,
              updatedBy: !updatedBy ? 'Required' : null
            }
          })
        }
      }

      if (!mongoose.Types.ObjectId.isValid(createdBy) || !mongoose.Types.ObjectId.isValid(updatedBy)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      if (price) {
        const numPrice = parseFloat(price);
        if (Number.isNaN(numPrice) || numPrice < 0) {
          return res.status(400).json({ error: 'Price must be a valid positive number' });
        }
      }

      // Parse coordinates if they're provided as a string
      let parsedCoordinates = coordinates;
      if (coordinates && typeof coordinates === 'string') {
        try {
          parsedCoordinates = JSON.parse(coordinates);
          // Validate coordinates
          if (!Array.isArray(parsedCoordinates) || parsedCoordinates.length !== 2 ||
            typeof parsedCoordinates[0] !== 'number' || typeof parsedCoordinates[1] !== 'number') {
            return res.status(400).json({ error: 'Coordinates must be an array of two numbers [longitude, latitude]' });
          }
        } catch (e) {
          return res.status(400).json({ error: 'Invalid coordinates format' });
        }
      }

      const listingData = {
        title,
        description,
        price: price ? parseFloat(price) : undefined,
        perUnit,
        createdBy,
        updatedBy,
        status
      };

      // Handle image uploads with error handling
      if (images && images.length) {
        try {
          listingData.images = await saveImagestoAzureBlobStorage(images, title);
        } catch (error) {
          console.error('Error saving images to Azure:', error);
          // Just store the titles as fallback if Azure storage fails
          listingData.images = images.map((image, idx) => `image-${idx}-${Date.now()}`);
        }
      }

      if (availableFrom) listingData.availableFrom = new Date(availableFrom);
      if (availableTo) listingData.availableTo = new Date(availableTo);
      if (village) listingData.village = village;
      if (parsedCoordinates) listingData.coordinates = parsedCoordinates;
      if (amenities) {
        // Handle amenities as an array if it comes as a string
        // eslint-disable-next-line no-nested-ternary
        listingData.amenities = Array.isArray(amenities) ? amenities :
          typeof amenities === 'string' ? [amenities] : [];
      }

      let savedListing;
      const { draftId } = req.body;

      let existingDraft;
      if (draftId && mongoose.Types.ObjectId.isValid(draftId)) {

        if (await userProfile.findOne({ _id: updatedBy, role: { $in: ['Owner', 'Administrator', 'Manager'] } })) {
          existingDraft = await ListingHome.findOne({
            _id: draftId
          });
        } else {
          existingDraft = await ListingHome.findOne({
            _id: draftId,
            updatedBy
          });
        }
        if (!existingDraft) {
          return res.status(403).json({ error: 'Unauthorized: Draft not found or does not belong to user' });
        }
        console.log(listingData);
        // Update the existing draft
        savedListing = await ListingHome.findByIdAndUpdate(
          draftId,
          { $set: listingData },
          { new: true }
        );
      } else {
        const newListing = new ListingHome(listingData);
        savedListing = await newListing.save();
      }

      res.status(201).json({
        status: 201,
        message: `Listing ${status === 'draft' ? 'draft' : ''} created successfully`,
        data: {
          id: savedListing._id,
          title: savedListing.title,
          description: savedListing.description,
          price: savedListing.price,
          perUnit: savedListing.perUnit,
          createdBy: savedListing.createdBy,
          status: savedListing.status,
          images: savedListing.images,
          availableFrom: savedListing.availableFrom,
          availableTo: savedListing.availableTo,
          village: savedListing.village,
          coordinates: savedListing.coordinates,
          amenities: savedListing.amenities
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
      const listing = await ListingHome.findById(id)
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

  const updateListing = async (req, res) => {
    try {
      const id = req.headers['id'];
      if (!id) return res.status(400).json({ error: 'Missing listing id in header' });
      const updateData = req.body;
      if (req.files && req.files.length) {
        // Save images to Azure or your storage and update updateData.images
        // Example: updateData.images = await saveImagestoAzureBlobStorage(req.files);
      }
      const updated = await ListingHome.findByIdAndUpdate(id, updateData, { new: true });
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
      const deleted = await ListingHome.findByIdAndDelete(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Listing not found' });
      }
      res.json({ status: 200, message: 'Listing deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  };

  return {
    getListings,
    createListing,
    deleteListing,
    updateListing,
    getListingById
  };
};

module.exports = listingsController;
