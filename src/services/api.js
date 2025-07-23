import axios from 'axios';

const api = axios.create({
    baseURL: "https://graph.facebook.com/v19.0/",
    headers: {
        'Content-Type': 'application/json'
    }
});

export default api;