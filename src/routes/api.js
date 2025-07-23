const express = require('express');
const router = express.Router();

// Example route for getting all items
router.get('/items', (req, res) => {
    res.json({ message: 'Get all items' });
});

// Example route for creating a new item
router.post('/items', (req, res) => {
    res.json({ message: 'Create a new item' });
});

// Example route for getting a specific item by ID
router.get('/items/:id', (req, res) => {
    res.json({ message: `Get item with ID: ${req.params.id}` });
});

// Example route for updating an item by ID
router.put('/items/:id', (req, res) => {
    res.json({ message: `Update item with ID: ${req.params.id}` });
});

// Example route for deleting an item by ID
router.delete('/items/:id', (req, res) => {
    res.json({ message: `Delete item with ID: ${req.params.id}` });
});

module.exports = router;