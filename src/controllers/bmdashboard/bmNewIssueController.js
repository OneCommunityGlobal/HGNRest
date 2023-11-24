// potentially inteacting with monoose db
// const mongoose = require('mongoose');

// local dummy data just for testing:
const newIssueList = [
  {
    id: '01',
    date: '01/01/2024',
    type: 'Safety',
    consequence: 'MET Damage/Waste',
    resolved: true,
    description:
      'MET damage/waste in building construction jeopardizes environments, risking ecological and human well-being.',
  },
  {
    id: '02',
    date: '01/01/2024',
    type: 'Safety',
    consequence: 'MET Damage/Waste',
    resolved: true,
    description:
      'MET damage/waste in building construction jeopardizes environments, risking ecological and human well-being.',
  },
  {
    id: '03',
    date: '01/01/2024',
    type: 'Safety',
    consequence: 'MET Damage/Waste',
    resolved: true,
    description:
      'MET damage/waste in building construction jeopardizes environments, risking ecological and human well-being.',
  },
];

const bmNewIssueController = () => {
  const bmPostIssueList = async (req, res) => {
    try {
      newIssueList.push(req.body);
      res.status(200).send(newIssueList);
    } catch (err) {
      res.status(500).send({ err });
    }
  };
  const bmGetIssueList = async (req, res) => {
    try {
      res.status(200).send(newIssueList);
    } catch (err) {
      res.json(err);
    }
  };
  return {
    bmPostIssueList,
    bmGetIssueList,
  };
};

module.exports = bmNewIssueController;
