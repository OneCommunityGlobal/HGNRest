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
 * Build numbered Q&A blocks with clear separation between question and answer.
 */
const formatApplicationAnswers = (answers) => {
  if (!Array.isArray(answers) || answers.length === 0) {
    return '<p style="margin: 0 0 16px 0;">No answers provided.</p>';
  }

  return answers
    .map((entry, index) => {
      const question = entry.questionText || `Question ${index + 1}`;
      return `
        <div style="margin: 0 0 28px 0;">
          <p style="margin: 0 0 12px 0;"><strong>${index + 1}.) ${escapeHtml(question)}</strong></p>
          <p style="margin: 0; white-space: pre-wrap;">${formatAnswer(entry.answer)}</p>
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

/**
 * Pick Jae's letter variant from the job form category/title.
 * Templates: software | administrative | general
 */
const resolveApplicantEmailTemplate = (form = {}) => {
  const haystack = `${form.category || ''} ${form.title || ''}`.toLowerCase();

  if (/admin(istrative)?|assistant|office manager|executive assistant/.test(haystack)) {
    return 'administrative';
  }

  if (
    /engineer|software|developer|mern|react|frontend|front-end|backend|back-end|full[\s-]?stack|programming/.test(
      haystack,
    ) ||
    form.category === 'Engineering'
  ) {
    return 'software';
  }

  return 'general';
};

const JAE_SIGNATURE_HTML = `
  <p style="margin: 24px 0 0 0;">With Gratitude,</p>
  <p style="margin: 16px 0 0 0;">
    Jae Sabol<br/>
    310.755.4693<br/>
    Zoom: <a href="https://www.tinyurl.com/zoomoc">www.tinyurl.com/zoomoc</a><br/>
    Google Email: onecommunityglobal@gmail.com<br/>
    Primary Email: jae@onecommunityglobal.org<br/>
    Timezone: Los Angeles, CA - Pacific Time
  </p>
`;

/**
 * Build the applicant confirmation email in Jae's "Applied through site" format.
 * Intro/closing follow software / administrative / general templates;
 * question bodies come from the submitted form answers.
 */
const buildApplicantConfirmationEmail = ({
  form,
  displayName,
  formattedAnswers,
  attachmentNotice = '',
}) => {
  const template = resolveApplicantEmailTemplate(form);
  const safeName = escapeHtml(displayName);
  const safeTitle = escapeHtml(form?.title || 'this position');

  let introHtml;
  let questionsLeadHtml;
  let closingHtml;

  if (template === 'software') {
    introHtml = `
      <p style="margin: 0 0 16px 0;">
        Thank you for contacting us with your interest in volunteering for the
        &quot;${safeTitle}&quot; position with One Community. What you&apos;ve shared so far
        and your resume look like a good start for this position and I&apos;m happy to learn more.
      </p>
    `;
    questionsLeadHtml = `
      <p style="margin: 0 0 20px 0;">
        Below are the pre-interview questions for software engineers, along with the answers you
        submitted through the site:
      </p>
    `;
    closingHtml = `
      <p style="margin: 24px 0 0 0;">
        If you have any questions when completing the above, please text them to me so I can answer
        them. I&apos;m here to help but I get 100s of emails a day and only read what I specifically
        search for, so I use texting with all active team members. Phone or WhatsApp are the best
        ways to communicate with me: (310) 755-4693
      </p>
    `;
  } else if (template === 'administrative') {
    introHtml = `
      <p style="margin: 0 0 16px 0;">
        Thank you for contacting us about volunteering for the &quot;${safeTitle}&quot; position
        with One Community. What you&apos;ve shared so far and your resume look like a good start
        for this position and I&apos;m happy to learn more.
      </p>
    `;
    questionsLeadHtml = `
      <p style="margin: 0 0 20px 0;">
        Below are the pre-interview questions for Administration applicants, along with the answers
        you submitted through the site:
      </p>
    `;
    closingHtml = `
      <p style="margin: 24px 0 0 0;">
        If you have any questions when completing the above, please email them to me so I can answer
        them, I&apos;m here to help.
      </p>
    `;
  } else {
    introHtml = form?.title
      ? `
      <p style="margin: 0 0 16px 0;">
        Thank you for contacting us about volunteering for the &quot;${safeTitle}&quot; position
        with One Community. What you&apos;ve shared so far sounds like a good start for our team and
        I&apos;d like to learn more.
      </p>
    `
      : `
      <p style="margin: 0 0 16px 0;">
        Thank you for contacting us about volunteering. What you&apos;ve shared so far sounds like
        a good start for our team and I&apos;d like to learn more.
      </p>
    `;
    questionsLeadHtml = `
      <p style="margin: 0 0 20px 0;">
        Below are the pre-interview questions specific to applicants with your experience and areas
        of interest, along with the answers you submitted through the site:
      </p>
    `;
    closingHtml = `
      <p style="margin: 24px 0 0 0;">
        If you have any questions when completing the above, please text them to me so I can answer
        them. I&apos;m here to help but I get 100s of emails a day and only read what I specifically
        search for, so I use texting with all active team members. Phone or WhatsApp are the best
        ways to communicate with me: (310) 755-4693
      </p>
    `;
  }

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; padding: 20px; max-width: 640px; line-height: 1.5; color: #222;">
      <p style="margin: 0 0 16px 0;">Dear ${safeName},</p>

      ${introHtml}

      ${questionsLeadHtml}

      ${formattedAnswers}

      ${attachmentNotice || ''}

      ${closingHtml}

      ${JAE_SIGNATURE_HTML}
    </div>
  `;
};

module.exports = {
  escapeHtml,
  formatAnswer,
  formatApplicationAnswers,
  attachQuestionLabels,
  resolveApplicantEmailTemplate,
  buildApplicantConfirmationEmail,
};
