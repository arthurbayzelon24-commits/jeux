import { loadConfig } from './config.js';
import { createApp } from './app.js';

const config = loadConfig();
const app = await createApp(config);

app.server.listen(config.port, config.host, () => {
  console.log(`SOLVEX AI est prêt sur http://${config.host}:${config.port}`);
  for (const provider of app.registry.describe()) {
    const state = provider.configured ? 'configuré' : `non configuré (manque : ${provider.missing.join(', ')})`;
    console.log(`  • ${provider.label} [${provider.kind}] — ${state}`);
  }
  if (!config.accessCode && config.host !== '127.0.0.1' && config.host !== 'localhost') {
    console.warn('  ⚠ Serveur exposé sans SOLVEX_ACCESS_CODE : n’importe qui sur le réseau peut lancer des générations.');
  }
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
}
