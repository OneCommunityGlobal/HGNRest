
const mouseoverTextController = (function (MouseoverText) {
    const createMouseoverText = function (req, res) {
        const newMouseoverText = new MouseoverText();
        newMouseoverText.mouseoverText = req.body.newMouseoverText;
        newMouseoverText.save().then(() => res.status(201).json({
            _serverMessage: 'MouseoverText succesfuly created!',
            mouseoverText: newMouseoverText,
        })).catch(err => res.status(500).send({ err }));
    };

    const getMouseoverText = function (req, res) {
        MouseoverText.find()
            .then(results => res.status(200).send(results))
            .catch(error => res.status(404).send(error));
    };

    const updateMouseoverText = function (req, res) {
        // if (req.body.requestor.role !== 'Owner') {
        //     res.status(403).send('You are not authorized to update mouseoverText!');
        // }
        const { id } = req.params;

        return MouseoverText.findById(id, (error, mouseoverText) => {
            if (error || mouseoverText === null) {
                res.status(500).send('MouseoverText not found with the given ID');
                return;
            }

            mouseoverText.mouseoverText = req.body.newMouseoverText;
            mouseoverText.save()
                .then(results => res.status(201).send(results))
                .catch(errors => res.status(400).send(errors));
        });
    };

    return {
        createMouseoverText,
        getMouseoverText,
        updateMouseoverText,
    };
});

module.exports = mouseoverTextController;
