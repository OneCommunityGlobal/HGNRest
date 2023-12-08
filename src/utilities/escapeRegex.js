
const escapeRegex = function (text) {
    return `^${text.replace(/[[\]{}()*+?.\\^$|]/g, '\\$&')}$`;
};

module.exports = escapeRegex;
