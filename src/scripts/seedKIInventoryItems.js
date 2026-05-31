/**
 * Seed script for KIInventoryItems collection.
 *
 * Usage (from the HGNRest root):
 *   node src/scripts/seedKIInventoryItems.js
 *
 * Requires a valid .env file with the same MongoDB credentials used by the app:
 *   user, password, cluster, dbName, appName
 *
 * This script inserts sample inventory items across all 5 categories with
 * a mix of stock levels (normal, low, critical) and some long-shelf-life
 * ingredients (expiry >= 1 year) to trigger the preserved-items notification.
 */

/* eslint-disable no-console */
require('dotenv').config();
const mongoose = require('mongoose');
const KIInventoryItem = require('../models/kitchenandinventory/KIInventoryItems');

// Build the same Atlas URI the app uses in startup/db.js
const { user, password, cluster, dbName, appName = 'HGNRest' } = process.env;
if (!user || !password || !cluster || !dbName) {
  console.error('❌ Missing required env vars: user, password, cluster, dbName');
  console.error('   Ensure your .env file is present and complete.');
  process.exit(1);
}
const MONGO_URI = `mongodb+srv://${user}:${encodeURIComponent(password)}@${cluster}/${dbName}?retryWrites=true&w=majority&appName=${appName}`;

const now = new Date();
const future = (months) => {
  const d = new Date(now);
  d.setMonth(d.getMonth() + months);
  return d;
};

// Category enum values from the model
const CATEGORIES = {
  INGREDIENT: 'INGREDIENT',
  EQUIPMENTANDSUPPLIES: 'EQUIPEMENTANDSUPPLIES', // note: typo is intentional — matches model enum
  SEEDS: 'SEEDS',
  CANNINGSUPPLIES: 'CANNINGSUPPLIES',
  ANIMALSUPPLIES: 'ANIMALSUPPLIES',
};

const seedItems = [
  // ── INGREDIENTS — mix of stock levels ────────────────────────────────────
  {
    name: 'Canned Tomatoes',
    storedQuantity: 120,
    presentQuantity: 95,
    unit: 'jars',
    type: 'Preserved Foods',
    monthlyUsage: 20,
    reorderAt: 30,
    category: CATEGORIES.INGREDIENT,
    expiryDate: future(18), // > 1 year — triggers preserved notification
    location: 'Pantry Shelf 1',
    onsite: true,
  },
  {
    name: 'Pickled Cucumbers',
    storedQuantity: 80,
    presentQuantity: 65,
    unit: 'jars',
    type: 'Preserved Foods',
    monthlyUsage: 15,
    reorderAt: 20,
    category: CATEGORIES.INGREDIENT,
    expiryDate: future(24), // > 1 year — triggers preserved notification
    location: 'Pantry Shelf 2',
    onsite: true,
  },
  {
    name: 'Dried Beans',
    storedQuantity: 50,
    presentQuantity: 40,
    unit: 'lbs',
    type: 'Dry Goods',
    monthlyUsage: 10,
    reorderAt: 15,
    category: CATEGORIES.INGREDIENT,
    expiryDate: future(14), // > 1 year — triggers preserved notification
    location: 'Dry Storage',
    onsite: false,
  },
  {
    name: 'Carrots',
    storedQuantity: 30,
    presentQuantity: 8, // LOW: presentQuantity (8) <= reorderAt (10)
    unit: 'lbs',
    type: 'Vegetables',
    monthlyUsage: 12,
    reorderAt: 10,
    category: CATEGORIES.INGREDIENT,
    expiryDate: future(2),
    location: 'Garden Bed 2',
    onsite: true,
    lastHarvestDate: future(-1),
    nextHarvestDate: future(2),
    nextHarvestQuantity: 25,
  },
  {
    name: 'Tomatoes',
    storedQuantity: 60,
    presentQuantity: 4, // CRITICAL: presentQuantity (4) <= reorderAt (30) * 0.5 (15)
    unit: 'lbs',
    type: 'Vegetables',
    monthlyUsage: 25,
    reorderAt: 30,
    category: CATEGORIES.INGREDIENT,
    expiryDate: future(1),
    location: 'Garden Bed 1',
    onsite: true,
    nextHarvestDate: future(1),
    nextHarvestQuantity: 30,
  },
  {
    name: 'Flour',
    storedQuantity: 100,
    presentQuantity: 70,
    unit: 'lbs',
    type: 'Dry Goods',
    monthlyUsage: 20,
    reorderAt: 25,
    category: CATEGORIES.INGREDIENT,
    expiryDate: future(6),
    location: 'Dry Storage',
    onsite: false,
  },
  {
    name: 'Honey',
    storedQuantity: 40,
    presentQuantity: 5, // CRITICAL: presentQuantity (5) <= reorderAt (20) * 0.5 (10)
    unit: 'jars',
    type: 'Sweetener',
    monthlyUsage: 8,
    reorderAt: 20,
    category: CATEGORIES.INGREDIENT,
    expiryDate: future(36), // > 1 year — triggers preserved notification
    location: 'Pantry Shelf 3',
    onsite: true,
  },

  // ── EQUIPMENT & SUPPLIES ──────────────────────────────────────────────────
  {
    name: 'Chef Knife Set',
    storedQuantity: 5,
    presentQuantity: 4,
    unit: 'sets',
    type: 'Kitchen Tools',
    monthlyUsage: 0,
    reorderAt: 2,
    category: CATEGORIES.EQUIPMENTANDSUPPLIES,
    expiryDate: future(60),
    location: 'Kitchen Drawer 1',
    onsite: true,
  },
  {
    name: 'Cast Iron Skillet',
    storedQuantity: 8,
    presentQuantity: 7,
    unit: 'units',
    type: 'Cookware',
    monthlyUsage: 0,
    reorderAt: 2,
    category: CATEGORIES.EQUIPMENTANDSUPPLIES,
    expiryDate: future(120),
    location: 'Kitchen Cabinet',
    onsite: true,
  },
  {
    name: 'Canning Jar Lids',
    storedQuantity: 200,
    presentQuantity: 15, // LOW: presentQuantity (15) <= reorderAt (30)
    unit: 'units',
    type: 'Canning Equipment',
    monthlyUsage: 50,
    reorderAt: 30,
    category: CATEGORIES.EQUIPMENTANDSUPPLIES,
    expiryDate: future(24),
    location: 'Supply Cabinet',
    onsite: false,
  },
  {
    name: 'Food Storage Bags',
    storedQuantity: 150,
    presentQuantity: 120,
    unit: 'units',
    type: 'Storage',
    monthlyUsage: 30,
    reorderAt: 40,
    category: CATEGORIES.EQUIPMENTANDSUPPLIES,
    expiryDate: future(18),
    location: 'Supply Cabinet',
    onsite: false,
  },
  {
    name: 'Mixing Bowls',
    storedQuantity: 10,
    presentQuantity: 2, // CRITICAL: presentQuantity (2) <= reorderAt (6) * 0.5 (3)
    unit: 'sets',
    type: 'Kitchen Tools',
    monthlyUsage: 0,
    reorderAt: 6,
    category: CATEGORIES.EQUIPMENTANDSUPPLIES,
    expiryDate: future(60),
    location: 'Kitchen Cabinet',
    onsite: true,
  },
  {
    name: 'Rubber Gloves',
    storedQuantity: 100,
    presentQuantity: 80,
    unit: 'pairs',
    type: 'Safety',
    monthlyUsage: 20,
    reorderAt: 20,
    category: CATEGORIES.EQUIPMENTANDSUPPLIES,
    expiryDate: future(12),
    location: 'Supply Closet',
    onsite: false,
  },

  // ── SEEDS ─────────────────────────────────────────────────────────────────
  {
    name: 'Tomato Seeds',
    storedQuantity: 500,
    presentQuantity: 400,
    unit: 'packets',
    type: 'Vegetable Seeds',
    monthlyUsage: 50,
    reorderAt: 100,
    category: CATEGORIES.SEEDS,
    expiryDate: future(18),
    location: 'Seed Storage Box',
    onsite: true,
  },
  {
    name: 'Bell Pepper Seeds',
    storedQuantity: 300,
    presentQuantity: 20, // LOW: presentQuantity (20) <= reorderAt (50)
    unit: 'packets',
    type: 'Vegetable Seeds',
    monthlyUsage: 40,
    reorderAt: 50,
    category: CATEGORIES.SEEDS,
    expiryDate: future(24),
    location: 'Seed Storage Box',
    onsite: true,
  },
  {
    name: 'Cucumber Seeds',
    storedQuantity: 200,
    presentQuantity: 150,
    unit: 'packets',
    type: 'Vegetable Seeds',
    monthlyUsage: 30,
    reorderAt: 60,
    category: CATEGORIES.SEEDS,
    expiryDate: future(12),
    location: 'Seed Storage Box',
    onsite: true,
  },
  {
    name: 'Herb Mix Seeds',
    storedQuantity: 100,
    presentQuantity: 10, // CRITICAL: presentQuantity (10) <= reorderAt (40) * 0.5 (20)
    unit: 'packets',
    type: 'Herb Seeds',
    monthlyUsage: 20,
    reorderAt: 40,
    category: CATEGORIES.SEEDS,
    expiryDate: future(8),
    location: 'Seed Storage Box',
    onsite: true,
  },
  {
    name: 'Squash Seeds',
    storedQuantity: 150,
    presentQuantity: 120,
    unit: 'packets',
    type: 'Vegetable Seeds',
    monthlyUsage: 25,
    reorderAt: 40,
    category: CATEGORIES.SEEDS,
    expiryDate: future(15),
    location: 'Seed Storage Box',
    onsite: true,
  },
  {
    name: 'Sunflower Seeds',
    storedQuantity: 80,
    presentQuantity: 60,
    unit: 'lbs',
    type: 'Oil Seeds',
    monthlyUsage: 10,
    reorderAt: 20,
    category: CATEGORIES.SEEDS,
    expiryDate: future(10),
    location: 'Seed Storage Box',
    onsite: true,
  },

  // ── CANNING SUPPLIES ──────────────────────────────────────────────────────
  {
    name: 'Mason Jars (16oz)',
    storedQuantity: 300,
    presentQuantity: 220,
    unit: 'units',
    type: 'Jars',
    monthlyUsage: 40,
    reorderAt: 60,
    category: CATEGORIES.CANNINGSUPPLIES,
    expiryDate: future(120),
    location: 'Canning Room Shelf 1',
    onsite: false,
  },
  {
    name: 'Pectin Powder',
    storedQuantity: 50,
    presentQuantity: 8, // LOW: presentQuantity (8) <= reorderAt (15)
    unit: 'lbs',
    type: 'Canning Additive',
    monthlyUsage: 5,
    reorderAt: 15,
    category: CATEGORIES.CANNINGSUPPLIES,
    expiryDate: future(9),
    location: 'Canning Supply Cabinet',
    onsite: false,
  },
  {
    name: 'Canning Salt',
    storedQuantity: 40,
    presentQuantity: 35,
    unit: 'lbs',
    type: 'Canning Additive',
    monthlyUsage: 5,
    reorderAt: 10,
    category: CATEGORIES.CANNINGSUPPLIES,
    expiryDate: future(48),
    location: 'Canning Supply Cabinet',
    onsite: false,
  },
  {
    name: 'Pressure Canner Gaskets',
    storedQuantity: 20,
    presentQuantity: 3, // CRITICAL: presentQuantity (3) <= reorderAt (10) * 0.5 (5)
    unit: 'units',
    type: 'Canning Equipment Parts',
    monthlyUsage: 2,
    reorderAt: 10,
    category: CATEGORIES.CANNINGSUPPLIES,
    expiryDate: future(24),
    location: 'Canning Room Shelf 2',
    onsite: false,
  },
  {
    name: 'Jar Lifter Tongs',
    storedQuantity: 6,
    presentQuantity: 6,
    unit: 'units',
    type: 'Canning Tools',
    monthlyUsage: 0,
    reorderAt: 2,
    category: CATEGORIES.CANNINGSUPPLIES,
    expiryDate: future(60),
    location: 'Canning Room Shelf 2',
    onsite: false,
  },
  {
    name: 'Vinegar (White)',
    storedQuantity: 60,
    presentQuantity: 45,
    unit: 'gallons',
    type: 'Canning Liquid',
    monthlyUsage: 8,
    reorderAt: 15,
    category: CATEGORIES.CANNINGSUPPLIES,
    expiryDate: future(24),
    location: 'Pantry Shelf 4',
    onsite: false,
  },

  // ── ANIMAL SUPPLIES ───────────────────────────────────────────────────────
  {
    name: 'Chicken Feed (Layer Pellets)',
    storedQuantity: 500,
    presentQuantity: 380,
    unit: 'lbs',
    type: 'Poultry Feed',
    monthlyUsage: 80,
    reorderAt: 100,
    category: CATEGORIES.ANIMALSUPPLIES,
    expiryDate: future(3),
    location: 'Feed Barn Bin 1',
    onsite: true,
  },
  {
    name: 'Goat Feed',
    storedQuantity: 300,
    presentQuantity: 25, // LOW: presentQuantity (25) <= reorderAt (50)
    unit: 'lbs',
    type: 'Livestock Feed',
    monthlyUsage: 60,
    reorderAt: 50,
    category: CATEGORIES.ANIMALSUPPLIES,
    expiryDate: future(2),
    location: 'Feed Barn Bin 2',
    onsite: true,
  },
  {
    name: 'Livestock Vitamins',
    storedQuantity: 40,
    presentQuantity: 5, // CRITICAL: presentQuantity (5) <= reorderAt (20) * 0.5 (10)
    unit: 'bottles',
    type: 'Animal Health',
    monthlyUsage: 5,
    reorderAt: 20,
    category: CATEGORIES.ANIMALSUPPLIES,
    expiryDate: future(6),
    location: 'Vet Supply Cabinet',
    onsite: true,
  },
  {
    name: 'Poultry Bedding (Straw)',
    storedQuantity: 200,
    presentQuantity: 160,
    unit: 'bales',
    type: 'Bedding',
    monthlyUsage: 30,
    reorderAt: 40,
    category: CATEGORIES.ANIMALSUPPLIES,
    expiryDate: future(6),
    location: 'Barn Storage',
    onsite: true,
  },
  {
    name: 'Animal Dewormer',
    storedQuantity: 20,
    presentQuantity: 15,
    unit: 'doses',
    type: 'Animal Health',
    monthlyUsage: 3,
    reorderAt: 5,
    category: CATEGORIES.ANIMALSUPPLIES,
    expiryDate: future(12),
    location: 'Vet Supply Cabinet',
    onsite: true,
  },
];

async function seed() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
    });
    console.log(`✅ Connected to MongoDB (${dbName} on ${cluster})`);

    const existing = await KIInventoryItem.countDocuments();
    if (existing > 0) {
      console.log(`⚠️  Collection already has ${existing} items. Clearing before re-seeding...`);
      await KIInventoryItem.deleteMany({});
      console.log('✅ Collection cleared.');
    }

    const inserted = await KIInventoryItem.insertMany(seedItems);
    console.log(`✅ Successfully seeded ${inserted.length} inventory items.`);

    // Quick stats summary
    const total = inserted.length;
    const critical = inserted.filter((i) => i.presentQuantity <= i.reorderAt * 0.5).length;
    const low = inserted.filter(
      (i) => i.presentQuantity <= i.reorderAt && i.presentQuantity > i.reorderAt * 0.5,
    ).length;
    const preserved = inserted.filter(
      (i) =>
        i.category === 'INGREDIENT' &&
        new Date(i.expiryDate) >= new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    ).length;

    console.log('\n📊 Seed Summary:');
    console.log(`   Total items   : ${total}`);
    console.log(`   Critical stock: ${critical}`);
    console.log(`   Low stock     : ${low}`);
    console.log(`   Preserved     : ${preserved} (ingredients expiring >= 1 year)`);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB.');
  }
}

seed();
