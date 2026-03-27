require('dotenv').config();

const app = require('./app');
const { connectMongo } = require('./db');

const PORT = parseInt(process.env.PORT || '3847', 10);

async function main() {
  if (!process.env.ADMIN_TOKEN || String(process.env.ADMIN_TOKEN).length < 16) {
    // eslint-disable-next-line no-console
    console.warn(
      '[spin-wheel] Set ADMIN_TOKEN in .env (min 16 characters) before using the admin panel.'
    );
  }

  await connectMongo();

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Spin wheel server http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
