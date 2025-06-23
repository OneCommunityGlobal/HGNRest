import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const YouTubeUploader = () => {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [privacyStatus, setPrivacyStatus] = useState('private');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type.startsWith('video/')) {
      setFile(selectedFile);
      setError('');
    } else {
      setError('Please select a valid video file');
      setFile(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      formData.append('description', description);
      formData.append('tags', tags.split(',').map(tag => tag.trim()));
      formData.append('privacyStatus', privacyStatus);

      const response = await axios.post('/api/uploadYtVideo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${user.token}`
        }
      });

      setSuccess('Video uploaded successfully!');
      // Reset form
      setFile(null);
      setTitle('');
      setDescription('');
      setTags('');
      setPrivacyStatus('private');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload video');
    } finally {
      setUploading(false);
    }
  };

  if (!user?.permissions?.includes('uploadToYoutube')) {
    return (
      <div className="p-4 bg-red-100 text-red-700 rounded">
        You do not have permission to upload videos to YouTube
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Upload Video to YouTube</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Video File</label>
          <input
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="mt-1 block w-full"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            rows="4"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Tags (comma-separated)</label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            placeholder="tag1, tag2, tag3"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Privacy Status</label>
          <select
            value={privacyStatus}
            onChange={(e) => setPrivacyStatus(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          >
            <option value="private">Private</option>
            <option value="unlisted">Unlisted</option>
            <option value="public">Public</option>
          </select>
        </div>

        {error && (
          <div className="p-4 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-100 text-green-700 rounded">
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={uploading || !file}
          className={`w-full py-2 px-4 rounded-md text-white font-medium ${
            uploading || !file
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {uploading ? 'Uploading...' : 'Upload Video'}
        </button>
      </form>
    </div>
  );
};

export default YouTubeUploader; 