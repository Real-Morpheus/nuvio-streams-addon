const { execSync } = require('child_process');

const VPS_IP = "46.38.235.254";
const REMOTE_DIR = "/root/linux-deployment";
const CONTAINER = "nuvio-streams-app-v2";

try {
    console.log('1. Uploading Files to VPS...');
    // Recursive upload of folders and package info
    execSync(`scp -r public templates server.js package.json root@${VPS_IP}:${REMOTE_DIR}/`);
    execSync(`scp utils/tokenManager.js root@${VPS_IP}:${REMOTE_DIR}/utils/`);

    console.log('2. Injecting into Container...');
    // Create dirs in container
    execSync(`ssh root@${VPS_IP} "docker exec ${CONTAINER} mkdir -p /app/public /app/templates /app/utils"`);

    // Copy content
    execSync(`ssh root@${VPS_IP} "docker cp ${REMOTE_DIR}/public ${CONTAINER}:/app/"`);
    execSync(`ssh root@${VPS_IP} "docker cp ${REMOTE_DIR}/templates ${CONTAINER}:/app/"`);
    execSync(`ssh root@${VPS_IP} "docker cp ${REMOTE_DIR}/server.js ${CONTAINER}:/app/server.js"`);
    execSync(`ssh root@${VPS_IP} "docker cp ${REMOTE_DIR}/package.json ${CONTAINER}:/app/package.json"`);
    execSync(`ssh root@${VPS_IP} "docker cp ${REMOTE_DIR}/utils/tokenManager.js ${CONTAINER}:/app/utils/tokenManager.js"`);

    console.log('3. Installing Dependencies...');
    try {
        execSync(`ssh root@${VPS_IP} "docker exec ${CONTAINER} npm install cookie-parser"`);
    } catch (e) { console.log("   (npm install warning handled)"); }

    console.log('4. Restarting App...');
    execSync(`ssh root@${VPS_IP} "docker restart ${CONTAINER}"`);

    console.log('5. Verifying...');
    console.log(execSync(`ssh root@${VPS_IP} "docker logs --tail 20 ${CONTAINER}"`).toString());

} catch (e) {
    console.error('Force Deploy Failed:', e.message);
}
