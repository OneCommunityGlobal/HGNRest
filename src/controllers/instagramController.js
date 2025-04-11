const path = require('path');
const fs = require('fs');
const axios = require('axios');
require ('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const getInstagram = async (req, res) => {
    try {
        console.log('Instagram API called');
        res.status(200).send('Instagram API called');
    } catch (error) {
        console.error('Error fetching Instagram data:', error);
        res.status(500).send('Internal Server Error');
    }
};

const getInstagramCallback = async (req, res) => {
    try {
        console.log('Instagram callback called');
        const { code } = req.query;
        res.status(200).send('Instagram callback called');
    } catch (error) {
        console.error('Error fetching Instagram data:', error);
        res.status(500).send('Internal Server Error');
    }
};

module.exports = {
    getInstagram,
};