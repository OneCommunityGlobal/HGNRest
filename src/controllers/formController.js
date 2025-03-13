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
            
            // check if form already exists or not
            let form_temp=await Form.find({formName:formName})
            if(form_temp.length>0){return res.status(400).json({message:"Form already exists with that name"})}
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

    const editFormFormat = async function (req, res) {
        try {
            const { id, userId, formName, formQuestions } = req.body;
    
            // Fetch the existing form
            const existingForm = await Form.findById(id);
            if (!existingForm) {
                return res.status(400).json({ message: "Invalid Form ID" });
            }
    
            // Check if user exists and is active
            const user_temp = await userprofile.findById(userId);
            if (!user_temp || user_temp.isActive === false) {
                return res.status(400).json({ message: "Invalid or inactive user ID" });
            }
    
            let updateData = {};
    
            // Check if the form name is actually changing
            if (formName && formName !== existingForm.formName) {
                updateData.formName = formName;
            }
    
            // Validate and compare formQuestions before updating
            if (formQuestions) {
                if (!Array.isArray(formQuestions) || formQuestions.length === 0) {
                    return res.status(400).json({ message: "Questions must be a non-empty array" });
                }
    
                let isDifferent = false;
                let newQuestions = [];
    
                for (let question of formQuestions) {
                    if (!question.label || typeof question.label !== "string") {
                        return res.status(400).json({ message: "Each question must have a valid 'label' of type string" });
                    }
    
                    if (!question.type || typeof question.type !== "string") {
                        return res.status(400).json({ message: "Each question must have a valid 'type' of type string" });
                    }
    
                    if (["radio", "checkbox"].includes(question.type)) {
                        if (!Array.isArray(question.options) || question.options.length === 0) {
                            return res.status(400).json({ message: `Question of type '${question.type}' must have a non-empty options array` });
                        }
    
                        for (let option of question.options) {
                            if (typeof option !== "string" || option.trim() === "") {
                                return res.status(400).json({ message: "Each option must be a valid non-empty string" });
                            }
                        }
                    }
    
                    // Check if this question already exists in the database
                    let existingQuestion = existingForm.questions.find(q => q.label === question.label);
    
                    if (!existingQuestion || JSON.stringify(existingQuestion.options) !== JSON.stringify(question.options)) {
                        isDifferent = true; // Mark as different if any question changes
                    }
    
                    newQuestions.push(question);
                }
    
                // Only update if something actually changed
                if (isDifferent) {
                    updateData.questions = newQuestions;
                }
            }
    
            // If there's nothing to update, return early
            if (Object.keys(updateData).length === 0) {
                return res.status(200).json({ message: "No changes detected" });
            }
    
            // Update the form
            await Form.updateOne({ _id: id }, { $set: updateData });
    
            return res.status(200).json({ message: "Form Updated Successfully" });
    
        } catch (err) {
            console.error("Error updating form:", err);
            return res.status(500).json({ message: "Internal Server Error", error: err.message });
        }
    };  

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
            const  formID  = req.query.formID;
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
   
    const addDataToForm = async function (req, res) {
        try {
            const { formID, responses, submittedBy } = req.body;
    
            // Ensure all required fields are present
            if (!formID || !responses || responses.length === 0) {
                return res.status(400).json({ message: 'Form ID and responses are required.' });
            }
            if (!submittedBy) {
                return res.status(400).json({ message: 'User ID is required to submit this form.' });
            }
    
            // Check if the form exists
            const form = await Form.findOne({ formID });
            if (!form) {
                return res.status(404).json({ message: 'Form not found.' });
            }
    
            // Check if user exists and is active
            const user = await userprofile.findById(submittedBy);
            if (!user || user.isActive === false) {
                return res.status(400).json({ message: 'Invalid or inactive user.' });
            }
    
            // Validate responses against the form questions
            if (!Array.isArray(responses)) {
                return res.status(400).json({ message: 'Responses must be an array.' });
            }
    
            const formQuestions = form.questions;
            if (responses.length !== formQuestions.length) {
                return res.status(400).json({ message: 'Number of responses does not match the number of form questions.' });
            }
    
            const validatedResponses = [];
    
            for (let i = 0; i < responses.length; i++) {
                const question = formQuestions[i];
                const response = responses[i];
    
                // Ensure response has the required label and value
                if (!response.questionLabel || response.answer === undefined) {
                    return res.status(400).json({ message: `Response for question "${question.label}" is incomplete.` });
                }
    
                // Ensure response label matches the expected question label
                if (response.questionLabel !== question.label) {
                    return res.status(400).json({ message: `Invalid question label: Expected "${question.label}", got "${response.questionLabel}".` });
                }
    
                // Validate response based on question type
                if (question.type === 'radio') {
                    if (typeof response.answer !== 'string') {
                        return res.status(400).json({ message: `Response for "${question.label}" must be a single string value.` });
                    }
                    if (!question.options.includes(response.answer)) {
                        return res.status(400).json({ message: `Invalid response for "${question.label}". Expected one of: ${question.options.join(', ')}` });
                    }
                } else if (question.type === 'checkbox') {
                    if (!Array.isArray(response.answer)) {
                        return res.status(400).json({ message: `Response for "${question.label}" must be an array of selected options.` });
                    }
                    if (response.answer.length === 0) {
                        return res.status(400).json({ message: `At least one option must be selected for "${question.label}".` });
                    }
                    const invalidOptions = response.answer.filter(option => !question.options.includes(option));
                    if (invalidOptions.length > 0) {
                        return res.status(400).json({ message: `Invalid options selected for "${question.label}": ${invalidOptions.join(', ')}` });
                    }
                } else if (question.type === 'text') {
                    if (typeof response.answer !== 'string' || response.answer.trim() === '') {
                        return res.status(400).json({ message: `Response for "${question.label}" must be a non-empty text string.` });
                    }
                } else {
                    return res.status(400).json({ message: `Invalid question type: "${question.type}"` });
                }
    
                // Push the validated response into the validatedResponses array
                validatedResponses.push({
                    questionLabel: response.questionLabel,
                    answer: response.answer,
                });
            }
    
            // Create and save the valid response
            const formResp = new formResponse({
                formID,
                responses: validatedResponses,
                submittedBy,
            });
    
            const savedResponse = await formResp.save();
    
            return res.status(201).json({
                message: 'Form response submitted successfully',
                responseID: savedResponse._id,
            });
    
        } catch (error) {
            console.error('Error submitting form response:', error);
            return res.status(500).json({ message: 'Server error, could not submit form response.' });
        }
    };
    

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
            console.log(formID)
            console.log(userId);
            const result=await Form.find({formID})
            console.log(result)
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