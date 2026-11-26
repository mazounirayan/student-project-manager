import 'dotenv/config';
import { AppDataSource } from './database/data-source';
import { User } from './entities/Entities';

async function main() {
  const email = process.argv[2];
  if (!email || process.argv.length !== 3) throw new Error('Usage : npm run provision:teacher -- enseignant@example.com');
  await AppDataSource.initialize();
  try {
    const repository = AppDataSource.getRepository(User);
    const user = await repository.findOneBy({ email });
    if (!user) throw new Error("Ce compte doit d'abord être créé via l'inscription");
    user.role = 'teacher';
    await repository.save(user);
    console.log('Compte enseignant créé');
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
