import 'dotenv/config';
import { AppDataSource } from './database/data-source';
import { User } from './entities/Entities';

async function main() {
  const email = process.argv[2];
  if (!email || process.argv.length !== 3) throw new Error('Usage: npm run provision:teacher -- teacher@example.com');
  await AppDataSource.initialize();
  try {
    const repository = AppDataSource.getRepository(User);
    const user = await repository.findOneBy({ email });
    if (!user) throw new Error('Register this account before provisioning it');
    user.role = 'teacher';
    await repository.save(user);
    console.log('Teacher account provisioned');
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
