const { execSync } = require('child_process');

const VPS_IP = "46.38.235.254";
const CONTAINER_NAME = "nuvio-streams-app";

// Source files/folders locally
const ITEMS = [
    { src: 'server.js', dest: '/app/server.js' },
    { src: 'utils/tokenManager.js', dest: '/app/utils/tokenManager.js' },
    { src: 'public', dest: '/app/public' },
    { src: 'templates', dest: '/app/templates' }
];

try {
    console.log('1. Injecting files directly into container...');

    // Create utils dir inside container just in case
    execSync(`ssh root@${VPS_IP} "docker exec ${CONTAINER_NAME} mkdir -p /app/utils"`);

    // Copy file by file / folder by folder using docker cp
    // Note: 'docker cp' works from HOST to CONTAINER.
    // So we first need files ON THE HOST (which we did in previous step scp).
    // The previous deployment uploaded files to /root/linux-deployment/

    // Let's use ssh to execute docker cp ON THE VPS from the VPS path to the Container path
    const REMOTE_BASE = "/root/linux-deployment";

    // server.js
    console.log('   Injecting server.js...');
    execSync(`ssh root@${VPS_IP} "docker cp ${REMOTE_BASE}/server.js ${CONTAINER_NAME}:/app/server.js"`);

    // utils
    console.log('   Injecting tokenManager.js...');
    execSync(`ssh root@${VPS_IP} "docker cp ${REMOTE_BASE}/utils/tokenManager.js ${CONTAINER_NAME}:/app/utils/tokenManager.js"`);

    // public folder
    console.log('   Injecting public folder...');
    // docker cp copies the folder itself
    execSync(`ssh root@${VPS_IP} "docker cp ${REMOTE_BASE}/public ${CONTAINER_NAME}:/app/"`);

    // templates folder
    console.log('   Injecting templates folder...');
    execSync(`ssh root@${VPS_IP} "docker cp ${REMOTE_BASE}/templates ${CONTAINER_NAME}:/app/"`);

    console.log('2. Restarting container to pick up changes...');
    execSync(`ssh root@${VPS_IP} "docker restart ${CONTAINER_NAME}"`);

    console.log('3. Checking logs...');
    console.log(execSync(`ssh root@${VPS_IP} "docker logs --tail 20 ${CONTAINER_NAME}"`).toString());

} catch (e) {
    console.error('Injection Failed:', e.message);
}
