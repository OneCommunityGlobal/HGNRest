const HelpCategory = require('../models/helpCategory');

const helpCategoryController = {
    // Get all help categories
    getAllHelpCategories: async (req, res) => {
        try {
            const helpCategories = await HelpCategory.find({isActive: true})
            .sort({ order: 1 });
            res.status(200).json(helpCategories);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching help categories', error: error.message });
        }
    },
    // Create a new help category
    createHelpCategory: async (req, res) => {
        try {
            const { name, order } = req.body;
            const category = new HelpCategory({ 
                name, order: order || 0 
            });

            const savedCategory = await category.save();
            res.status(201).json(savedCategory);
        } catch (error) {
            res.status(500).json({ message: 'Error creating help category', error: error.message });
        }
    },
    // Update a help category
    updateHelpCategory: async (req, res) => {
        try {
            const { id } = req.params;
            const { name, order, isActive } = req.body;
            const updatedCategory = await HelpCategory.findByIdAndUpdate(
                id, 
                { name, order, isActive },
                 { new: true }
                );
            if (!updatedCategory) {
                return res.status(404).json({ message: 'Help category not found' });
            }
            res.status(200).json(updatedCategory);
        } catch (error) {
            res.status(500).json({ message: 'Error updating help category', error: error.message });
        }
    }
   
};

module.exports = helpCategoryController;
