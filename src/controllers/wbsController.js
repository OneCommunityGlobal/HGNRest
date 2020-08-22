
const wbsController = function (WBS) {
  const getAllWBS = function (req, res) {
    WBS.find(
      { projectId: { $in: [req.params.projectId] } },
      'wbsName isActive',
    )
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));
  };

  const postWBS = function (req, res) {
    if (req.body.requestor.role !== 'Administrator') {
      res.status(403).send({ error: 'You are not authorized to create new projects.' });
      return;
    }

    if (!req.body.wbsName || !req.body.isActive) {
      res.status(400).send({ error: 'WBS Name and active status are mandatory fields' });
      return;
    }

    const _wbs = new WBS();
    _wbs.projectId = req.params.id;
    _wbs.wbsName = req.body.wbsName;
    _wbs.isActive = req.body.isActive;
    _wbs.createdDatetime = Date.now();
    _wbs.modifiedDatetime = Date.now();

    _wbs.save()
      .then(results => res.status(201).send(results))
      .catch(error => res.status(500).send({ error }));
  };

  const deleteWBS = function (req, res) {
    if (req.body.requestor.role !== 'Administrator') {
      res.status(403).send({ error: 'You are  not authorized to delete projects.' });
      return;
    }
    const { id } = req.params;
    WBS.findById(id, (error, record) => {
      if (error || !record || (record === null) || (record.length === 0)) {
        res.status(400).send({ error: 'No valid records found' });
        return;
      }

      const removeWBS = record.remove();

      Promise.all([removeWBS])
        .then(res.status(200).send({ message: ' WBS successfully deleted' }))
        .catch((errors) => { res.status(400).send(errors); });
    }).catch((errors) => { res.status(400).send(errors); });
  };


  return {
    postWBS,
    deleteWBS,
    getAllWBS,
  };
};


module.exports = wbsController;
