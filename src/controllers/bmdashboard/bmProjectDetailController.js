const bmProjectDetailController = function (ProjectDetail) {
  const bmProjectDetails = async function _projDetail(req, res) {
    console.log(ProjectDetail);

    //projectId from the request parameters object
    const { projectId } = req.params;
    try {
      ProjectDetail
        .findById(projectId)
        .then(results => res.status(200).send(results))
        .catch(error => res.status(500).send(error));
    } catch (err) {
      res.json(err);
    }
  };

  return { bmProjectDetails };
};

module.exports = bmProjectDetailController;
