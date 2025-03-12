const listingsController = (ListingHome) => {
  const getListings = async (req, res) => {
    try {
      const { page = 1, size = 10, format = 'grid' } = req.query;
      const pageNum = parseInt(page, 10);
      const sizeNum = parseInt(size, 10);

      // Validate format parameter
      if (!['grid', 'list'].includes(format)) {
        return res.status(400).json({ error: 'Invalid format. Use "grid" or "list".' });
      }

      if (Number.isNaN(pageNum)) return res.status(400).json({ error: 'Invalid page number' });
      if (Number.isNaN(sizeNum) || sizeNum < 1 || sizeNum > 100) {
        return res.status(400).json({ error: 'Invalid page size (1-100)' });
      }

      const skip = (pageNum - 1) * sizeNum;
      const total = await ListingHome.countDocuments();
      const totalPages = Math.ceil(total / sizeNum);

      if (pageNum > totalPages && totalPages > 0) {
        return res.status(404).json({ error: 'Page not found' });
      }

      const listings = await ListingHome.find()
        .populate('createdBy', '_id firstName lastName') 
        .sort({ createdOn: -1 })
        .skip(skip)
        .limit(sizeNum)
        .lean()
        .exec();

      if (!listings.length) {
        return res.status(404).json({ error: 'No listings found' });
      }

      // Process listings based on format
      const processedListings = listings.map(listing => {
        const processed = { 
          ...listing,
          image: listing.image.toString('base64'),
          // For list format, add full name field
          ...(format === 'list' && {
            creator: `${listing.createdBy.firstName} ${listing.createdBy.lastName}`
          })
        };
        
        // Remove unnecessary fields for list format
        if (format === 'list') {
          const { image, createdBy, ...listFields } = processed;
          return listFields;
        }
        return processed;
      });

      const response = {
        status: 200,
        message: 'Listings retrieved successfully',
        data: {
          layout: format,
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

 
  return { getListings };
};

module.exports = listingsController;