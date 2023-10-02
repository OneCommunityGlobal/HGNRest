const bmMaterialsController = function () {
  const bmMaterialsList = async function _matsList(req, res) {
    try {
      return res.json({ message: "Hello World" })
    } catch (err) {
      res.json(err);
    }
  };
  return { bmMaterialsList };
};

module.exports = bmMaterialsController;