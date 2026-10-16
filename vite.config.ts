import { createRequire } from 'node:module';
import { networkInterfaces } from 'node:os';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';

/**
 * Where the two packages actually are: inside node_modules when installed,
 * and a checkout elsewhere on the disk when linked for working on both at
 * once. The dev server has to be allowed to serve from there, and its
 * watcher told not to ignore them.
 */
const at = (pkg: string) => dirname(createRequire(import.meta.url).resolve(`${pkg}/package.json`));
const packages = ['artshape-render', 'artshape-physics'];

const PORT = 5204;

/**
 * `npm run dev:phone` serves the game over HTTPS on the local network. A phone gives its motion sensors, and the
 * room's password its crypto, only to a secure page, and it reaches the game by the machine's LAN address and not by
 * localhost: so the certificate (self-signed, which the phone is asked to trust once) and the address for the QR code
 * are worked out only when asked for, and `npm run dev` is as it always was.
 */
const phoneDev = process.env.PHONE_DEV === '1';

/**
 * The first IPv4 address that is not the loopback, which on a laptop on Wi-Fi is the one a phone can see. A machine
 * with several (a VPN, Docker) may need LAN_HOST set by hand.
 */
function lanHost(): string {
  if (process.env.LAN_HOST) return process.env.LAN_HOST;
  for (const addresses of Object.values(networkInterfaces())) {
    for (const a of addresses ?? []) {
      if (a.family === 'IPv4' && !a.internal) return a.address;
    }
  }
  return 'localhost';
}

export default defineConfig({
  plugins: phoneDev ? [basicSsl()] : [],
  // empty means "this page's own origin", which is what a build and the plain dev server want
  define: { __PHONE_ORIGIN__: JSON.stringify(phoneDev ? `https://${lanHost()}:${PORT}` : '') },
  // two pages: the game, and the phone that is its rod
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        phone: fileURLToPath(new URL('./phone.html', import.meta.url)),
      },
    },
  },
  server: {
    port: PORT,
    strictPort: true,
    ...(phoneDev ? { host: true } : {}),
    watch: { ignored: packages.map((p) => `!**/node_modules/${p}/**`) },
    fs: { allow: ['.', ...packages.map(at)] },
  },
  optimizeDeps: { exclude: packages },
});
