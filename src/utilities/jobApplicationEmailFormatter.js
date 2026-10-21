/**
 * Escape user-controlled text before inserting it into an HTML email.
 */
const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (character) => {
    const replacements = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return replacements[character];
  });

/**
 * Convert an application answer into readable, safe text.
 * File metadata is displayed without exposing uploaded-file URLs.
 */
const formatAnswer = (answer) => {
  if (answer == null) return 'Not provided';

  if (Array.isArray(answer)) {
    return answer.map(formatAnswer).join(', ');
  }

  if (typeof answer === 'object') {
    // File links can grant access to private documents; include metadata only.
    if (answer.fileName) {
      const details = [`Uploaded file: ${escapeHtml(answer.fileName)}`];
      if (answer.mimeType != null) {
        details.push(`File type: ${escapeHtml(answer.mimeType)}`);
      }
      if (answer.size != null) {
        details.push(`File size (bytes): ${escapeHtml(answer.size)}`);
      }
      return details.join('; ');
    }

    return Object.entries(answer)
      .filter(([key]) => !['url', 'type'].includes(key))
      .map(([key, value]) => `${escapeHtml(key)}: ${formatAnswer(value)}`)
      .join('; ');
  }

  return escapeHtml(answer);
};

/**
 * Build an HTML section containing the submitted application answers.
 */
const formatApplicationAnswers = (answers) => {
  if (!Array.isArray(answers) || answers.length === 0) {
    return '<p>No answers provided.</p>';
  }

  return answers
    .map((entry, index) => {
      const question = entry.questionText || `Question ${index + 1}`;
      return `
        <div style="margin-bottom: 16px;">
          <p><strong>${escapeHtml(question)}</strong></p>
          <p>${formatAnswer(entry.answer)}</p>
        </div>
      `;
    })
    .join('');
};

/**
 * Match saved answers to their original form questions.
 * Generated resume and applicant profile entries have no form question ID.
 */
const attachQuestionLabels = (form, answers) => {
  const questionLookup = new Map(
    (form?.questions || []).map((question) => [String(question._id), question.questionText]),
  );

  return (answers || []).map((entry) => {
    let questionText = questionLookup.get(String(entry.questionId));

    if (!questionText && entry.answer?.type === 'resume') {
      questionText = 'Uploaded Resume';
    }

    if (!questionText && entry.answer?.type === 'applicantProfile') {
      questionText = 'Applicant Information';
    }

    return {
      questionText: questionText || 'Additional Information',
      answer: entry.answer,
    };
  });
};

module.exports = {
  escapeHtml,
  formatAnswer,
  formatApplicationAnswers,
  attachQuestionLabels,
};
