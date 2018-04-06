var config = {};

config.JWT_SECRET = "hgndata";
config.REQUEST_AUTHKEY = "Authorization";
config.TOKEN = {
    "Lifetime": 10,
    "Units": "days"// Choose from years, quarters, months,weeks, days,hours, minutes,seconds, milliseconds
};
config.JWT_HEADER = {
    "alg": "RS256",
    "typ": "JWT"
};


module.exports = config;