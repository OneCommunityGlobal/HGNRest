const { body, validationResult } = require('express-validator');
const Village = require('../../models/lbdashboard/villages');

const villagesController = () => {
    
    // Validation middleware
    const validateVillage = [
        body('name')
            .optional()
            .trim()
            .notEmpty()
            .withMessage('Village name is required')
            .isLength({ min: 2, max: 100 })
            .withMessage('Village name must be between 2 and 100 characters'),
        
        body('regionId')
            .optional()
            .trim()
            .notEmpty()
            .withMessage('Region ID is required')
            .isIn(['C', '1', '2', '3', '4', '5', '6', '7'])
            .withMessage('Invalid region ID'),
        
        body('listingLinks.*.name')
            .optional()
            .trim()
            .notEmpty()
            .withMessage('Listing name cannot be empty'),
        
        body('listingLinks.*.url')
            .optional()
            .trim()
            .isURL()
            .withMessage('Listing URL must be a valid URL'),
        
        body('description')
            .optional()
            .trim(),
        
        body('imageLink')
            .optional()
            .trim()
            .isURL()
            .withMessage('Image link must be a valid URL'),
        
        body('position.left')
            .optional()
            .trim()
            .matches(/^\d+(\.\d+)?%$/)
            .withMessage('Left position must be a percentage value (e.g., "100%" or "49.75%")'),
        
        body('position.top')
            .optional()
            .trim()
            .matches(/^\d+(\.\d+)?%$/)
            .withMessage('Top position must be a percentage value (e.g., "100%" or "48%")'),
        
        body('properties')
            .optional()
            .isArray()
            .withMessage('Properties must be an array'),

        body('properties.*.unit')
            .optional()
            .isInt()
            .notEmpty()
            .withMessage('Property unit must be an integer'),

        body('properties.*.currentBid')
            .optional()
            .isInt()
            .withMessage('Property bidding must be an integer'),
            
        body('properties.*.description')
            .optional()
            .trim(),
            
        body('properties.*.link')
            .optional()
            .trim()
            .isURL()
            .withMessage('Property link must be a valid URL'),

        // Validate villageMapLink (optional URL)
        body('villageMapLink')
        .optional()
        .trim()
        .isURL()
        .withMessage('Village map link must be a valid URL'),

        // Validate amenities array and each amenity
        body('amenities')
        .optional()
        .isArray()
        .withMessage('Amenities must be an array'),
        
        body('amenities.*')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Each amenity must be a non‑empty string'),
    ];

  // Get all villages
  const getAllVillages = async (req, res) => {
    try {
      const villages = await Village.find();
      res.json(villages);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };

  // Get village by region ID
  const getVillageByRegion = async (req, res) => {
    try {
      const village = await Village.findOne({ regionId: req.params.regionId });
      if (!village) {
        return res.status(404).json({ message: 'Village not found' });
      }
      res.json(village);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };

  // Create a new village
  const createVillage = async (req, res) => {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation Error',
        errors: errors.array(),
      });
    }

    const village = new Village(req.body);
    try {
      const newVillage = await village.save();
      res.status(201).json(newVillage);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  };

  // Get a single village by ID
  const getVillageById = async (req, res) => {
    try {
      const village = await Village.findById(req.params.id);
      if (!village) {
        return res.status(404).json({ message: 'Village not found' });
      }
      res.json(village);
    } catch (error) {
      res.status(404).json({ message: error.message });
    }
  };

    // Update a village
    const updateVillage = async(req,res)=>{
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                message: 'Validation Error',
                errors: errors.array() 
            });
        }

        try{
            const village = await Village.findById(req.params.id);
            if (!village) {
                return res.status(404).json({ message: 'Village not found' });
            }

            // Update fields explicitly
            if (req.body.name !== undefined) village.name = req.body.name;
            if (req.body.regionId !== undefined) village.regionId = req.body.regionId;
            if (req.body.listingLinks !== undefined) village.listingLinks = req.body.listingLinks;
            if (req.body.description !== undefined) village.description = req.body.description;
            if (req.body.imageLink !== undefined) village.imageLink = req.body.imageLink;
            if (req.body.position !== undefined) village.position = req.body.position;
            if (req.body.properties !== undefined) village.properties = req.body.properties;
            if (req.body.villageMapLink !== undefined) village.villageMapLink = req.body.villageMapLink;
            if (req.body.amenities !== undefined)      
            village.amenities = req.body.amenities;

            const updatedVillage = await village.save();
            res.json(updatedVillage);
        }catch(error){
            res.status(400).json({message:error.message});
        }
    }
    
    // Delete a village
    const deleteVillage = async(req,res)=>{
        try{
            const village = await Village.findByIdAndDelete(req.params.id);
            if (!village) {
                return res.status(404).json({ message: 'Village not found' });
            }
            res.json({message:'Village deleted successfully'});
        }catch(error){
            res.status(500).json({message:error.message});
        }
    }   

    return {
        getAllVillages,
        createVillage,
        getVillageById,
        updateVillage,
        deleteVillage,
        getVillageByRegion,
        validateVillage
    }
};

module.exports = villagesController;
