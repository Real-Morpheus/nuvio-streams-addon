const { Client } = require('ssh2');
const path = require('path');

const conn = new Client();
const localFiles = [
    { src: 'utils/tokenManager.js', dst: '/root/linux-deployment/utils/tokenManager.js' },
    { src: 'views/admin.html', dst: '/root/linux-deployment/views/admin.html' }
];
const containerName = 'nuvio-streams-app';

conn.on('ready', () => {
    console.log('✅ SSH Connected');
    let chain = Promise.resolve();

    localFiles.forEach(file => {
        chain = chain.then(() => new Promise((resolve, reject) => {
            const localPath = path.join(__dirname, file.src);
            console.log(`Uploading ${file.src} to ${file.dst}...`);
            conn.sftp((err, sftp) => {
                if (err) return reject(err);
                sftp.fastPut(localPath, file.dst, (err) => {
                    if (err) reject(err);
                    else {
                        console.log(`Uploaded ${file.src}`);
                        resolve();
                    }
                });
            });
        })).then(() => new Promise((resolve, reject) => {
            const containerPath = file.dst.replace('/root/linux-deployment', '/app');
            console.log(`Copying to container: ${containerPath}`);
            conn.exec(`docker cp ${file.dst} ${containerName}:${containerPath}`, (err, stream) => {
                if (err) return reject(err);
                stream.on('close', (code) => {
                    if (code === 0) resolve(); else reject(new Error('docker cp failed'));
                });
            });
        }));
    });

    chain.then(() => new Promise((resolve, reject) => {
        console.log('Restarting container...');
        conn.exec(`docker restart ${containerName}`, (err, stream) => {
            if (err) return reject(err);
            stream.on('close', (code) => {
                if (code === 0) { console.log('✅ Restarted'); resolve(); }
                else reject(new Error('restart failed'));
            });
            stream.stdout.on('data', d => process.stdout.write(d));
        });
    })).then(() => {
        console.log('Done');
        conn.end();
    }).catch(err => {
        console.error('Error:', err);
        conn.end();
    });

}).connect({
    host: '46.38.235.254', port: 22, username: 'root', password: 'Bijju@1989'
});
