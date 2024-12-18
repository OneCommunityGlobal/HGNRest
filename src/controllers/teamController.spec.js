const Team = require('../models/team');
const teamController = require('./teamController');
const { mockReq, mockRes, assertResMock } = require('../test');
const helper = require('../utilities/permissions');

const makeSut = () => {
    const { postTeam } = teamController(Team);
    return {
        postTeam,
    };
};

jest.mock('../utilities/permissions', () => ({
    hasPermission: jest.fn(),
}));

const mockHasPermission = (value) =>
    jest.spyOn(helper, 'hasPermission').mockImplementationOnce(() => Promise.resolve(value));

const flushPromises = () => new Promise(setImmediate);

describe('teamController', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('postTeam', () => {
        test('Returns 403 - the requestor lacks `postTeam` permission.', async () => {
            const { postTeam } = makeSut();
            const hasPermissionSpy = mockHasPermission(false);
            const response = await postTeam(mockReq, mockRes);

            expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'postTeam');
            assertResMock(403, { error: 'You are not authorized to create teams.' }, response, mockRes);
        });

        test('Returns 403 - a team with the same name already exists.', async () => {
            const { postTeam } = makeSut();
            jest.spyOn(Team, 'exists').mockResolvedValue(true);
            const hasPermissionSpy = mockHasPermission(true);
            const response = await postTeam(mockReq, mockRes);

            expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'postTeam');
            expect(Team.exists).toHaveBeenCalledWith({ teamName: mockReq.body.teamName });
            assertResMock(
                403,
                { error: `Team Name "${mockReq.body.teamName}" already exists` },
                response,
                mockRes,
            );
        });

        test('Returns 200 - a new team is successfully created.', async () => {
            const { postTeam } = makeSut();
            const hasPermissionSpy = mockHasPermission(true);
            const mockSaveResolvedValue = { teamName: 'Unique Team', isActive: true };
            jest.spyOn(Team, 'exists').mockResolvedValue(false);

            const mockSave = jest.spyOn(Team.prototype, 'save').mockResolvedValue(mockSaveResolvedValue);
            const response = await postTeam(mockReq, mockRes);

            expect(hasPermissionSpy).toHaveBeenCalledWith(mockReq.body.requestor, 'postTeam');
            expect(Team.exists).toHaveBeenCalledWith({ teamName: mockReq.body.teamName });
            expect(mockSave).toHaveBeenCalled();
            assertResMock(200, mockSaveResolvedValue, response, mockRes);
        });
    });
});
