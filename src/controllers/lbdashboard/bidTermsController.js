const bidTermsController = function (BidTerms) {
  const postBidTerms = async (req, res) => {
    try {
      if (!req.body.paymentTerms) {
        return res.status(405).json({ error: 'paymentTerms should have a value' });
      }

      if (!req.body.cancellationPolicy) {
        return res.status(405).json({ error: 'cancellationPolicy should have a value' });
      }

      const newBidTerms = new BidTerms(req.body);
      const savedBidTerms = await newBidTerms.save();
      res.status(201).json(savedBidTerms);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };

  const deleteBidTerms = async function (req, res) {
    const { id } = req.params;
    BidTerms.findById(id, (error, record) => {
      if (error || !record || record === null || record.length === 0) {
        res.status(400).send({ error: 'No valid records found' });
        return;
      }

      const removeBidTerms = record.remove();

      Promise.all([removeBidTerms])
        .then(res.status(200).send({ message: ' BidTerms successfully deleted' }))
        .catch((errors) => {
          res.status(400).send(errors);
        });
    });
  };

  const inactiveBidTerms = async function (req, res) {
    const { id } = req.params;
    BidTerms.findByIdAndUpdate(id, { isActive: false }, (error, record) => {
      if (error || !record || record === null || record.length === 0) {
        res.status(400).send({ error: 'No valid records found' });
        return;
      }

      res.status(200).send({ message: ' BidTerms successfully deleted/inactivated' });
    });
  };

  const getBidTerms = async (req, res) => {
    try {
      BidTerms.findOne({ isActive: { $ne: false } })
        .select('paymentTerms cancellationPolicy -_id')
        .then((results) => {
          if (results === null) {
            return res.status(200).send('no record in BidTerms');
          }

          return res.status(200).send(results);
        })
        .catch((error) => {
          res.status(500).send({ error });
        });
    } catch (error) {
      console.log('error occurred in getting BidTerms');
    }
  };

  return { getBidTerms, postBidTerms, deleteBidTerms, inactiveBidTerms };
};

module.exports = bidTermsController;
