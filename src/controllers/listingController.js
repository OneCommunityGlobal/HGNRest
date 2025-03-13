const Listing = require("../models/Listing");

exports.getListings = async (req, res) => {
  try {
    const listings = await Listing.find();
    res.status(200).json(listings);
  } catch (error) {
    res.status(500).json({ error: "Error fetching listings" });
  }
};

exports.getListingById = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: "Listing not found" });
    res.status(200).json(listing);
  } catch (error) {
    res.status(500).json({ error: "Error retrieving listing" });
  }
};

exports.createListing = async (req, res) => {
  try {
    const { title, description, price, location, bedrooms, bathrooms, squareFeet } = req.body;
    const imageUrls = req.files.map(file => file.location || `/uploads/${file.filename}`);

    const newListing = new Listing({ title, description, price, location, bedrooms, bathrooms, squareFeet, images: imageUrls });
    await newListing.save();

    res.status(201).json(newListing);
  } catch (error) {
    res.status(500).json({ error: "Error creating listing" });
  }
};

exports.updateListing = async (req, res) => {
  try {
    const { title, description, price, location, bedrooms, bathrooms, squareFeet } = req.body;
    const imageUrls = req.files.map(file => file.location || `/uploads/${file.filename}`);

    const updatedListing = await Listing.findByIdAndUpdate(req.params.id, { title, description, price, location, bedrooms, bathrooms, squareFeet, images: imageUrls }, { new: true });

    if (!updatedListing) return res.status(404).json({ error: "Listing not found" });

    res.status(200).json(updatedListing);
  } catch (error) {
    res.status(500).json({ error: "Error updating listing" });
  }
};

exports.deleteListing = async (req, res) => {
  try {
    const deletedListing = await Listing.findByIdAndDelete(req.params.id);
    if (!deletedListing) return res.status(404).json({ error: "Listing not found" });
    res.status(200).json({ message: "Listing deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Error deleting listing" });
  }
};
