const ApplicationAccess = require('../../models/applicationAccess');

async function upsertAppAccess(userId, appName, status, credentials) {
    let appAccess = await ApplicationAccess.findOne({ userId });

    if (!appAccess) {
        appAccess = new ApplicationAccess({ userId, apps: [] });
    }

    const app = appAccess.apps.find((a) => a.app === appName);

    if (app) {
        app.status = status;
        app.invitedOn = new Date();
        app.credentials = credentials;
        app.revokedOn = null;
        app.failedReason = null;
    } else {
        appAccess.apps.push({
            app: appName,
            status,
            invitedOn: new Date(),
            credentials,
        });
    }

    await appAccess.save();
    return appAccess;
}

async function revokeAppAccess(userId, appName) {
    const appAccess = await ApplicationAccess.findOne({ userId });
    const app = appAccess && appAccess.apps.find((a) => a.app === appName);

    if (!app || !app.credentials) {
        throw new Error(`${appName} folder information not found for this user.`);
    }

    app.status = 'revoked';
    app.revokedOn = new Date();
    await appAccess.save();
    return appAccess;
}

module.exports = {
    upsertAppAccess,
    revokeAppAccess,
};
