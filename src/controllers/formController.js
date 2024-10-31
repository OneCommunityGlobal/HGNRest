const userprofile=require('../models/userProfile');

const formController = function (Form,formResponse) {
    // creating a new form
    const createForm =async function (req,res) {
        try {
            const { formName, questions, createdBy } = req.body;
        
            // Check if required fields are present
            if (!formName || !questions || questions.length === 0) {
                return res.status(400).json({ message: 'Form name and questions are required.' });
            }
        
            // Create a new form with the provided structure
            const newForm = new Form({
                formName,
                questions,
                createdBy,
            });
        
            // Save the form in the database
            const savedForm = await newForm.save();
        
            // Generate a unique link to the form
            const formLink = `/forms/${savedForm.formID}`;
        
            return res.status(201).json({
                message: 'Form created successfully',
                formID: savedForm.formID,
                id:savedForm._id,
                formLink: "hostname"+formLink,
            });
            } catch (error) {
            console.error('Error creating form:', error);
            return res.status(500).json({ message: 'Server error, could not create form.' });
            }
    }

    const editFormFormat = async function(req,res){
        try{
            // here id is the recordId for the model Form
            const {id, userId, formName,formQuestions }=req.body;
            // find if a form exists or not. if yes, then take the properties we want to update and then
            // check if that form exists or not and then user exists or not.

            // match by record _id
            let form_temp=await Form.findById(id)
            
            if(form_temp===undefined || form_temp===null || form_temp.length===0){
               return res.status(400).json({message:"Invalid FormID"}) 
            }

            let user_temp=await userprofile.findById(userId)
            if(user_temp.isActive ===false || user_temp===undefined || user_temp === null){
                return res.status(400).json({message:"Invalid userid"})
            }

            let result=await Form.updateOne({_id:id} , {$set : { formName : formName, questions : formQuestions }});

            return res.status(200).json({message:"Form Updated"})
        }catch(err){
            return res.status(404).json({message:err.message})
        }
    }

    const deleteFormFormat = async function(req,res){
        try {
            // here id is the record Id of the form.
            const {id}=req.body;
            let result=await Form.deleteOne({ _id : id});
            // Check if the form was actually deleted
            if (result.deletedCount === 0) {
                return res.status(400).json({ message: 'Error removing Form.' });
            }
            return res.status(200).json({message:"Form Deleted Successfully"})
        }catch(error){
            return res.status(400).json({message:"Error removing Form."})
        }
    }

    // check if a user has already responded to a form or not.
    const checkForResponse = async function(req,res)  {
        try{
            const {formID,userID}=req.query;
            let result=await formResponse.find({formID:formID,submittedBy:userID})
            if(result.length==0){
                return res.status(400).json({message:"No records Found"});
            }
            return res.status(200).json({message:result})
        }catch(error){
            return res.status(404).json({message:"Error Searching for Recods"})
        }
    }

    const getFormData =async function (req,res) {
        try {
            const  formID  = req.params.id;
            
            // Check if formID is provided
            if (!formID) {
              return res.status(400).json({ message: 'Form ID is required.' });
            }
        
            // Check if the form exists
            const form = await Form.findOne({ formID });
            if (!form || form.length===0) {
              return res.status(404).json({ message: 'Form not found.' });
            }
        
            // Fetch all responses associated with the formID
            const responses = await formResponse.find({ formID });
        
            // If no responses found, return a message
            if (responses.length === 0) {
              return res.status(404).json({ message: 'No responses found for this form.' });
            }
        
            return res.status(200).json({
              message: 'Responses retrieved successfully',
              formID: formID,
              formName: form.formName,
              responses: responses,
            });

          } catch (error) {
            console.error('Error fetching form responses:', error);
            return res.status(500).json({ message: 'Server error, could not fetch form responses.' });
          }
    }
    const addDataToForm =async function (req,res) {
        try {
            const { formID, responses, submittedBy } = req.body;
            // here we also need to send which user made that so 
            // Check if the formID and responses are provided
            if (!formID || !responses || responses.length === 0) {
              return res.status(400).json({ message: 'Form ID and responses are required.' });
            }
            // condition to check that a user is linked to the form when submitted.
            if(!submittedBy){
                return res.status(400).json({message:'User id is required to submit this form.'})
            }
            
            // Check if the form exists
            const form = await Form.findOne({ formID });
            if (!form) {
              return res.status(404).json({ message: 'Form not found.' });
            }
            // check if userexists or not.
            let result=await userprofile.find({_id:submittedBy})
            if(result[0].isActive === false || result===undefined || result === null || result.length===0){
                return res.status(400).json({message: 'Invalid User'});
            }
            // Create a new form response
            const formResponses = new formResponse({
              formID,
              responses,
              submittedBy: submittedBy || 'Anonymous',
            });
        
            // Save the response in the database
            const savedResponse = await formResponses.save();
        
            return res.status(201).json({
              message: 'Form response submitted successfully',
              responseID: savedResponse._id,
            });
          } catch (error) {
            console.error('Error submitting form response:', error);
            return res.status(500).json({ message: 'Server error, could not submit form response.' });
          }
    }

    const getAllForms = async (req,res)=>{
        try{
            const result=await Form.find({})
            return res.status(200).json({data:result})
        }catch(err){
            return res.status(404).json({error:err})
        }
    }

    const getFormFormat = async (req,res)=>{
        try{
            // const formID=req.params.id;
            const {formID, userId}=req.body;
            
            const result=await Form.find({formID})
            if (!result || result.length===0) {
              return res.status(404).json({ message: 'Form not found.' });
            }

            let user=await userprofile.find({_id:userId})
            if(user[0].isActive === false || user===undefined || user === null || user.length===0){
                return res.status(400).json({message: 'Invalid User'});
            }
            return res.status(200).json({data:result})
        }catch(err){
            return res.status(404).json({data:err})
        }
    }
    return {
        createForm,
        getFormData,
        addDataToForm,
        getAllForms,
        getFormFormat,
        editFormFormat,
        deleteFormFormat,
        checkForResponse
    }
};

module.exports = formController;