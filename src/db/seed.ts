import { pool } from './pool';
import { runMigrations } from './migrate';
import { userRepository } from '../repositories/user.repository';
import { chatService } from '../services/chat.service';
import { messageService } from '../services/message.service';

async function seed() {
  console.log('--- Starting Database Seeding ---');
  await runMigrations();

  // Create Sample Users
  const usersToCreate = [
    { id: 'user-alice-101', name: 'Alice Smith', email: 'alice@example.com' },
    { id: 'user-bob-102', name: 'Bob Jones', email: 'bob@example.com' },
    { id: 'user-charlie-103', name: 'Charlie Brown', email: 'charlie@example.com' },
    { id: 'user-david-104', name: 'David Miller', email: 'david@example.com' },
  ];

  for (const u of usersToCreate) {
    const exists = await userRepository.findById(u.id);
    if (!exists) {
      await userRepository.create(u);
      console.log(`Created user: ${u.name} (${u.id})`);
    } else {
      console.log(`User already exists: ${u.name} (${u.id})`);
    }
  }

  // Create 1:1 Chat between Alice and Bob
  console.log('\nCreating 1:1 chat between Alice and Bob...');
  const directChatResult = await chatService.getOrCreateDirectChat(
    'user-alice-101',
    'user-bob-102'
  );
  console.log(`Direct Chat ID: ${directChatResult.chatId} (isNew: ${directChatResult.isNew})`);

  // Send sample messages
  const msg1 = await messageService.sendMessage(
    directChatResult.chatId,
    'user-alice-101',
    'Hello Bob! How are you doing?'
  );
  console.log(`Alice sent message: "${msg1.text}" (ID: ${msg1.id})`);

  const msg2 = await messageService.sendMessage(
    directChatResult.chatId,
    'user-bob-102',
    'Hi Alice! All good here, working on the chat backend.'
  );
  console.log(`Bob sent message: "${msg2.text}" (ID: ${msg2.id})`);

  // Bob marks Alice's message as read
  await messageService.markMessageRead(
    directChatResult.chatId,
    msg1.id,
    'user-bob-102'
  );
  console.log(`Bob marked Alice's message as read`);

  // Bob updates last seen to Alice's message
  await messageService.updateLastSeen(
    directChatResult.chatId,
    'user-bob-102',
    msg1.id
  );
  console.log(`Bob updated last seen to message ${msg1.id}`);

  // Create Sample Group Chat
  console.log('\nCreating sample Group Chat...');
  const group = await chatService.createGroupChat({
    name: 'Engineering Team',
    creatorId: 'user-alice-101',
    memberIds: ['user-bob-102', 'user-charlie-103'],
  });
  console.log(`Created Group Chat "${group.name}" with ID: ${group.id}`);

  await messageService.sendMessage(
    group.id,
    'user-alice-101',
    'Welcome to the Engineering chat room everyone!'
  );

  console.log('\n--- Seeding Completed Successfully! ---');
}

if (require.main === module) {
  seed()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Seeding failed:', err);
      await pool.end();
      process.exit(1);
    });
}
