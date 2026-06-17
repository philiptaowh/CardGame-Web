import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
//
// v2.2.0-alpha 网页版说明：
//   - 默认（`vite` / `vite build`）→ 桌面 EXE 构建，import.meta.env.MODE === 'desktop'
//   - `vite --mode web` / `vite build --mode web` → 网页版构建，MODE === 'web'
//   - 运行时通过 `src/config/buildMode.ts` 的 `isWebMode()` 单点判断
//
// 端点区分：
//   - desktop: /api/quit 由 quit-server 中间件处理（Electron dev server 关停）
//   - web: 不需要 quit-server；CORS 由后端 Node Express 处理
//
// 环境变量：
//   - VITE_API_BASE: web 模式后端 base URL（默认 ''，相对路径，部署到同源时无需设置）
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'quit-server',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/api/quit') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Server shutting down...');
            console.log('Received quit request. Shutting down server...');
            setTimeout(() => {
              process.exit(0);
            }, 500);
            return;
          }
          next();
        });
      }
    }
  ],
})
