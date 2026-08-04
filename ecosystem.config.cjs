module.exports = {
  apps: [{
    name: 'pm-demo',
    script: 'scripts/dev-server.js',
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '256M',
    env: {
      NODE_ENV: 'production',
      PORT: 3847
    }
  }]
};
