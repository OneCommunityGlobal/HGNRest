import { Router } from 'express';
import multer from 'multer';
import { 
  createPost, 
  schedulePost, 
  getScheduledPosts, 
  updateScheduledPost, 
  deleteScheduledPost, 
  postScheduledNow, 
  getPostHistory 
} from '../controllers/liveJournalPostController';

const router = Router();

// Configure Multer to store file in memory
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // Limit to 5MB
});

// Update POST routes to accept a single file named 'image'
router.post('/post', upload.single('image'), createPost);
router.post('/schedule', upload.single('image'), schedulePost);

// These routes remain unchanged
router.get('/scheduled', getScheduledPosts);
router.put('/schedule/:id', updateScheduledPost);
router.delete('/schedule/:id', deleteScheduledPost);
router.post('/post-scheduled/:id', postScheduledNow);
router.get('/history', getPostHistory);

export default router;