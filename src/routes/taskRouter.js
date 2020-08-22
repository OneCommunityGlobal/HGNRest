const express = require('express');


const routes = function (task) {
  const controller = require('../controllers/taskController')(task);
  const wbsRouter = express.Router();

  wbsRouter.route('/tasks/:wbsId')
    .get(controller.getTasks)
    .put(controller.fixTasks);

  wbsRouter.route('/task/:id')
    .post(controller.postTask)
    .put(controller.importTask)
    .get(controller.getTaskById);

  wbsRouter.route('/task/del/:taskId')
    .delete(controller.deleteTask);

  wbsRouter.route('/task/wbs/del/:wbsId')
    .delete(controller.deleteTaskByWBS);

  wbsRouter.route('/task/update/:taskId')
    .put(controller.updateTask);

  wbsRouter.route('/task/updateAllParents/:wbsId/')
    .put(controller.updateAllParents);

  wbsRouter.route('/tasks/swap/')
    .put(controller.swap);

  wbsRouter.route('/tasks/update/num')
    .put(controller.updateNum);

  wbsRouter.route('/tasks/moveTasks/:wbsId')
    .put(controller.moveTask);


  return wbsRouter;
};

module.exports = routes;
