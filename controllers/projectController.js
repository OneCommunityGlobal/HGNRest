var projectController = function (project) {


  var getAllProjects = function (req, res) {

    project.find({}, 'projectName isActive tasks')
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));

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
      .then(results => res.status(201).send(results._id))
      .catch(error => res.status(404).send(error));

  };


  var putProject = function (req, res) {

    if(req.body.requestor.role !== "Administrator")
    {
      res.status(403).send("You are not authorized to create new projects.");
      return;
    }

    var projectId = req.params.projectId;
    
    project.findById(projectId, function(error, record){

      if(error || record ==null )
      {
        res.status(400).send("No valid records found");
        return;
      }

      record.projectName = req.body.projectName;
      record.isActive = req.body.isActive;
  
      record.tasks = req.body.tasks;
      record.createdDatetime = Date.now();
      record.modifiedDatetime = Date.now();
  
      record.save()
        .then(results => res.status(201).send(results._id))
        .catch(error => res.status(400).send(error));

    }
  
  );



   

  };


  var getProjectById = function (req, res) {

    var projectId = req.params.projectId;
  
       project.findById(projectId, '-__v  -createdDatetime -modifiedDatetime')
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));

  };

  return {
    getAllProjects: getAllProjects,
    postProject: postProject,
    getProjectById: getProjectById,
    putProject: putProject
  };

};


module.exports = projectController;
