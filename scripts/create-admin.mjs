
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const rl = createInterface({ input, output });

async function main() {
  let connected = false;

  try {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error('MONGODB_URI is missing from .env');
    }

    const fullName = (await rl.question('Admin full name: ')).trim();

    const email = (await rl.question('Admin email: '))
      .trim()
      .toLowerCase();

    if (!fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Valid full name and email are required.');
    }

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });

    connected = true;

    const users = mongoose.connection.collection('users');

    // Never overwrite an existing user.
    const existing = await users.findOne({ email });

    if (existing) {
      console.log('Account already exists. No changes made.');
      return;
    }

    // The first-admin script must not create additional admins.
    const adminExists = await users.findOne({ role: 'admin' });

    if (adminExists) {
      console.log('An Admin already exists. No changes made.');
      return;
    }

    const password = await rl.question('Admin password (12+ characters): ');

    if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
      throw new Error('Password must be 12+ characters and at most 72 bytes.');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Atomic first-admin creation protection using a unique bootstrap lock.
    const locks = mongoose.connection.collection('bootstrap_locks');

    try {
      await locks.insertOne({
        _id: 'first_admin',
        createdAt: new Date(),
      });
    } catch (error) {
      if (error?.code === 11000) {
        console.log('Admin bootstrap already claimed. No changes made.');
        return;
      }
      throw error;
    }

    await users.insertOne({
      fullName,
      email,
      passwordHash,
      role: 'admin',
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log('Admin account created successfully.');
  } catch (error) {
    console.error('Admin setup failed:', error.message);
    process.exitCode = 1;
  } finally {
    rl.close();

    if (connected) {
      await mongoose.disconnect();
    }
  }
}

await main();
