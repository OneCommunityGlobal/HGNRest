/**
 * Verify that a stored file URL points to the expected Azure container.
 * This utility never accesses Azure or deletes files.
 */
const isTrustedAzureUrl = (url, origin) =>
  url.protocol === 'https:' &&
  origin.protocol === 'https:' &&
  url.origin === origin.origin &&
  origin.pathname === '/' &&
  !origin.search &&
  !origin.hash &&
  !url.username &&
  !url.password &&
  !url.search &&
  !url.hash;

/**
 * Accept only simple application upload filenames within resumes/.
 */
const isValidApplicationBlob = (blobName) => {
  if (!blobName.startsWith('resumes/')) {
    return false;
  }

  if (blobName.includes('%') || blobName.includes('\\') || blobName.includes('//')) {
    return false;
  }

  if (!/^resumes\/[a-zA-Z0-9_.-]+$/.test(blobName)) {
    return false;
  }

  const filename = blobName.slice('resumes/'.length);

  return filename !== '' && filename !== '.' && filename !== '..';
};

/**
 * Extract a trusted application blob name from a stored Azure URL.
 * Returns null for any invalid or unexpected reference.
 */
const getApplicationBlobName = (fileUrl, expectedOrigin, containerName) => {
  if (
    typeof fileUrl !== 'string' ||
    typeof expectedOrigin !== 'string' ||
    typeof containerName !== 'string' ||
    !containerName ||
    !/^[a-z0-9-]+$/.test(containerName)
  ) {
    return null;
  }

  try {
    const url = new URL(fileUrl);
    const origin = new URL(expectedOrigin);

    if (!isTrustedAzureUrl(url, origin)) {
      return null;
    }

    const containerPrefix = `/${containerName}/`;

    if (!url.pathname.startsWith(containerPrefix)) {
      return null;
    }

    const blobName = url.pathname.slice(containerPrefix.length);

    return isValidApplicationBlob(blobName) ? blobName : null;
  } catch {
    return null;
  }
};

module.exports = {
  getApplicationBlobName,
};
