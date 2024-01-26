const mongoose = require('mongoose');

const { Schema } = mongoose;

const capitalizeString = (s) => {

    if (typeof s !== 'string') {
        return s;
    }
    const words = s.split(' ');
    const capitalizedWords = words.map(word => {
      if (word.length > 0) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      } else {
        return '';
      }
    });
    const capitalizedString = capitalizedWords.join(' ');
    return capitalizedString;
}

const mapLocation = new Schema({
    title: {
        type: String,
        default: 'Prior to HGN Data Collection',
    },
    firstName: String,
    lastName: String,
    jobTitle: String,
    isActive: {
        type: Boolean,
        default: false,
    },
    location: {
        userProvided: {
            type: String,
            required: true,
        },
        coords: {
            lat: {
                type: String,
                required: true,
            },
            lng: {
                type: String,
                required: true,
            },
        },
        country: {
            type: String,
            required: true,
        },
        city: {
            type: String,
            default: '',
        },
    },
});

mapLocation.pre('save', function (next) {
    this.firstName = capitalizeString(this.firstName);
    this.lastName = capitalizeString(this.lastName);
    this.jobTitle = capitalizeString(this.jobTitle);
    this.location.userProvided = capitalizeString(this.location.userProvided);
    next();
});

module.exports = mongoose.model('MapLocation', mapLocation, 'maplocations');
