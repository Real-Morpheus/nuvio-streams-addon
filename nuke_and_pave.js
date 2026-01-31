const { execSync } = require('child_process');

const VPS_IP = "46.38.235.254";
const TARGET_DIR = "/root/linux-deployment";

try {
    console.log('1. Stopping and Removing Containers...');
    // Try to stop specific containers first
    try {
        execSync(`ssh root@${VPS_IP} "docker stop nuvio-streams-app caddy mediaflow-proxy"`);
        execSync(`ssh root@${VPS_IP} "docker rm -f nuvio-streams-app caddy mediaflow-proxy"`);
    } catch (e) { console.log('   (Some containers might not exist, ignoring)'); }

    console.log('2. Pruning Networks...');
    // Prune unused networks
    execSync(`ssh root@${VPS_IP} "docker network prune -f"`);

    console.log('3. Force Removing Specific Network...');
    // Try to remove the stuck network specifically
    try {
        execSync(`ssh root@${VPS_IP} "docker network rm linux-deployment_nuvio-network"`);
    } catch (e) { console.log('   (Network might be gone already)'); }

    console.log('4. Starting Fresh...');
    execSync(`ssh root@${VPS_IP} "cd ${TARGET_DIR} && docker compose up -d"`);

    console.log('5. Checking State...');
    console.log(execSync(`ssh root@${VPS_IP} "docker ps"`).toString());

} catch (e) {
    console.error('Nuke & Pave Failed:', e.message);
}
