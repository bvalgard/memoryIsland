const admin = require('firebase-admin');
const { onDocumentCreated, onDocumentDeleted, onDocumentWritten } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');

admin.initializeApp();

const db = admin.firestore();
const fieldValue = admin.firestore.FieldValue;
const statsRef = db.doc('adminStats/global');

async function updateStats(delta) {
  const payload = {
    updatedAt: fieldValue.serverTimestamp(),
  };

  if (delta.totalUsers) payload.totalUsers = fieldValue.increment(delta.totalUsers);
  if (delta.totalIslands) payload.totalIslands = fieldValue.increment(delta.totalIslands);
  if (delta.totalCards) payload.totalCards = fieldValue.increment(delta.totalCards);

  await statsRef.set(payload, { merge: true });
}

function sanitizePublicCard(card) {
  return {
    front: card.front,
    back: card.back,
    type: card.type || 'flashcard',
    options: card.options || [],
    correctOptions: card.correctOptions || [],
    explanations: card.explanations || {},
    pairs: card.pairs || [],
    hint: card.hint || '',
    ...(card.imageUrl ? { imageUrl: card.imageUrl } : {}),
    ...(card.backImageUrl ? { backImageUrl: card.backImageUrl } : {}),
  };
}

exports.onUserCreated = onDocumentCreated('users/{userId}', async () => {
  await updateStats({ totalUsers: 1 });
});

exports.onUserDeleted = onDocumentDeleted('users/{userId}', async () => {
  await updateStats({ totalUsers: -1 });
});

exports.onIslandCreated = onDocumentCreated('islands/{islandId}', async () => {
  await updateStats({ totalIslands: 1 });
});

exports.onIslandDeleted = onDocumentDeleted('islands/{islandId}', async (event) => {
  const islandId = event.params.islandId;

  await updateStats({ totalIslands: -1 });

  const cardsSnapshot = await db.collection('cards').where('islandId', '==', islandId).get();
  if (!cardsSnapshot.empty) {
    const batch = db.batch();
    cardsSnapshot.docs.forEach((docSnapshot) => {
      batch.delete(docSnapshot.ref);
    });
    await batch.commit();
  }

  try {
    await db.doc(`published_islands/${islandId}`).delete();
  } catch (error) {
    logger.warn(`Published island ${islandId} did not need cleanup`, error);
  }
});

exports.onCardCreated = onDocumentCreated('cards/{cardId}', async () => {
  await updateStats({ totalCards: 1 });
});

exports.onCardDeleted = onDocumentDeleted('cards/{cardId}', async () => {
  await updateStats({ totalCards: -1 });
});

exports.syncPublishedIsland = onDocumentWritten('islands/{islandId}', async (event) => {
  const islandId = event.params.islandId;
  const after = event.data.after.exists ? event.data.after.data() : null;
  const publishedRef = db.doc(`published_islands/${islandId}`);

  if (!after) {
    try {
      await publishedRef.delete();
    } catch (error) {
      logger.warn(`Published island ${islandId} already absent on delete`, error);
    }
    return;
  }

  if (!(after.isPublic === true && after.approvalStatus === 'approved')) {
    try {
      await publishedRef.delete();
    } catch (error) {
      logger.warn(`Published island ${islandId} already absent for non-approved state`, error);
    }
    return;
  }

  const cardsSnapshot = await db.collection('cards').where('islandId', '==', islandId).get();
  const cards = cardsSnapshot.docs
    .map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }))
    .sort((a, b) => (a.position || 0) - (b.position || 0))
    .map(sanitizePublicCard);

  await publishedRef.set(
    {
      id: islandId,
      name: after.name,
      color_score: after.color_score || 50,
      cards,
      authorId: after.authorId || after.ownerId || null,
      authorName: after.authorName || 'Explorer',
      isPublic: true,
      downloads: after.downloads || 0,
      publishedAt: fieldValue.serverTimestamp(),
    },
    { merge: true }
  );
});
