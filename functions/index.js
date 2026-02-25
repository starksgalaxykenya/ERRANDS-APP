const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const cors = require('cors')({ origin: true });

admin.initializeApp();

// Tuma API Configuration
const TUMA_API_URL = 'https://api.tuma.co.ke';
const TUMA_BUSINESS_EMAIL = 'starksgalaxykenya@gmail.com';
const TUMA_API_KEY = 'tuma_ed92fb676d58a48626e355191bf10e9aa28a028082a13a0558c8686eb629050f_1771931375';

// Generate Tuma API Token
async function getTumaToken() {
    try {
        const response = await axios.post(`${TUMA_API_URL}/auth/token`, {
            email: TUMA_BUSINESS_EMAIL,
            api_key: TUMA_API_KEY
        });
        return response.data.token;
    } catch (error) {
        console.error('Error getting Tuma token:', error.response?.data || error.message);
        throw new Error('Failed to authenticate with payment gateway');
    }
}

// Cloud Function: Initiate STK Push for bid payment
exports.initiateBidPayment = functions.https.onCall(async (data, context) => {
    // Check authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
    }

    const { errandId, bidIndex, phoneNumber } = data;
    
    if (!errandId || bidIndex === undefined || !phoneNumber) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters');
    }

    try {
        // Get errand details
        const errandDoc = await admin.firestore().collection('errands').doc(errandId).get();
        if (!errandDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Errand not found');
        }

        const errand = errandDoc.data();
        
        // Verify this user owns this errand
        if (errand.clientId !== context.auth.uid) {
            throw new functions.https.HttpsError('permission-denied', 'You do not own this errand');
        }

        // Get the selected bid
        const bids = errand.bids || [];
        if (bidIndex >= bids.length) {
            throw new functions.https.HttpsError('not-found', 'Bid not found');
        }

        const selectedBid = bids[bidIndex];
        const amount = selectedBid.amount;

        // Format phone number (remove leading 0, add 254)
        const formattedPhone = phoneNumber.replace(/^0+/, '254');

        // Get Tuma token
        const token = await getTumaToken();

        // Initiate STK Push
        const stkResponse = await axios.post(
            `${TUMA_API_URL}/payment/stk-push`,
            {
                amount: amount,
                phone: formattedPhone,
                description: `Payment for errand: ${errand.errandType}`,
                callback_url: `https://${process.env.GCLOUD_PROJECT}.cloudfunctions.net/handlePaymentCallback`
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Create payment record
        const paymentRef = await admin.firestore().collection('payments').add({
            errandId: errandId,
            clientId: context.auth.uid,
            amount: amount,
            bidIndex: bidIndex,
            bidderId: selectedBid.runnerId,
            bidderName: selectedBid.runnerName,
            phoneNumber: formattedPhone,
            status: 'pending',
            transactionId: stkResponse.data.transaction_id,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            errandType: errand.errandType,
            description: errand.description
        });

        // Update errand with payment reference
        await errandDoc.ref.update({
            pendingPaymentId: paymentRef.id,
            paymentStatus: 'initiated'
        });

        return {
            success: true,
            message: 'STK Push sent to your phone. Please enter your PIN to complete payment.',
            transactionId: stkResponse.data.transaction_id,
            paymentId: paymentRef.id
        };

    } catch (error) {
        console.error('Payment initiation error:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to initiate payment');
    }
});

// Cloud Function: Handle Payment Callback from Tuma
exports.handlePaymentCallback = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const callbackData = req.body;
            console.log('Payment callback received:', callbackData);

            // Find payment by transaction ID
            const paymentsSnapshot = await admin.firestore()
                .collection('payments')
                .where('transactionId', '==', callbackData.transaction_id)
                .limit(1)
                .get();

            if (paymentsSnapshot.empty) {
                console.error('Payment not found for transaction:', callbackData.transaction_id);
                return res.status(404).json({ error: 'Payment not found' });
            }

            const paymentDoc = paymentsSnapshot.docs[0];
            const paymentData = paymentDoc.data();

            // Update payment status
            await paymentDoc.ref.update({
                status: callbackData.status === 'success' ? 'completed' : 'failed',
                callbackData: callbackData,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // If payment successful, update errand and assign runner
            if (callbackData.status === 'success') {
                const errandDoc = await admin.firestore().collection('errands').doc(paymentData.errandId).get();
                
                if (errandDoc.exists) {
                    const errand = errandDoc.data();
                    const bids = errand.bids || [];
                    const selectedBid = bids[paymentData.bidIndex];

                    // Update errand with accepted bid
                    await errandDoc.ref.update({
                        status: 'active',
                        assignedRunnerId: selectedBid.runnerId,
                        assignedRunnerName: selectedBid.runnerName,
                        acceptedBid: paymentData.amount,
                        acceptedBidServiceFee: paymentData.amount * 0.20,
                        acceptedBidRunnerAmount: paymentData.amount * 0.80,
                        acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
                        paymentCompleted: true,
                        paymentId: paymentDoc.id,
                        paymentStatus: 'completed'
                    });

                    // Update runner stats
                    await admin.firestore().collection('runners').doc(selectedBid.runnerId).update({
                        totalJobs: admin.firestore.FieldValue.increment(1),
                        pendingJobs: admin.firestore.FieldValue.increment(1)
                    });

                    // Create transaction record
                    await admin.firestore().collection('transactions').add({
                        errandId: paymentData.errandId,
                        clientId: paymentData.clientId,
                        runnerId: selectedBid.runnerId,
                        amount: paymentData.amount,
                        serviceFee: paymentData.amount * 0.20,
                        runnerAmount: paymentData.amount * 0.80,
                        type: 'payment_completed',
                        status: 'completed',
                        paymentMethod: 'mpesa',
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            }

            // Send success response to Tuma
            res.status(200).json({ received: true });

        } catch (error) {
            console.error('Callback handling error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
});

// Cloud Function: Check Payment Status
exports.checkPaymentStatus = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
    }

    const { paymentId } = data;

    if (!paymentId) {
        throw new functions.https.HttpsError('invalid-argument', 'Payment ID required');
    }

    try {
        const paymentDoc = await admin.firestore().collection('payments').doc(paymentId).get();
        
        if (!paymentDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Payment not found');
        }

        const payment = paymentDoc.data();

        // Verify user owns this payment
        if (payment.clientId !== context.auth.uid) {
            throw new functions.https.HttpsError('permission-denied', 'Access denied');
        }

        return {
            status: payment.status,
            amount: payment.amount,
            createdAt: payment.createdAt
        };

    } catch (error) {
        console.error('Payment status check error:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// Cloud Function: Get Payment History
exports.getPaymentHistory = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
    }

    try {
        const paymentsSnapshot = await admin.firestore()
            .collection('payments')
            .where('clientId', '==', context.auth.uid)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        const payments = [];
        paymentsSnapshot.forEach(doc => {
            payments.push({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate()
            });
        });

        return { payments };

    } catch (error) {
        console.error('Payment history error:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
