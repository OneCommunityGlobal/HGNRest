var dummydata = function insertDummyData() {
  const errFunc = (collectionName) => {
    return (err) => {
      if (err) throw err;
      else console.log(`${collectionName} inserted...`)
    }
  }

  Timelog.find({}, function (err, docs) {

    if (err) {
      console.log(err)
    } else {
      if (docs && docs.length == 0) {
        let t = new Timelog({
          createDate: '2017-04-06',
          lastModifyDate: '2017-05-06',
          totalSeconds: 60 * 60,
          tangile: true,
          workCompleted: 'Working on really great things.',
          project: 'hgn',
          task: 'Models for Mongo.'
        })
        t.save(errFunc('timelog'))
      }
    }
  })

  Profile.find({}, function (err, docs) {
    if (err) {
      console.log(err)
    } else {
      if (docs && docs.length == 0) {
        let p = new Profile({
          "_id": "58f91d30b4c403d02cddd23d",
          "about": "A moment of Silence!",
          "comitted_hours": "22",
          "created": "2017-04-20T23:03:36.778Z",
          "email": "anil.amf237@gmail.com",
          "estimated_tenure": "2017-04-20T23:03:36.778Z",
          "avatar": "",
          "facebook": "https://www.linkedin.com/in/ak-malla",
          "linkedin": "https://www.linkedin.com/in/ak-malla",
          "name": "Anil Kumar, Malla",
          "phone": "9999999999"
        })

        p.save(errFunc('profile'))
      }
    }
  })
}


module.exports = dummydata;
