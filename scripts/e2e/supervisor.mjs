// Remains group leader even after the command exits, so cleanup can verify PID identity.
import { spawn } from 'node:child_process';
process.on('SIGTERM', () => {});
process.on('SIGINT', () => {});
let armed = false;
process.on('disconnect', () => { if (!armed) process.exit(0); });
const report = message => { if (process.connected) process.send(message, () => {}); };
setInterval(() => {}, 60_000);
process.once('message', ({command, args, cwd, env}) => {
  // Work arrives only after the launcher persists this supervisor's identity.
  armed = true;
  const child = spawn(command, args, {cwd, env, stdio: ['ignore', 1, 2]});
  child.on('error', () => report({code: 127}));
  child.on('exit', code => report({code: code ?? 1}));
});
report({ready: true});
