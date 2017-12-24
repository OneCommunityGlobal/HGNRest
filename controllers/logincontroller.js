let express = require('express');
let userprofile = require('../models/userProfile');
let bcrypt = require('bcryptjs');

let logincontroller = function(){

    let login = async function _login(req, res){

        console.log(`inside controller ${req.body}`);

        let _userName = req.body.userName;
        let _password = req.body.password;
        
        let user =  await userprofile.findOne({userName: _userName});

        if(!user)
        {
            res.send({message: "Invalid username and/ or password." }).status(401);
        }

       let isPasswordMatch =  await bcrypt.compare(_password, user.password);

       if(isPasswordMatch)
       {
           res.send(user).status(200);
       }
       else
       {
           res.send({message: "Invalid username and/ or password." }).status(401);
       }
     
        

        //res.send(user).status(200);
        };
    
        return{

            login: login
        };

};

module.exports = logincontroller;