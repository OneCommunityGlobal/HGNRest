const express = require('express');

const routes = function (task, userProfile) {
  const controller = require('../controllers/taskController')(
    task,
    userProfile,
  );
  const wbsRouter = express.Router();

  wbsRouter
    .route('/tasks/:wbsId/:level/:mother')
    .get(controller.getTasks)
    .put(controller.fixTasks);

  wbsRouter
    .route('/task/:id')
    .post(controller.postTask)
    .get(controller.getTaskById);

  wbsRouter.route('/task/import/:id').post(controller.importTask);

  wbsRouter.route('/task/del/:taskId/:mother').post(controller.deleteTask);

  wbsRouter.route('/task/wbs/del/:wbsId').post(controller.deleteTaskByWBS);

  wbsRouter.route('/task/update/:taskId').put(controller.updateTask);

  wbsRouter
    .route('/task/delete/children/:taskId')
    .post(controller.updateChildrenQty);

  wbsRouter
    .route('/task/updateAllParents/:wbsId/')
    .put(controller.updateAllParents);

  wbsRouter.route('/tasks/swap/').put(controller.swap);

  wbsRouter.route('/tasks/update/num').put(controller.updateNum);

  wbsRouter.route('/tasks/moveTasks/:wbsId').put(controller.moveTask);

  wbsRouter.route('/tasks/userProfile').get(controller.getTasksByUserList);

  wbsRouter
    .route('/user/:userId/teams/tasks')
    .get(controller.getTasksForTeamsByUser);
  wbsRouter.route('/task/:taskId/:userId').post(controller.setFollowUp);

  return wbsRouter;
};

module.exports = routes;
