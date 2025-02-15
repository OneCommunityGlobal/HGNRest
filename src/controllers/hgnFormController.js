const Question = require("../models/hgnform");
const {formquestions}=require('../utilities/hgnformQuestions')

const checkAndPopulateCollection=async () =>{
    try {
    // Check if the collection exists and has any documents
    const count = await Question.countDocuments();
    if (count === 0) {
        // Insert data into the collection
        await Question.insertMany(formquestions);
    }
    } catch (error) {
    console.error('Error checking or inserting data:', error);
    }
}
const hgnFormController = function (){
    // Function to check and insert data into the collection
    const getQuestions=async function(req, res){
      try {
        await checkAndPopulateCollection();
          const { page, title } = req.query; // Retrieve query parameters
          const query = {};
          
          if (page) query.page = Number(page); // Add page filter if provided
          if (title) query.title = title; // Add title filter if provided
      
          const questions = await Question.find(query); // Fetch matching questions
          res.json(questions);
        } catch (err) {
          console.log(err)
          res.status(500).json({ error: err.message });
        }
    }

    const createQuestion=async function(req, res){
        const { text, page, title } = req.body;
        if (!text || !page || !title) {
            return res
            .status(400)
            .json({ error: "All fields (text, page, title) are required" });
        }

        try {
            const question = new Question({ text, page, title });
            await question.save();
            res.status(201).json(question);
        } catch (err) {
            res
            .status(500)
            .json({ error: "Failed to create question: " + err.message });
        }
    }

    const updateQuestion=async function(req, res){
        const { text, page, title } = req.body;
    
        try {
        const updatedQuestion = await Question.findByIdAndUpdate(
            req.params.id,
            { text, page, title },
            { new: true }
        );
    
        if (!updatedQuestion) {
            return res.status(404).json({ error: "Question not found" });
        }
    
        res.json(updatedQuestion);
        } catch (err) {
        res
            .status(500)
            .json({ error: "Failed to update question: " + err.message });
        }
    }
    const deleteQuestion=async function(req, res){
        try {
        const deletedQuestion = await Question.findByIdAndDelete(req.params.id);
    
        if (!deletedQuestion) {
            return res.status(404).json({ error: "Question not found" });
        }
    
        res.json({ message: "Question deleted successfully" });
        } catch (err) {
        res
            .status(500)
            .json({ error: "Failed to delete question: " + err.message });
        }
    }
    return {
        getQuestions,
        createQuestion,
        updateQuestion,
        deleteQuestion,
        
    };
}
module.exports = hgnFormController;