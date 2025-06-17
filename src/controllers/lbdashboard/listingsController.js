const mongoose = require('mongoose');
const {fetchImagesFromAzureBlobStorage, saveImagestoAzureBlobStorage} = require('../../utilities/AzureBlobImages');
const userProfile = require('../../models/userProfile');

const listingsController = (ListingHome) => {
  const getListings = async (req, res) => {
    try {
      const { 
        page = 1, 
        size = 10, 
        village, 
        availableFrom, 
        availableTo 
      } = req.query;
      
      const pageNum = parseInt(page, 10);
      const sizeNum = parseInt(size, 10);

      if (Number.isNaN(pageNum)) return res.status(400).json({ error: 'Invalid page number' });
      if (Number.isNaN(sizeNum) || sizeNum < 1 || sizeNum > 100) {
        return res.status(400).json({ error: 'Invalid page size (1-100)' });
      }

      const skip = (pageNum - 1) * sizeNum;
      
      // Build query based on filters
      const query = {};
      if (village) query.village = village;
      
      // Handle date range filtering
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
          {
            path: 'createdBy', select: '_id firstName lastName'
          },
          {
            path: 'updatedBy', select: '_id firstName lastName'
          }
        ]) 
        .sort({ updatedOn: -1 })
        .skip(skip)
        .limit(sizeNum)
        .lean()
        .exec();

      // Return empty array if no listings found - don't treat as an error
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

      // Process listings with error handling for image fetching
      const processedListings = await Promise.all(listings.map(async listing => {
        let images = [];
        
        // Try to fetch images from Azure with error handling
        try {
          if (listing.images && listing.images.length > 0) {
            images = await fetchImagesFromAzureBlobStorage(listing.images);
          }
        } catch (error) {
          console.error('Error fetching images from Azure:', error.message);
          // Fallback to placeholder images
          images = ['https://via.placeholder.com/300x200?text=Unit'];
        }
        
        const processed = { 
          ...listing,
          images: images.length > 0 ? images : ['https://via.placeholder.com/300x200?text=Unit'],
          createdOn: listing.createdOn ? listing.createdOn.toISOString().split('T')[0] : null,
          updatedOn: listing.updatedOn ? listing.updatedOn.toISOString().split('T')[0] : null,
          availableFrom: listing.availableFrom ? listing.availableFrom.toISOString().split('T')[0] : null,
          availableTo: listing.availableTo ? listing.availableTo.toISOString().split('T')[0] : null,
        };
        return processed;
      }));

      const response = {
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
      };

      res.json(response);

    } catch (error) {
      console.error('Error fetching listings:', error);
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
        village,
        coordinates,
        amenities, 
        status 
      } = req.body;
      const images = req.files;

      const isComplete = status === 'complete';
      
      if (!(status === 'complete' || status === 'draft')) {
        return res.status(400).json({error: 'Invalid status'});
      }

      if (isComplete) {
        if (!title || !description || !price || !perUnit || !createdBy || !village || !amenities || !updatedBy) {
          return res.status(400).json({
            error: 'Missing required fields for complete listing',
            details: {
              title: !title ? 'Required' : null,
              description: !description ? 'Required' : null,
              price: !price ? 'Required' : null,
              perUnit: !perUnit ? 'Required' : null,
              createdBy: !createdBy ? 'Required' : null,
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
      console.log(listingData);
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
      
      if (village) listingData.village = village;
      if (parsedCoordinates) listingData.coordinates = parsedCoordinates;
      if (amenities) {
        // Handle amenities as an array if it comes as a string
        // eslint-disable-next-line no-nested-ternary
        listingData.amenities = Array.isArray(amenities) ? amenities : 
                              typeof amenities === 'string' ? [amenities] : [];
      }

      let savedListing;
      const {draftId} = req.body;

      let existingDraft;
      if (draftId && mongoose.Types.ObjectId.isValid(draftId)) {

        if (await userProfile.findOne({ _id: updatedBy, role: { $in: ['Owner', 'Administrator', 'Manager'] }})) {
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
  
  // GET endpoint for retrieving biddings
  const getBiddings = async (req, res) => {
    try {
      const { 
        page = 1, 
        size = 10, 
        village, 
        availableFrom, 
        availableTo 
      } = req.query;
      
      const pageNum = parseInt(page, 10);
      const sizeNum = parseInt(size, 10);

      if (Number.isNaN(pageNum)) return res.status(400).json({ error: 'Invalid page number' });
      if (Number.isNaN(sizeNum) || sizeNum < 1 || sizeNum > 100) {
        return res.status(400).json({ error: 'Invalid page size (1-100)' });
      }

      const skip = (pageNum - 1) * sizeNum;
      
      // Build query based on filters
      const query = {};
      if (village) query.village = village;
      
      // Handle date range filtering
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
          {
            path: 'createdBy', select: '_id firstName lastName'
          },
          {
            path: 'updatedBy', select: '_id firstName lastName'
          }
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

      // Process listings with error handling for image fetching
      const processedBiddings = await Promise.all(listings.map(async listing => {
        let images = [];
        
        // Try to fetch images from Azure with error handling
        try {
          if (listing.images && listing.images.length > 0) {
            images = await fetchImagesFromAzureBlobStorage(listing.images);
          }
        } catch (error) {
          console.error('Error fetching images from Azure:', error.message);
          // Fallback to placeholder images
          images = ['https://via.placeholder.com/300x200?text=Unit'];
        }
        
        // Convert listings to biddings (with 80% price)
        const processed = { 
          ...listing,
          price: Math.round(listing.price * 0.8 * 100) / 100, // 80% of original price, rounded to 2 decimals
          images: images.length > 0 ? images : ['https://via.placeholder.com/300x200?text=Unit'],
          createdOn: listing.createdOn ? listing.createdOn.toISOString().split('T')[0] : null,
          updatedOn: listing.updatedOn ? listing.updatedOn.toISOString().split('T')[0] : null,
          availableFrom: listing.availableFrom ? listing.availableFrom.toISOString().split('T')[0] : null,
          availableTo: listing.availableTo ? listing.availableTo.toISOString().split('T')[0] : null,
        };
        return processed;
      }));

      const response = {
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
      };

      res.json(response);

    } catch (error) {
      console.error('Error fetching biddings:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: error.message 
      });
    }
  };
  
  /**
   * Get all unique villages from the database
   * @param {Object} req - The request object
   * @param {Object} res - The response object
   */
  const getVillages = async (req, res) => {
    try {
      // Default fixed villages that should always be included
      const fixedVillages = [
        "Earthbag", "Straw Bale", "Recycle Materials", "Cob", 
        "Tree House", "Strawberry", "Sustainable Living", "City Center"
      ];
      
      // Fetch distinct villages from database
      let dbVillages = [];
      try {
        dbVillages = await ListingHome.distinct('village');
      } catch (error) {
        console.error('Error fetching villages from database:', error);
        // If database query fails, continue with just fixed villages
      }
      
      // Filter out null or empty values
      const validDbVillages = dbVillages.filter(village => 
        village && typeof village === 'string' && village.trim() !== ''
      );
      
      // Combine fixed and database villages, removing duplicates
      const allVillages = [...new Set([...fixedVillages, ...validDbVillages])];
      
      // Sort alphabetically
      allVillages.sort();
      
      res.json({
        status: 200,
        message: 'Villages retrieved successfully',
        data: allVillages
      });
    } catch (error) {
      console.error('Error fetching villages:', error);
      // Even if there's an error, return at least the fixed villages
      res.status(200).json({ 
        status: 200,
        message: 'Returning default villages due to error',
        data: [
          "Earthbag", "Straw Bale", "Recycle Materials", "Cob", 
          "Tree House", "Strawberry", "Sustainable Living", "City Center"
        ]
      });
    }
  };

  return { 
    getListings, 
    createListing, 
    getBiddings,
    getVillages
  };
};

module.exports = listingsController;
