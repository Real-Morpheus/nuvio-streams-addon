module.exports = {
    apps: [{
        name: 'nuvio-streams-addon',
        script: './server.js',
        instances: 'max',
        exec_mode: 'cluster',
        env: {
            NODE_ENV: 'production',
            PORT: 7000
        },
        error_file: './logs/pm2-error.log',
        out_file: './logs/pm2-out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        merge_logs: true,
        max_memory_restart: '1G',
        autorestart: true,
        max_restarts: 10,
        min_uptime: '10s',
        listen_timeout: 10000,
        kill_timeout: 5000,
        wait_ready: false,
        watch: false
    }]
};
