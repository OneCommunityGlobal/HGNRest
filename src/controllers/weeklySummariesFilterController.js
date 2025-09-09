module.exports = () => ({
  getFilters: async (req, res) => {
    console.log('Inside the function');
    return res.json('Hello World');
  },
});
