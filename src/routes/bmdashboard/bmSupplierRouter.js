const express = require('express');
const {
  getSuppliers,
  createSupplier,
} = require('../../controllers/bmdashboard/bmSupplierController');

const router = express.Router();

const authorizeSupplierCreation = (req, res, next) => {
  const allowedRoles = ['Owner', 'Administrator'];

  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      message: 'Only Owners and Administrators can create suppliers',
    });
  }

  return next();
};

router.get('/suppliers', getSuppliers);
router.post('/suppliers', authorizeSupplierCreation, createSupplier);

module.exports = router;
