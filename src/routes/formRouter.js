const express=require('express')

const routes=function(Form,formResponse){
    const controller=require('../controllers/formController')(Form,formResponse);
    const formRouter=express.Router();
    
    
    formRouter.route('/form')
    .post(controller.createForm) // route to create a new form
    .get(controller.getAllForms) // route to get list of all forms
    .get(controller.getFormFormat) // route to get format for a format
    .put(controller.editFormFormat) // route to edit form format
    .delete(controller.deleteFormFormat); // route to delete form format
    
    // route to add data to a form
    formRouter.route('/form/response')
    .post(controller.addDataToForm) // route to add data to a form
    .get(controller.getFormData); // route to get form data for a specific form
    
    // route to check if user has responded to a specific form or not
    formRouter.route('/form/status').get(controller.checkForResponse);

    return formRouter;
}

module.exports=routes;
// add a form, edit a form, delete a form, update a form format
// 