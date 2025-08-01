const WeeklySummaryEmailAssignmentController = function (WeeklySummaryEmailAssignment, userProfile) {
    const getWeeklySummaryEmailAssignment = async function (req, res) {
      try {
        const assignments = await WeeklySummaryEmailAssignment.find().populate('assignedTo').exec();
        res.status(200).send(assignments);
      } catch (error) {
        res.status(500).send(error);
      }
    };
  
    const setWeeklySummaryEmailAssignment = async function (req, res) {
      try {
        const { email } = req.body;
  
        if (!email) {
          res.status(400).send('bad request');
          return;
        }
  
        const user = await userProfile.findOne({ email });
        if (!user) {
          return res.status(400).send('User profile not found');
        }
  
        const newAssignment = new WeeklySummaryEmailAssignment({
          email,
          assignedTo: user._id,
        });
  
        await newAssignment.save();
        const assignment = await WeeklySummaryEmailAssignment.find({ email }).populate('assignedTo').exec();
  
        res.status(200).send(assignment[0]);
      } catch (error) {
        res.status(500).send(error);
      }
    };
  
    const deleteWeeklySummaryEmailAssignment = async function (req, res) {
      try {
        const { id } = req.params;
  
        if (!id) {
          res.status(400).send('bad request');
          return;
        }
  
        const deletedAssignment = await WeeklySummaryEmailAssignment.findOneAndDelete({ _id: id });
        if (!deletedAssignment) {
          res.status(404).send('Assignment not found');
          return;
        }
  
        res.status(200).send({ id });
      } catch (error) {
        res.status(500).send(error);
      }
    };

    const updateWeeklySummaryEmailAssignment = async function (req, res) {
      try{
        const { id } = req.params;
        const { email } = req.body;
        
        if (!id || (!email)) {
          res.status(400).send('bad request');
          return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            error: 'Invalid email format'
          });
        }
        
        const updateAssignment = await WeeklySummaryEmailAssignment.findOneAndUpdate(
          { _id: id },
          { 
            email,
          },
          {
            new: true
          }
        );
        
        if (!updateAssignment) {
          res.status(404).send('Assignment not found');
          return;
        }
        
        res.status(200).send(updateAssignment);

      } catch (error) {
        res.status(500).send(error);
      }
    };
  
    return {
      getWeeklySummaryEmailAssignment,
      setWeeklySummaryEmailAssignment,
      deleteWeeklySummaryEmailAssignment,
      updateWeeklySummaryEmailAssignment
    };
  };
  
  module.exports = WeeklySummaryEmailAssignmentController;
  