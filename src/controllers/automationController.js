const githubService = require('../services/automation/githubService');
const sentryService = require('../services/automation/sentryService');
const dropboxService = require('../services/automation/dropboxService');
const slackService = require('../services/automation/slackService');
const googleSheetService = require('../services/automation/googleSheetService');

// Controller to handle new member onboarding
async function onboardNewMember(req, res) {
  try {
    console.log('[onboardNewMember] req.body:', req.body);
    const { name, email, github, dropboxFolder } = req.body;

    if (!name || !email || !github || !dropboxFolder) {
      console.log('[onboardNewMember] 缺少字段:', { name, email, github, dropboxFolder });
      return res.status(500).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    // 1. Add member to Google Sheet
    const googleResult = await googleSheetService.addNewMember({ name, email, github });
    console.log('[onboardNewMember] googleSheetService.addNewMember result:', googleResult);

    // 2. Send GitHub invitation
    const githubResult = await githubService.sendInvitation(github);
    console.log('[onboardNewMember] githubService.sendInvitation result:', githubResult);

    // 3. Send Sentry invitation
    const sentryResult = await sentryService.inviteUser(email);
    console.log('[onboardNewMember] sentryService.inviteUser result:', sentryResult);

    // 4. Create Dropbox folder and invite user
    const dropboxResult = await dropboxService.createFolderWithSubfolder(dropboxFolder);
    console.log(
      '[onboardNewMember] dropboxService.createFolderWithSubfolder result:',
      dropboxResult,
    );
    if (
      !dropboxResult ||
      !dropboxResult.parentFolderResponse ||
      !dropboxResult.parentFolderResponse.result
    ) {
      console.log('[onboardNewMember] dropboxResult 结构异常:', dropboxResult);
      throw new Error('Failed to create Dropbox folder');
    }
    await dropboxService.inviteUserToFolder(dropboxResult.parentFolderResponse.result.id, email);
    console.log('[onboardNewMember] dropboxService.inviteUserToFolder called');

    // 5. Send Slack invitation
    await slackService.sendSlackInvite(email);
    console.log('[onboardNewMember] slackService.sendSlackInvite called');

    res.json({
      success: true,
      message: 'Member onboarded successfully',
      details: {
        github: githubResult,
        sentry: sentryResult,
        dropbox: dropboxResult,
      },
    });
  } catch (error) {
    console.log('[onboardNewMember] error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

// Controller to handle member offboarding
async function offboardMember(req, res) {
  try {
    console.log('[offboardMember] req.body:', req.body);
    const { email, github, dropboxFolder } = req.body;

    if (!email || !github) {
      console.log('[offboardMember] 缺少字段:', { email, github });
      return res.status(500).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    // 1. Update member status in Google Sheet
    const googleResult = await googleSheetService.updateMemberStatus(email, 'Inactive');
    console.log('[offboardMember] googleSheetService.updateMemberStatus result:', googleResult);

    // 2. Remove from GitHub
    const githubResult = await githubService.removeUser(github);
    console.log('[offboardMember] githubService.removeUser result:', githubResult);

    // 3. Remove from Sentry
    const members = await sentryService.getMembers();
    console.log('[offboardMember] sentryService.getMembers result:', members);
    if (!Array.isArray(members)) {
      console.log('[offboardMember] sentryService.getMembers 非数组:', members);
      throw new Error('Failed to get Sentry members');
    }
    const member = members.find((m) => m.email === email);
    let sentryResult;
    if (member) {
      await sentryService.removeUser(member.id);
      sentryResult = { success: true };
      console.log('[offboardMember] sentryService.removeUser called, id:', member.id);
    } else {
      sentryResult = { success: false, message: 'Member not found in Sentry' };
      console.log('[offboardMember] Sentry member not found:', email);
    }

    // 4. Remove from Dropbox
    if (dropboxFolder) {
      await dropboxService.deleteFolder(dropboxFolder);
      console.log('[offboardMember] dropboxService.deleteFolder called:', dropboxFolder);
    }

    res.json({
      success: true,
      message: 'Member offboarded successfully',
      details: {
        github: githubResult,
        sentry: sentryResult,
      },
    });
  } catch (error) {
    console.log('[offboardMember] error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

// Controller to handle batch member onboarding
async function batchOnboardMembers(req, res) {
  try {
    const { members } = req.body;

    if (!Array.isArray(members)) {
      return res.status(500).json({
        success: false,
        error: 'Members must be an array',
      });
    }

    const results = [];

    for (const member of members) {
      try {
        const { name, email, github, dropboxFolder } = member;

        if (!name || !email || !github || !dropboxFolder) {
          throw new Error('Missing required fields');
        }

        // 1. Add member to Google Sheet
        await googleSheetService.addNewMember({ name, email, github });

        // 2. Send GitHub invitation
        const githubResult = await githubService.sendInvitation(github);

        // 3. Send Sentry invitation
        const sentryResult = await sentryService.inviteUser(email);

        // 4. Create Dropbox folder and invite user
        const dropboxResult = await dropboxService.createFolderWithSubfolder(dropboxFolder);
        if (
          !dropboxResult ||
          !dropboxResult.parentFolderResponse ||
          !dropboxResult.parentFolderResponse.result
        ) {
          throw new Error('Failed to create Dropbox folder');
        }
        await dropboxService.inviteUserToFolder(
          dropboxResult.parentFolderResponse.result.id,
          email,
        );

        // 5. Send Slack invitation
        await slackService.sendSlackInvite(email);

        results.push({
          email,
          success: true,
          details: {
            github: githubResult,
            sentry: sentryResult,
            dropbox: dropboxResult,
          },
        });
      } catch (error) {
        results.push({
          email: member.email,
          success: false,
          error: error.message,
        });
      }

      // Add a small delay between members
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    res.json({
      success: true,
      message: 'Batch onboarding completed',
      results,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

// Controller to handle batch member offboarding
async function batchOffboardMembers(req, res) {
  try {
    const { members } = req.body;

    if (!Array.isArray(members)) {
      return res.status(500).json({
        success: false,
        error: 'Members must be an array',
      });
    }

    const results = [];

    for (const member of members) {
      try {
        const { email, github, dropboxFolder } = member;

        if (!email || !github) {
          throw new Error('Missing required fields');
        }

        // 1. Update member status in Google Sheet
        await googleSheetService.updateMemberStatus(email, 'Inactive');

        // 2. Remove from GitHub
        const githubResult = await githubService.removeUser(github);

        // 3. Remove from Sentry
        const sentryMembers = await sentryService.getMembers();
        if (!Array.isArray(sentryMembers)) {
          throw new Error('Failed to get Sentry members');
        }
        const sentryMember = sentryMembers.find((m) => m.email === email);
        let sentryResult;
        if (sentryMember) {
          await sentryService.removeUser(sentryMember.id);
          sentryResult = { success: true };
        } else {
          sentryResult = { success: false, message: 'Member not found in Sentry' };
        }

        // 4. Remove from Dropbox
        if (dropboxFolder) {
          await dropboxService.deleteFolder(dropboxFolder);
        }

        results.push({
          email,
          success: true,
          details: {
            github: githubResult,
            sentry: sentryResult,
          },
        });
      } catch (error) {
        results.push({
          email: member.email,
          success: false,
          error: error.message,
        });
      }

      // Add a small delay between members
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    res.json({
      success: true,
      message: 'Batch offboarding completed',
      results,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

module.exports = {
  onboardNewMember,
  offboardMember,
  batchOnboardMembers,
  batchOffboardMembers,
};
