const functions = require('firebase-functions');


exports.moinMoin = functions.https.onRequest((request, response) => {
 response.send("Hello from Firebase!");
});
