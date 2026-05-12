const color = {
  reset: '\x1b[0m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  green: '\x1b[32m'
};

const write = (label: string, message: string, tone: string) => {
  process.stdout.write(`${tone}${label}${color.reset} ${message}\n`);
};

export const logger = {
  info(message: string) {
    write('[info]', message, color.blue);
  },
  warn(message: string) {
    write('[warn]', message, color.yellow);
  },
  error(message: string) {
    write('[error]', message, color.red);
  },
  success(message: string) {
    write('[ok]', message, color.green);
  }
};
