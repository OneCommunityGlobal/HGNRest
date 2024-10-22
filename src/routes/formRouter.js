const express=require('express')

const routes=function(Form,formResponse){
    const controller=require('../controllers/formController')(Form,formResponse);
    const formRouter=express.Router();
    // route to create a new formc
    formRouter.route('/form/createform').post(controller.createForm);
    
    // route to get list of all forms
    formRouter.route('/form/allforms').get(controller.getAllForms);
    
    // route to add data to a form
    formRouter.route('/form/submit').post(controller.addDataToForm);
    
    // route to edit form format
    formRouter.route('/form/edit').post(controller.editFormFormat);
    
    // route to delete form format
    formRouter.route('/form/delete').delete(controller.deleteFormFormat);
    
    // route to check if user has responded to a specific form or not
    formRouter.route('/form/status').get(controller.checkForResponse);

    // route to get format for a form
    formRouter.route('/form/format/:id').get(controller.getFormFormat);
    
    // route to get form data for a specific form
    formRouter.route('/form/:id').get(controller.getFormData);


    return formRouter;
}

module.exports=routes;
// add a form, edit a form, delete a form, update a form format
// 