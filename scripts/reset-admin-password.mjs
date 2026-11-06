
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const rl = createInterface({
  input: stdin,
  output: stdout,
});

async function main() {
  try {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error('MONGODB_URI missing from .env');
    }

    const email = (
      await rl.question('Admin email: ')
    ).trim().toLowerCase();

    if (!email) {
      throw new Error('Admin email is required.');
    }

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });

    const users = mongoose.connection.collection('users');

    const admin = await users.findOne({
      email,
      role: 'admin',
      isActive: true,
    });

    if (!admin) {
      throw new Error('Active Admin account not found.');
    }

    console.log('Admin account verified.');

    const password = await rl.question(
      'New password (minimum 12 characters): ',
    );

    if (
      password.length < 12 ||
      Buffer.byteLength(password, 'utf8') > 72
    ) {
      throw new Error(
        'Password must be at least 12 characters and at most 72 bytes.',
      );
    }

    const confirmation = await rl.question(
      'Confirm new password: ',
    );

    if (password !== confirmation) {
      throw new Error('Passwords do not match.');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await users.updateOne(
      {
        _id: admin._id,
        role: 'admin',
        isActive: true,
      },
      {
        $set: {
          passwordHash,
          updatedAt: new Date(),
        },
      },
    );

    if (result.modifiedCount !== 1) {
      throw new Error('Password update was not completed.');
    }

    console.log('Admin password updated successfully.');
  } catch (error) {
    console.error('Password reset failed:', error.message);
    process.exitCode = 1;
  } finally {
    rl.close();
    await mongoose.disconnect();
  }
}

await main();
