
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
      await rl.question('HR email: ')
    ).trim().toLowerCase();

    if (!email) {
      throw new Error('HR email is required');
    }

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });

    const users = mongoose.connection.collection('users');

    const hr = await users.findOne({
      email,
      role: 'hr',
      isActive: true,
    });

    if (!hr) {
      throw new Error('Active HR account not found');
    }

    console.log('HR account verified.');

    const password = await rl.question(
      'New HR password (12+ characters): ',
    );

    const confirmation = await rl.question(
      'Confirm new password: ',
    );

    if (
      password.length < 12 ||
      Buffer.byteLength(password, 'utf8') > 72
    ) {
      throw new Error(
        'Password must be 12+ characters and at most 72 bytes',
      );
    }

    if (password !== confirmation) {
      throw new Error('Passwords do not match');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await users.updateOne(
      {
        _id: hr._id,
        role: 'hr',
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
      throw new Error('Password update failed');
    }

    console.log('HR password updated successfully.');
  } catch (error) {
    console.error('Error:', error.message);
    process.exitCode = 1;
  } finally {
    rl.close();
    await mongoose.disconnect();
  }
}

await main();
