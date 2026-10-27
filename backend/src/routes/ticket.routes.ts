import { Router } from 'express';
import multer from 'multer';
import config from '@config/index';
import { authenticate, requireRole } from '@middleware/auth.middleware';
import { validateBody, validateQuery, validateParams } from '@middleware/validation.middleware';
import * as ticketController from '@controllers/ticket.controller';
import * as validators from '@validators/ticket.validator';

const router = Router();

const DEFAULT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
  'audio/webm',
  'audio/ogg',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
];
const configuredTypes = config.upload.allowedTypes.filter(Boolean);
const allowedMimeTypes = configuredTypes.length > 0 ? configuredTypes : DEFAULT_ALLOWED_MIME_TYPES;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.upload.maxSize, files: 1 },
  fileFilter: (_req, file, cb) => {
    const mime = file.mimetype.toLowerCase().split(';')[0].trim();
    if (mime.startsWith('audio/') || allowedMimeTypes.includes(mime)) return cb(null, true);
    cb(new Error(`File type ${file.mimetype} is not allowed. Supported formats: Images, PDF, Office Documents, Text, Audio, ZIP`));
  },
});

router.use(authenticate);

router.get('/', validateQuery(validators.ticketQuerySchema), ticketController.getTickets);
router.get('/my', validateQuery(validators.ticketQuerySchema), ticketController.getMyTickets);
router.get('/assigned', validateQuery(validators.ticketQuerySchema), ticketController.getAssignedTickets);
router.get('/stats', ticketController.getTicketStats);

router.post('/', validateBody(validators.createTicketSchema), ticketController.createTicket);
router.post('/bulk', validateBody(validators.bulkActionSchema), ticketController.bulkAction);

router.get('/:id', validateParams(validators.ticketIdParamSchema), ticketController.getTicketById);
router.patch('/:id', validateBody(validators.updateTicketSchema), ticketController.updateTicket);

router.post('/:id/assign', validateBody(validators.assignTicketSchema), ticketController.assignTicket);
router.patch('/:id/status', validateBody(validators.updateTicketStatusSchema), ticketController.updateTicketStatus);

router.post('/:id/comments', validateBody(validators.addCommentSchema), ticketController.addComment);
router.patch('/:id/comments/:commentId', validateBody(validators.updateCommentSchema), ticketController.updateComment);
router.delete('/:id/comments/:commentId', ticketController.deleteComment);

router.post('/:id/watchers', validateBody(validators.addWatcherSchema), ticketController.addWatcher);
router.delete('/:id/watchers', validateBody(validators.removeWatcherSchema), ticketController.removeWatcher);

router.post('/:id/attachments', upload.single('file'), ticketController.uploadAttachment);
router.get('/:id/attachments/:attachmentId/download', ticketController.downloadAttachment);
router.delete('/:id/attachments/:attachmentId', ticketController.deleteAttachment);

router.delete('/:id', ticketController.deleteTicket);

export default router;