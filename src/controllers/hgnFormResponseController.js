const FormResponse= require('../models/hgnFormResponse');

const hgnFormController = function (){
    const submitFormResponse=async function(req, res){
        const {userInfo, general, frontend, backend, followUp, user_id}=req.body;
        if (!userInfo || !general || !frontend || !backend || !followUp || !user_id) {
            return res
            .status(400)
            .json({ error: "All fields (userInfo, general, frontend, backend) are required" });
        }
        try {
            const formResponse = new FormResponse({ userInfo, general, frontend, backend, followUp, user_id });
            await formResponse.save();
            res.status(201).json(formResponse);
        } catch (err) {
            res
            .status(500)
            .json({ error: "Failed to create formResponse: " + err.message });
        }
    };

    const getAllFormResponses=async function(req, res){
        try {
            const formResponses = await FormResponse.find();
            res.json(formResponses);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    };

    return {
        submitFormResponse,
        getAllFormResponses
    }
}
module.exports = hgnFormController;