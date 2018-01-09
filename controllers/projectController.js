var projectController = function (project) {


  var getAllProjects = function (req, res) {

    project.find({})
      .then(results => res.send(results).status(200))
      .catch(error => res.send(error).status(404));

  };
  var postProject = function (req, res) {

    if(req.body.requestor.role !== "Administrator")
    {
      res.status(403).send("You are not authorized to create new projects.");
      return;
    }
    
    var _project = new project();

    _project.projectName = req.body.projectName;
    _project.isActive = req.body.isActive;

    _project.tasks = req.body.tasks;
    _project.createdDatetime = Date.now();
    _project.modifiedDatetime = Date.now();

        _project.save()
      .then(results => res.send(results).status(201))
      .catch(error => res.send(error).status(404));

  };

  var getProjectById = function (req, res) {

    var projectId = req.params.projectId;
  
       project.findById(projectId)
      .then(results => res.send(results).status(200))
      .catch(error => res.send(error).status(404));

  }

  return {
    getAllProjects: getAllProjects,
    postProject: postProject,
    getProjectById: getProjectById
  };

};


module.exports = projectController;
