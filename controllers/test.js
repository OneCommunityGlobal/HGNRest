var express = require('express');
var moment = require('moment');
var userProject = require('../helpers/helperModels/userProjects');
var mongoose = require('mongoose');



var test = function (TimeEntry) {




  var getAllTimeEnteries = function (req, res) {

      TimeEntry.find(function (err, records) {

          if (err) {
              res.status(404).send(error);
          }
          else {

              var items = [];
              records.forEach(element => {

                  var timeentry = new TimeEntry();

                  timeentry.personId = element.personId;
                  timeentry.projectId = element.projectId;
                  timeentry.taskId = element.taskId;
                  timeentry.dateofWork = element.dateofWork;
                  timeentry.timeSpent = moment("1900-01-01 00:00:00").add(element.totalSeconds, 'seconds').format("HH:mm:ss");
                  timeentry.notes = element.notes;
                  timeentry.isTangible = element.isTangible;

                  items.push(timeentry);
              });
              res.json(items).status(200);
          }
      });
  };
    return {

        getAllTimeEnteries: getAllTimeEnteries

    };
};

module.exports = test;
