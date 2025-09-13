import fs from 'fs';
import archiver from 'archiver';
import path from 'path';

const output = fs.createWriteStream(path.resolve('./vostra-extension.zip'));
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', function ()
{
    console.log(`Zip created: ${archive.pointer()} total bytes`);
});

archive.on('error', function (err)
{
    throw err;
});

archive.pipe(output);

// Add all files from chrome-extension-build
archive.directory('chrome-extension-build/', false);

archive.finalize();
