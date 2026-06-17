// LAN 测试用独立服务器 — 开发模式下替代 Electron 主进程启动的 WebSocket 服务器
// 用法: node electron/dev-server.cjs [端口]
// 配合 npm run dev 使用，浏览器即可完成双人联机测试

const server = require('./server.cjs');

const PORT = parseInt(process.argv[2], 10) || 9222;

server.start(PORT).then((info) => {
  console.log('');
  console.log('  ✅ LAN 测试服务器已启动');
  console.log(`  📡 地址: ${info.ip}:${info.port}`);
  console.log(`  🔗 开发环境连接: ws://127.0.0.1:${info.port}`);
  console.log('');
  console.log('  测试方法:');
  console.log(`  1. 打开两个浏览器窗口访问 http://localhost:5173`);
  console.log(`  2. 都点击 "局域网联机" → "创建房间"（开发模式自动连接）`);
  console.log(`  3. 或：一个点"创建房间"，另一个点"加入房间"输入 127.0.0.1:${info.port}`);
  console.log('');
  console.log('  ⏎ 按 Ctrl+C 停止服务器');
  console.log('');
}).catch((err) => {
  console.error('服务器启动失败:', err);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n  正在关闭服务器...');
  server.stop();
  process.exit(0);
});
