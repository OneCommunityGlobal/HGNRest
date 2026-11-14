const mockDeleteIfExists = jest.fn();
const mockGetBlockBlobClient = jest.fn();
const mockGetContainerClient = jest.fn();

jest.mock('@azure/storage-blob', () => ({
  BlobServiceClient: {
    fromConnectionString: jest.fn(() => ({
      getContainerClient: mockGetContainerClient,
    })),
  },
}));

const { BlobServiceClient } = require('@azure/storage-blob');
const { deleteApplicationBlob } = require('./AzureBlobImages');

describe('deleteApplicationBlob', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetContainerClient.mockReturnValue({
      getBlockBlobClient: mockGetBlockBlobClient,
    });

    mockGetBlockBlobClient.mockReturnValue({
      deleteIfExists: mockDeleteIfExists,
    });
  });

  test('rejects unsafe blob names without connecting to Azure', async () => {
    await expect(deleteApplicationBlob('../other/file.pdf')).rejects.toThrow(
      'Invalid application blob name',
    );

    await expect(deleteApplicationBlob('other/file.pdf')).rejects.toThrow(
      'Invalid application blob name',
    );

    await expect(deleteApplicationBlob('resumes/subfolder/file.pdf')).rejects.toThrow(
      'Invalid application blob name',
    );

    expect(BlobServiceClient.fromConnectionString).not.toHaveBeenCalled();
  });

  test('deletes an allowed application blob', async () => {
    mockDeleteIfExists.mockResolvedValue({ succeeded: true });

    await expect(deleteApplicationBlob('resumes/application.pdf')).resolves.toBe(true);

    expect(mockGetBlockBlobClient).toHaveBeenCalledWith('resumes/application.pdf');

    expect(mockDeleteIfExists).toHaveBeenCalledWith({
      deleteSnapshots: 'include',
    });
  });

  test('handles a blob that is already missing', async () => {
    mockDeleteIfExists.mockResolvedValue({ succeeded: false });

    await expect(deleteApplicationBlob('resumes/missing.pdf')).resolves.toBe(false);
  });

  test('propagates Azure deletion failures', async () => {
    mockDeleteIfExists.mockRejectedValue(new Error('Azure unavailable'));

    await expect(deleteApplicationBlob('resumes/application.pdf')).rejects.toThrow(
      'Azure unavailable',
    );
  });
});
