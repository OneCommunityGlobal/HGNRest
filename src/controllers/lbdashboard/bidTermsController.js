const bidTermsController = function (BidTerms) {
  // const getBiddingTerms = function (req, res) {
  const getBidTerms = async (req, res) => {
    try {
      console.log('inside getBidTerms');
      BidTerms.findOne({ isActive: { $ne: false } })
        .select('content cancellationPolicy -_id')
        .then((results) => {
          console.log('results fetched ');
          res.status(200).send(results);
        })
        .catch((error) => {
          console.log('error');
          res.status(500).send({ error });
        });
    } catch (error) {
      console.log('error occured');
    }
  };

  return { getBidTerms };
};

module.exports = bidTermsController;
