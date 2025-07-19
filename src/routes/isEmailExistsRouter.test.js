const request = require('supertest');
const { jwtPayload } = require('../test');
const { app } = require('../app');
const {
  createUser,
  mongoHelper: { dbConnect, dbDisconnect, dbClearCollections, dbClearAll },
} = require('../test');

const UserProfile = require('../models/userProfile');


const agent = request.agent(app);


let requestorUser;
let token;

beforeAll(async () => {
    await dbConnect();
    requestorUser = await createUser(); // requestor user
    token = jwtPayload(requestorUser);
});

beforeEach(async () => {
    await dbClearCollections('userProfile');
});

afterAll(async () => {
    await dbClearAll();
    await dbDisconnect();
});

describe('getActionItem', () => {
    it('should return 401 if authorization header is not present', async () => {
        await agent.get('/api/is-email-exists/test@example.com').expect(401);
    });

    it('should return 200 if email exists', async () => {
        await UserProfile.create({ 
            email: 'test@example.com', 
            firstName: 'Test', 
            lastName: 'User', 
            role: 'Administrator', 
            password: 'TestP@ssword' 
        });

        const res = await agent
            .get('/api/is-email-exists/test@example.com')
            .set('Authorization', token);

        expect(res.statusCode).toBe(200);
        expect(res.text).toBe('Email, test@example.com, found.');
    });

    it('should return 403 if email does not exist', async () => {
        const res = await agent
            .get('/api/is-email-exists/missing@example.com')
            .set('Authorization', token);

        expect(res.statusCode).toBe(403);
        expect(res.text).toBe('Email, missing@example.com, not found.');
    });
});


