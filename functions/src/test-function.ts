import * as functions from 'firebase-functions';

export const testFunction = functions.https.onCall(async (data, context) => {
  return { message: 'Test function works!' };
});

