// The `lzma` package discovers its worker with a runtime-built require path.
// Webpack cannot preserve that path inside app.asar, so use a static import
// that is bundled together with the Electron main process instead.
const worker = require('lzma/src/lzma_worker.js');
const lzma = worker.LZMA_WORKER;

module.exports.LZMA = function LZMA() {
  return lzma;
};
module.exports.compress = lzma.compress;
module.exports.decompress = lzma.decompress;
