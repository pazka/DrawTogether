import path = require("path");

// Where the app keeps its data. The defaults are the legacy layout (box bind mounts ./front/build/uploads and
// ./.node-persist, cwd /app); the hosh-deploy compose puts both in one named volume at /data (DEPLOY.md).
//   UPLOADS_DIR: uploaded layer images, served under /uploads/ (multer temp files in its .tmp/)
//   PERSIST_DIR: the node-persist store (the files directory itself; default .node-persist/storage under the cwd)
export const uploadsDir: string = process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.join(__dirname, "../front/build/uploads");

export const persistDir: string = process.env.PERSIST_DIR ? path.resolve(process.env.PERSIST_DIR) : null;
