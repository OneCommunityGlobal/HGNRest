const dropboxService = require('../../services/automation/dropboxService');
const sentryService = require('../../services/automation/sentryService');
const githubService = require('../../services/automation/githubService');
const slackService = require('../../services/automation/slackService');
const googleSheetService = require('../../services/automation/googleSheetService');

// Track operation progress
class BatchOperationProgress {
  constructor(total) {
    this.total = total;
    this.completed = 0;
    this.failed = 0;
    this.results = [];
  }

  update(result) {
    this.completed++;
    if (!result.success) {
      this.failed++;
    }
    this.results.push(result);
    return {
      progress: (this.completed / this.total) * 100,
      completed: this.completed,
      failed: this.failed,
      total: this.total,
    };
  }
}

// Batch onboard members
async function batchOnboardMembers(req, res) {
  const { members } = req.body;
  const progress = new BatchOperationProgress(members.length);
  const operations = [];

  try {
    for (const member of members) {
      const memberOperations = [];
      try {
        // Add to Google Sheet
        const sheetResult = await googleSheetService.addNewMember(member);
        memberOperations.push({ type: 'add', service: 'sheet', result: sheetResult });

        // Send GitHub invitation
        const githubResult = await githubService.sendInvitation(member.github);
        memberOperations.push({ type: 'add', service: 'github', result: githubResult });

        // Send Sentry invitation
        const sentryResult = await sentryService.inviteUser(member.email);
        memberOperations.push({ type: 'add', service: 'sentry', result: sentryResult });

        // Create Dropbox folder
        const dropboxResult = await dropboxService.createFolderWithSubfolder(member.dropboxFolder);
        memberOperations.push({ type: 'add', service: 'dropbox', result: dropboxResult });

        // Send Slack invitation
        const slackResult = await slackService.sendSlackInvite(member.email);
        memberOperations.push({ type: 'add', service: 'slack', result: slackResult });

        progress.update({ success: true });
        operations.push({ member, operations: memberOperations, success: true });
      } catch (error) {
        // If any operation fails, rollback all successful operations
        await rollbackOperations(memberOperations);
        progress.update({ success: false });
        operations.push({
          member,
          operations: memberOperations,
          success: false,
          error: error.message,
        });
      }
    }

    res.status(200).json({
      success: progress.failed === 0,
      message: 'Batch onboarding completed',
      progress: progress.update({ success: true }),
      results: operations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      progress: progress.update({ success: false }),
      results: operations,
    });
  }
}

// Batch offboard members
async function batchOffboardMembers(req, res) {
  const { members } = req.body;
  const progress = new BatchOperationProgress(members.length);
  const operations = [];

  try {
    for (const member of members) {
      const memberOperations = [];
      try {
        // Update Google Sheet status
        const sheetResult = await googleSheetService.updateMemberStatus(member, 'Inactive');
        memberOperations.push({ type: 'update', service: 'sheet', result: sheetResult });

        // Remove from GitHub
        const githubResult = await githubService.removeUser(member.github);
        memberOperations.push({ type: 'remove', service: 'github', result: githubResult });

        // Remove from Sentry
        const sentryMembers = await sentryService.getMembers();
        const sentryMember = sentryMembers.find((m) => m.email === member.email);
        if (sentryMember) {
          const sentryResult = await sentryService.removeUser(sentryMember.id);
          memberOperations.push({ type: 'remove', service: 'sentry', result: sentryResult });
        }

        // Delete Dropbox folder
        const dropboxResult = await dropboxService.deleteFolder(member.dropboxFolder);
        memberOperations.push({ type: 'remove', service: 'dropbox', result: dropboxResult });

        progress.update({ success: true });
        operations.push({ member, operations: memberOperations, success: true });
      } catch (error) {
        // If any operation fails, rollback all successful operations
        await rollbackOperations(memberOperations);
        progress.update({ success: false });
        operations.push({
          member,
          operations: memberOperations,
          success: false,
          error: error.message,
        });
      }
    }

    res.status(200).json({
      success: progress.failed === 0,
      message: 'Batch offboarding completed',
      progress: progress.update({ success: true }),
      results: operations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      progress: progress.update({ success: false }),
      results: operations,
    });
  }
}

// Rollback operations if needed
async function rollbackOperations(operations) {
  for (const operation of operations) {
    try {
      switch (operation.service) {
        case 'sheet':
          if (operation.type === 'add') {
            await googleSheetService.updateMemberStatus(operation.member, 'Removed');
          }
          break;
        case 'github':
          if (operation.type === 'add') {
            await githubService.removeUser(operation.member.github);
          }
          break;
        case 'sentry':
          if (operation.type === 'add') {
            const members = await sentryService.getMembers();
            const member = members.find((m) => m.email === operation.member.email);
            if (member) {
              await sentryService.removeUser(member.id);
            }
          }
          break;
        case 'dropbox':
          if (operation.type === 'add') {
            await dropboxService.deleteFolder(operation.member.dropboxFolder);
          }
          break;
      }
    } catch (error) {
      console.error(`Failed to rollback ${operation.service} operation:`, error);
    }
  }
}

module.exports = {
  batchOnboardMembers,
  batchOffboardMembers,
};
