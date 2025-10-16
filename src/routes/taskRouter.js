const express = require('express');

const routes = function (task, userProfile) {
  const controller = require('../controllers/taskController')(task, userProfile);
  const taskRouter = express.Router();

  taskRouter
    .route('/tasks/:wbsId/:level/:mother')
    .get(controller.getTasks)
    .put(controller.fixTasks);

  taskRouter.route('/task/:id').post(controller.postTask).get(controller.getTaskById);

  taskRouter.route('/task/import/:id').post(controller.importTask);

  taskRouter.route('/task/del/:taskId/:mother').post(controller.deleteTask);

  taskRouter.route('/task/wbs/:wbsId').get(controller.getWBSId);

  taskRouter.route('/task/wbs/del/:wbsId').post(controller.deleteTaskByWBS);

  taskRouter.route('/task/update/:taskId').put(controller.updateTask);

  taskRouter.route('/task/updateStatus/:taskId').put(controller.updateTaskStatus);

  taskRouter.route('/task/updateAllParents/:wbsId/').put(controller.updateAllParents);

  taskRouter.route('/tasks/swap/').put(controller.swap);

  taskRouter.route('/tasks/update/num').put(controller.updateNum);

  taskRouter.route('/tasks/moveTasks/:wbsId').put(controller.moveTask);

  taskRouter.route('/tasks/user/:userId').get(controller.getTasksByUserId);

  taskRouter.route('/user/:userId/teams/tasks').get(controller.getTasksForTeamsByUser);

  taskRouter.route('/tasks/reviewreq/:userId').post(controller.sendReviewReq);

  // New routes for task change logs
  taskRouter.route('/task/:taskId/changeLogs').get(controller.getTaskChangeLogs);

  taskRouter.route('/user/:userId/taskChanges').get(controller.getUserTaskChangeLogs);

  return taskRouter;
};

module.exports = routes;
