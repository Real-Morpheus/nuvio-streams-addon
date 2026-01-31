const { execSync } = require('child_process');

const VPS_IP = "46.38.235.254";
const TARGET_DIR = "/root/linux-deployment";

try {
    console.log('1. Updating Dockerfile for full COPY...');
    // Overwrite Dockerfile to ensure it copies source code
    const dockerfileContent = `
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
# COPY ALL SOURCE CODE
COPY . .
EXPOSE 7000
CMD ["node", "server.js"]
`;
    // We can't write multi-line easily with echo via ssh without escaping hell.
    // So we write locally and scp it.
    console.log('   (Skipping local write, will do via write_to_file tool next pass)');

    console.log('2. Recreating container (Down -> Build -> Up)...');

    // Stop everything
    execSync(`ssh root@${VPS_IP} "cd ${TARGET_DIR} && docker compose down"`);

    // Build with --no-cache to force picking up new files
    execSync(`ssh root@${VPS_IP} "cd ${TARGET_DIR} && docker compose build --no-cache app"`);

    // Start it back up
    execSync(`ssh root@${VPS_IP} "cd ${TARGET_DIR} && docker compose up -d"`);

    console.log('3. Checking logs...');
    console.log(execSync(`ssh root@${VPS_IP} "docker logs --tail 20 nuvio-streams-app"`).toString());

} catch (e) {
    console.error('Recreation Failed:', e.message);
}
