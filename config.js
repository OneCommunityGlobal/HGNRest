var config = {};

config.JWT_SECRET = "hgndata";
config.REQUEST_AUTHKEY = "Authorization";
config.TOKEN = {
    "Lifetime" :10,
    "Units" : "days"// Choose from years, quarters, months,weeks, days,hours, minutes,seconds, milliseconds
};
    

module.exports = config;