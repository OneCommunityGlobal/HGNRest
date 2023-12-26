const titlecontroller = function (Title) {
  const getAllTitles = function (req, res) {
    Title.find({})
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));
};

  const getTitleById = function (req, res) {
    const { titleId } = req.params;

    Title.findById(titleId)
      .then(results => res.send(results))
      .catch(error => res.send(error));
  };

  const postTitle = async function (req, res) {
    const title = new Title();

    title.titleName = req.body.titleName;
    title.teamCode = req.body.teamCode;
    title.projectAssigned = req.body.projectAssigned;
    title.mediaFolder = req.body.mediaFolder;
    title.teamAssiged = req.body.teamAssiged;
    // get the shortname
    const shortnames = title.titleName.split(' ');
    const shortname = (shortnames[0][0] + shortnames[1][0]).toUpperCase();

    title.shortName = shortname;

    title
      .save()
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));
  };

  const deleteTitleById = async function (req, res) {
    const { titleId } = req.params;
    Title.deleteOne({ _id: titleId })
      .then(result => res.send(result))
      .catch(error => res.send(error));
  };


  return {
    getAllTitles,
    getTitleById,
    postTitle,
    deleteTitleById,
  };
};

module.exports = titlecontroller;
