const {
  escapeHtml,
  formatAnswer,
  formatApplicationAnswers,
  attachQuestionLabels,
} = require('./jobApplicationEmailFormatter');

describe('Job application email formatter', () => {
  test('escapes unsafe HTML characters', () => {
    expect(escapeHtml('<script>alert("test")</script>')).toBe(
      '&lt;script&gt;alert(&quot;test&quot;)&lt;/script&gt;',
    );
  });

  test('formats plain text answers', () => {
    expect(formatAnswer('I have React experience')).toBe('I have React experience');
  });

  test('formats multiple selected answers', () => {
    expect(formatAnswer(['React', 'Node.js'])).toBe('React, Node.js');
  });

  test('formats uploaded file names without exposing URLs', () => {
    const result = formatAnswer({
      fileName: 'resume.pdf',
      url: 'https://example.com/private-resume',
    });

    expect(result).toContain('resume.pdf');
    expect(result).not.toContain('private-resume');
  });

  test('includes uploaded file type and size without exposing a private URL', () => {
    const result = formatAnswer({
      type: 'resume',
      fileName: '<resume>.pdf',
      mimeType: 'application/pdf',
      size: 0,
      url: 'https://private.example/download?token=secret',
    });

    expect(result).toContain('Uploaded file: &lt;resume&gt;.pdf');
    expect(result).toContain('File type: application/pdf');
    expect(result).toContain('File size (bytes): 0');
    expect(result).not.toContain('private.example');
    expect(result).not.toContain('token=secret');
  });

  test('preserves all nested profile fields and escapes their contents', () => {
    const result = formatAnswer({
      type: 'applicantProfile',
      name: '<Applicant>',
      location: { city: 'San Diego', timezone: 'PDT' },
      interests: ['Engineering', 'Design'],
    });

    expect(result).toContain('name: &lt;Applicant&gt;');
    expect(result).toContain('city: San Diego');
    expect(result).toContain('Engineering, Design');
  });

  test('formats null, empty arrays, and question fallback', () => {
    expect(formatAnswer(null)).toBe('Not provided');
    expect(formatAnswer([])).toBe('');
    expect(formatApplicationAnswers([{ answer: null }])).toContain('Question 1');
    expect(formatApplicationAnswers([{ answer: null }])).toContain('Not provided');
  });

  test('formats applicant profile information', () => {
    const result = formatAnswer({
      type: 'applicantProfile',
      applicantName: 'Test Applicant',
      applicantEmail: 'test@example.com',
    });

    expect(result).toContain('Test Applicant');
    expect(result).toContain('test@example.com');
  });

  test('formats submitted questions and answers', () => {
    const result = formatApplicationAnswers([
      {
        questionText: 'Why are you interested?',
        answer: 'I want to contribute.',
      },
    ]);

    expect(result).toContain('Why are you interested?');
    expect(result).toContain('I want to contribute.');
  });

  test('prevents HTML injection through submitted answers', () => {
    const result = formatApplicationAnswers([
      {
        questionText: '<script>test</script>',
        answer: '<img src=x onerror=alert(1)>',
      },
    ]);

    expect(result).not.toContain('<script>');
    expect(result).not.toContain('<img');
    expect(result).toContain('&lt;script&gt;');
  });

  test('handles empty application answers', () => {
    expect(formatApplicationAnswers([])).toContain('No answers provided.');
  });
});

test('matches saved answers with their original question text', () => {
  const form = {
    questions: [
      {
        _id: 'question-123',
        questionText: 'Why do you want to volunteer?',
      },
    ],
  };

  const answers = [
    {
      questionId: 'question-123',
      answer: 'I want to help the community.',
    },
    {
      questionId: 'resume-456',
      answer: {
        type: 'resume',
        fileName: 'resume.pdf',
      },
    },
    {
      questionId: 'profile-789',
      answer: {
        type: 'applicantProfile',
        applicantName: 'Test Applicant',
      },
    },
  ];

  const result = attachQuestionLabels(form, answers);

  expect(result).toEqual([
    {
      questionText: 'Why do you want to volunteer?',
      answer: 'I want to help the community.',
    },
    {
      questionText: 'Uploaded Resume',
      answer: {
        type: 'resume',
        fileName: 'resume.pdf',
      },
    },
    {
      questionText: 'Applicant Information',
      answer: {
        type: 'applicantProfile',
        applicantName: 'Test Applicant',
      },
    },
  ]);
});
