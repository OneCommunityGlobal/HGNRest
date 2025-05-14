const { google } = require('googleapis');
require('dotenv').config();

// Initialize Google Sheets API
let auth;
let sheets;

// Helper function to handle errors
function handleError(error, context) {
  if (error instanceof Error) {
    throw new Error(`Error ${context}: ${error.message}`);
  }
  throw error;
}

function initializeGoogleSheets() {
  try {
    auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    sheets = google.sheets({ version: 'v4', auth });
    return true;
  } catch (error) {
    console.error('Error initializing Google Sheets API:', error);
    return false;
  }
}

// Initialize on module load
initializeGoogleSheets();

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// Track operation progress
class OperationProgress {
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
      progress: Math.min(100, (this.completed / this.total) * 100),
      completed: this.completed,
      failed: this.failed,
      total: this.total,
    };
  }
}

// Function to get all members from the Google Sheet
async function getAllMembers() {
  try {
    if (!sheets) {
      if (!initializeGoogleSheets()) {
        throw new Error('Failed to initialize Google Sheets API');
      }
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Members!A2:E', // Assuming columns: Name, Email, GitHub, Status, Last Updated
    });

    return response.data.values.map((row) => ({
      name: row[0],
      email: row[1],
      github: row[2],
      status: row[3],
      lastUpdated: row[4],
    }));
  } catch (error) {
    handleError(error, 'fetching members from Google Sheet');
  }
}

// Function to update member status
async function updateMemberStatus(member, status) {
  try {
    if (!sheets) {
      if (!initializeGoogleSheets()) {
        return { success: false, error: 'Failed to initialize Google Sheets API' };
      }
    }

    // Validate status (case-insensitive)
    const validStatuses = ['Active', 'Inactive', 'Removed'];
    const normalizedStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

    if (!validStatuses.includes(normalizedStatus)) {
      return { success: false, error: 'Invalid status value' };
    }

    // First find the member's row
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Members!A:F',
    });

    const rows = response.data.values;
    const rowIndex = rows.findIndex((row) => row[1] === member.email);

    if (rowIndex === -1) {
      return { success: false, error: 'Member not found in sheet' };
    }

    // Check if status is already set (case-insensitive)
    if (rows[rowIndex][3].toLowerCase() === normalizedStatus.toLowerCase()) {
      return { success: true, message: `Status already set to ${normalizedStatus}` };
    }

    // Update the status
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Members!D${rowIndex + 1}`,
      valueInputOption: 'RAW',
      resource: { values: [[normalizedStatus, new Date().toISOString()]] },
    });

    return { success: true, message: `Updated ${member.name}'s status to ${normalizedStatus}` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Function to get all inactive members
async function getInactiveMembers() {
  try {
    const members = await getAllMembers();
    return members.filter((member) => member.status.toLowerCase() === 'inactive');
  } catch (error) {
    handleError(error, 'fetching inactive members');
  }
}

// Add a new member to the sheet
async function addNewMember(member) {
  try {
    if (!sheets) {
      if (!initializeGoogleSheets()) {
        return { success: false, error: 'Failed to initialize Google Sheets API' };
      }
    }

    if (!member.email) {
      return { success: false, error: 'Missing required fields' };
    }

    // Check for duplicate email
    let existingMembers;
    try {
      existingMembers = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Members!A2:E',
      });
    } catch (error) {
      return { success: false, error: error.message };
    }

    if (existingMembers.data.values.some((row) => row[1] === member.email)) {
      return { success: false, error: 'Email already exists' };
    }

    const values = [[member.name, member.email, member.github, 'Active', new Date().toISOString()]];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Members!A:E',
      valueInputOption: 'RAW',
      resource: { values },
    });

    return { success: true, message: `Added ${member.name} to sheet` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Batch add members to the sheet
async function batchAddMembers(members) {
  const progress = new OperationProgress(members.length);
  const results = [];

  for (const member of members) {
    try {
      const result = await addNewMember(member);
      results.push({ ...result, member });
      progress.update(result);
    } catch (error) {
      results.push({ success: false, error: error.message, member });
      progress.update({ success: false });
    }
  }

  return {
    success: progress.failed === 0,
    progress: progress.update({ success: true }),
    results,
  };
}

// Batch update member statuses
async function batchUpdateMemberStatuses(members, status) {
  const progress = new OperationProgress(members.length);
  const results = [];

  for (const member of members) {
    try {
      const result = await updateMemberStatus(member, status);
      results.push({ ...result, member });
      progress.update(result);
    } catch (error) {
      results.push({ success: false, error: error.message, member });
      progress.update({ success: false });
    }
  }

  return {
    success: progress.failed === 0,
    progress: progress.update({ success: true }),
    results,
  };
}

// Rollback changes if needed
async function rollbackChanges(operations) {
  const progress = new OperationProgress(operations.length);
  const results = [];

  for (const operation of operations) {
    try {
      let result;
      if (operation.type === 'add') {
        // If it was an add operation, we need to remove the member
        result = await updateMemberStatus(operation.member, 'Removed');
      } else if (operation.type === 'update') {
        // If it was an update operation, we need to revert the status
        result = await updateMemberStatus(operation.member, operation.originalStatus);
      }
      results.push({ ...result, operation });
      progress.update(result);
    } catch (error) {
      results.push({ success: false, error: error.message, operation });
      progress.update({ success: false });
    }
  }

  return {
    success: progress.failed === 0,
    progress: progress.update({ success: true }),
    results,
  };
}

module.exports = {
  getAllMembers,
  updateMemberStatus,
  getInactiveMembers,
  addNewMember,
  batchAddMembers,
  batchUpdateMemberStatuses,
  rollbackChanges,
  // Export for testing
  _initializeGoogleSheets: initializeGoogleSheets,
};
