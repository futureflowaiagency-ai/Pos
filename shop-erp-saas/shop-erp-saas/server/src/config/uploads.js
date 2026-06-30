import path from 'path';
import { fileURLToPath } from 'url';

// Absolute path to the local uploads folder (server/uploads). Computed from this
// module's location so it is independent of the process working directory.
// Used as the disk fallback when Cloudinary isn't configured.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
