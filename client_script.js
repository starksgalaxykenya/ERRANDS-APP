// client_script.js
// Global Variables
let currentUser = null;
let userData = {};
let userLocation = null;
let isNewUser = false;

// DOM Elements
const loginPage = document.getElementById('loginPage');
const appContainer = document.getElementById('appContainer');
const pages = document.querySelectorAll('.page');
const navLinks = document.querySelectorAll('.nav-link');
const toast = document.getElementById('toast');
const loadingSpinner = document.getElementById('loadingSpinner');
const profileUpdateModal = document.getElementById('profileUpdateModal');

// Initialize the App
document.addEventListener('DOMContentLoaded', function() {
    // Wait a moment for Firebase to initialize
    setTimeout(() => {
        // Initialize event listeners
        initEventListeners();
        
        // Check if Firebase auth is initialized
        if (typeof auth === 'undefined' || !auth) {
            console.error('Firebase auth not initialized');
            showLoginError('Firebase not initialized. Please refresh the page.');
            return;
        }
        
        // Check authentication state
        auth.onAuthStateChanged(user => {
            console.log('Auth state changed:', user ? 'User logged in' : 'No user');
            if (user) {
                currentUser = user;
                loadUserData();
                showApp();
            } else {
                showLogin();
            }
        });
    }, 500); // Give Firebase time to initialize
    
    // Initialize service fee calculation
    const budgetInput = document.getElementById('errandBudget');
    if (budgetInput) {
        budgetInput.addEventListener('input', calculateServiceFee);
        // Calculate initial fee
        calculateServiceFee();
    }
    
    // Initialize travel required toggle
    const travelRadios = document.querySelectorAll('input[name="travelRequired"]');
    if (travelRadios.length > 0) {
        travelRadios.forEach(radio => {
            radio.addEventListener('change', function() {
                const travelDetails = document.getElementById('travelDetails');
                if (travelDetails) {
                    travelDetails.style.display = 
                        this.value === 'yes' ? 'block' : 'none';
                }
            });
        });
    }
    
    // Initialize modern errand type selector
    initializeErrandTypeSelector();
});

// Event Listeners
function initEventListeners() {
    // Login buttons
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    const emailLoginBtn = document.getElementById('emailLoginBtn');
    const signupLink = document.getElementById('signupLink');
    
    if (googleLoginBtn) googleLoginBtn.addEventListener('click', signInWithGoogle);
    if (emailLoginBtn) emailLoginBtn.addEventListener('click', signInWithEmail);
    if (signupLink) signupLink.addEventListener('click', showSignup);
    
    // Navigation
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.getAttribute('data-page');
            if (page === 'logout') {
                logout();
            } else {
                showPage(page);
                
                // Update active state
                navLinks.forEach(l => l.classList.remove('active'));
                this.classList.add('active');
            }
        });
    });
    
    // Buttons
    const refreshBtn = document.getElementById('refreshBtn');
    const quickPostBtn = document.getElementById('quickPostBtn');
    const submitErrandBtn = document.getElementById('submitErrandBtn');
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    const changePhotoBtn = document.getElementById('changePhotoBtn');
    const useCurrentLocation = document.getElementById('useCurrentLocation');
    const logoutBtn = document.getElementById('logoutBtn');
    const goToProfileBtn = document.getElementById('goToProfileBtn');
    
    if (refreshBtn) refreshBtn.addEventListener('click', refreshDashboard);
    if (quickPostBtn) quickPostBtn.addEventListener('click', () => showPage('postErrand'));
    if (submitErrandBtn) submitErrandBtn.addEventListener('click', submitErrand);
    if (saveProfileBtn) saveProfileBtn.addEventListener('click', saveProfile);
    if (changePhotoBtn) changePhotoBtn.addEventListener('click', changeProfilePhoto);
    if (useCurrentLocation) useCurrentLocation.addEventListener('change', getCurrentLocation);
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    if (goToProfileBtn) goToProfileBtn.addEventListener('click', () => {
        closeModal('profileUpdateModal');
        showPage('profile');
    });
    
    // My Errands filter
    const filterButtons = document.querySelectorAll('.btn-group .btn');
    if (filterButtons.length > 0) {
        filterButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.btn-group .btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                const filter = this.getAttribute('data-filter');
                if (filter) {
                    filterErrands(filter);
                }
            });
        });
    }
}

function initializeErrandTypeSelector() {
    const options = document.querySelectorAll('.errand-type-option');
    const customInput = document.getElementById('customErrandType');
    const hiddenInput = document.getElementById('selectedErrandType');
    
    if (options.length === 0) return;
    
    options.forEach(option => {
        option.addEventListener('click', function() {
            // Remove selected class from all options
            options.forEach(opt => opt.classList.remove('selected'));
            
            // Add selected class to clicked option
            this.classList.add('selected');
            
            // Set the value
            const value = this.getAttribute('data-value');
            if (hiddenInput) hiddenInput.value = value;
            
            // Clear custom input
            if (customInput) customInput.value = '';
        });
    });
    
    // When custom input is used, clear selection
    if (customInput) {
        customInput.addEventListener('input', function() {
            options.forEach(opt => opt.classList.remove('selected'));
            if (hiddenInput) hiddenInput.value = this.value || '';
        });
        
        // When custom input loses focus, if it has value, set it
        customInput.addEventListener('blur', function() {
            if (this.value && hiddenInput) {
                hiddenInput.value = this.value;
            }
        });
    }
}

// Support Functions
function callSupport() {
    const phoneNumber = '+254793312993';
    if (confirm(`Call support at ${phoneNumber}?`)) {
        window.open(`tel:${phoneNumber}`, '_self');
    }
}

function whatsappSupport() {
    const phoneNumber = '+254793312993';
    const message = 'Hello ERRANDS Support, I need assistance with:';
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}

// Authentication Functions
async function signInWithGoogle() {
    if (typeof firebase === 'undefined') {
        showLoginError('Firebase not loaded. Please refresh the page.');
        return;
    }
    
    showLoading();
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        await auth.signInWithPopup(provider);
        showToast('Successfully signed in with Google!', 'success');
    } catch (error) {
        console.error('Google sign in error:', error);
        showLoginError('Error signing in with Google: ' + error.message);
    } finally {
        hideLoading();
    }
}

async function signInWithEmail() {
    if (typeof auth === 'undefined') {
        showLoginError('Firebase not initialized. Please refresh the page.');
        return;
    }
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        showLoginError('Please enter email and password');
        return;
    }
    
    showLoading();
    try {
        await auth.signInWithEmailAndPassword(email, password);
        showToast('Successfully signed in!', 'success');
    } catch (error) {
        console.error('Email sign in error:', error);
        // If user doesn't exist, create new account
        if (error.code === 'auth/user-not-found') {
            isNewUser = true;
            await createUserWithEmail(email, password);
        } else {
            showLoginError('Error: ' + error.message);
        }
    } finally {
        hideLoading();
    }
}

async function createUserWithEmail(email, password) {
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        // Create user document in Firestore with minimal data
        await db.collection('users').doc(userCredential.user.uid).set({
            email: email,
            name: email.split('@')[0],
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            userType: 'client',
            rating: 5.0,
            totalErrands: 0,
            profileComplete: false // Flag to check if profile is complete
        });
        showToast('Account created successfully!', 'success');
    } catch (error) {
        console.error('Create user error:', error);
        showLoginError('Error creating account: ' + error.message);
    }
}

async function logout() {
    try {
        await auth.signOut();
        showToast('Successfully logged out!', 'success');
        showLogin();
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Error logging out: ' + error.message, 'error');
    }
}

function showSignup(e) {
    if (e) e.preventDefault();
    showLoginError('Use the test credentials above for demo');
}

function showLoginError(message) {
    const loginStatus = document.getElementById('loginStatus');
    if (loginStatus) {
        loginStatus.textContent = message;
        loginStatus.style.display = 'block';
    }
}

// User Data Functions
async function loadUserData() {
    if (!currentUser || !db) return;
    
    showLoading();
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        
        if (userDoc.exists) {
            userData = userDoc.data();
            
            // Check if profile is complete
            if (!userData.profileComplete || isNewUser) {
                // Show profile update modal for new users or incomplete profiles
                setTimeout(() => {
                    showModal('profileUpdateModal');
                }, 1000);
            }
            
            // Update UI with user data
            updateUserUI();
            
            // Update welcome message
            const welcomeMessage = document.getElementById('welcomeMessage');
            const dashboardWelcome = document.getElementById('dashboardWelcome');
            if (welcomeMessage) {
                welcomeMessage.textContent = `HELLO ${userData.name || 'User'}`;
            }
            if (dashboardWelcome) {
                dashboardWelcome.style.display = 'block';
            }
            
            // Load user's errands
            loadUserErrands();
            // Load dashboard data
            loadDashboardData();
            // Set up real-time listeners for errand updates
            setupErrandListeners();
            
            showToast('Welcome back, ' + (userData.name || 'User') + '!', 'success');
        } else {
            // Create user document if it doesn't exist
            await db.collection('users').doc(currentUser.uid).set({
                email: currentUser.email,
                name: currentUser.displayName || currentUser.email.split('@')[0],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                userType: 'client',
                rating: 5.0,
                totalErrands: 0,
                profileComplete: false
            });
            
            userData = {
                email: currentUser.email,
                name: currentUser.displayName || currentUser.email.split('@')[0],
                rating: 5.0,
                profileComplete: false
            };
            
            // Show profile update modal for new users
            setTimeout(() => {
                showModal('profileUpdateModal');
            }, 1000);
            
            updateUserUI();
            showToast('Welcome to ERRANDS!', 'success');
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        showToast('Error loading user data: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function setupErrandListeners() {
    if (!currentUser || !db) return;
    
    // Listen for updates to client's errands
    db.collection('errands')
        .where('clientId', '==', currentUser.uid)
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'modified') {
                    const errand = change.doc.data();
                    const errandId = change.doc.id;
                    
                    // Check for status changes that need client attention
                    if (errand.status === 'in_progress' && errand.startedAt) {
                        // Runner has started the errand
                        showToast(`Runner has started your errand: ${errand.errandType}`, 'info');
                    } else if (errand.status === 'pending_client_approval' && errand.completionRequestedAt) {
                        // Runner has requested completion
                        showCompletionRequestNotification(errand, errandId);
                    } else if (errand.status === 'completed' && errand.completedAt) {
                        // Errand completed
                        showToast(`Errand completed: ${errand.errandType}`, 'success');
                    }
                    
                    // Refresh the current view if needed
                    const currentPage = getCurrentPage();
                    if (currentPage === 'myErrands') {
                        loadUserErrands();
                    } else if (currentPage === 'dashboard') {
                        loadDashboardData();
                    }
                }
            });
        }, error => {
            console.error('Errand listener error:', error);
        });
}

function showCompletionRequestNotification(errand, errandId) {
    // Calculate based on accepted bid amount
    const acceptedAmount = errand.acceptedBid || 0;
    const serviceFee = acceptedAmount * 0.20;
    const runnerReceives = acceptedAmount - serviceFee;
    
    // Create a custom notification modal
    const modalHtml = `
        <div id="completionRequestModal" class="modal active">
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h2>Errand Completion Request</h2>
                    <button class="close-modal" onclick="closeModal('completionRequestModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <i class="fas fa-check-circle" style="font-size: 64px; color: var(--lime-green);"></i>
                    </div>
                    <h3 style="text-align: center; margin-bottom: 15px;">Runner has completed your errand</h3>
                    <p style="text-align: center; color: #666; margin-bottom: 20px;">
                        <strong>${errand.errandType}</strong><br>
                        ${errand.description}
                    </p>
                    
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: var(--radius); margin-bottom: 20px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                            <span>Accepted Bid Amount:</span>
                            <strong>KSH ${acceptedAmount.toFixed(2)}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px; color: #666;">
                            <span>Service Fee (20%):</span>
                            <span>KSH ${serviceFee.toFixed(2)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-weight: 600; border-top: 1px solid var(--medium-gray); padding-top: 10px;">
                            <span>Runner Receives:</span>
                            <span style="color: var(--dark-green);">KSH ${runnerReceives.toFixed(2)}</span>
                        </div>
                    </div>
                    
                    ${errand.completionNotes ? `
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: var(--radius); margin-bottom: 20px;">
                        <strong>Runner's Notes:</strong>
                        <p style="margin-top: 10px; color: #666;">${errand.completionNotes}</p>
                    </div>
                    ` : ''}
                    
                    <div style="background-color: #e7f3ff; padding: 15px; border-radius: var(--radius); margin-bottom: 20px;">
                        <i class="fas fa-info-circle" style="color: var(--light-blue); margin-right: 10px;"></i>
                        <span style="font-size: 14px;">Please confirm if the errand was completed satisfactorily. If you approve, the payment of KSH ${acceptedAmount.toFixed(2)} (including fees) will be released to the runner.</span>
                    </div>
                    
                    <div style="display: flex; gap: 15px; margin-top: 30px;">
                        <button class="btn btn-success" style="flex: 1;" onclick="approveCompletion('${errandId}')">
                            <i class="fas fa-check"></i> Yes, Finish Errand
                        </button>
                        <button class="btn btn-danger" style="flex: 1; background-color: #dc3545;" onclick="raiseDispute('${errandId}')">
                            <i class="fas fa-exclamation-triangle"></i> Raise Dispute
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove any existing completion modal
    const existingModal = document.getElementById('completionRequestModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add the modal to the body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Also show a toast notification
    showToast('Runner has requested completion of your errand', 'info');
}

// Approve completion function
async function approveCompletion(errandId) {
    showLoading();
    try {
        const errandDoc = await db.collection('errands').doc(errandId).get();
        const errand = errandDoc.data();
        
        // Use accepted bid amount for calculations
        const acceptedAmount = errand.acceptedBid || 0;
        const serviceFee = acceptedAmount * 0.20;
        const runnerReceives = acceptedAmount - serviceFee;
        
        // Update errand status
        await db.collection('errands').doc(errandId).update({
            status: 'completed',
            completedAt: firebase.firestore.FieldValue.serverTimestamp(),
            clientApproved: true,
            finalAmount: acceptedAmount,
            finalServiceFee: serviceFee,
            finalRunnerAmount: runnerReceives
        });
        
        // Release payment to runner
        if (errand.assignedRunnerId) {
            const runnerRef = db.collection('runners').doc(errand.assignedRunnerId);
            await runnerRef.update({
                walletBalance: firebase.firestore.FieldValue.increment(runnerReceives),
                totalJobs: firebase.firestore.FieldValue.increment(1),
                totalEarnings: firebase.firestore.FieldValue.increment(runnerReceives)
            });
            
            // Record transaction
            await db.collection('transactions').add({
                errandId: errandId,
                runnerId: errand.assignedRunnerId,
                clientId: currentUser.uid,
                amount: runnerReceives,
                originalBudget: errand.budget,
                acceptedBid: acceptedAmount,
                serviceFee: serviceFee,
                type: 'payment_release',
                status: 'completed',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        // Update client stats
        await db.collection('users').doc(currentUser.uid).update({
            totalErrands: firebase.firestore.FieldValue.increment(1)
        });
        
        showToast(`Errand marked as complete! KSH ${runnerReceives.toFixed(2)} released to runner.`, 'success');
        
        // Close the modal
        closeModal('completionRequestModal');
        
        // Refresh the view
        loadUserErrands();
        loadDashboardData();
        
    } catch (error) {
        console.error('Error approving completion:', error);
        showToast('Error approving completion: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Raise dispute function
async function raiseDispute(errandId) {
    showLoading();
    try {
        const errandDoc = await db.collection('errands').doc(errandId).get();
        const errand = errandDoc.data();
        
        // Create dispute modal with bid information
        const disputeHtml = `
            <div id="disputeModal" class="modal active">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h2>Raise a Dispute</h2>
                        <button class="close-modal" onclick="closeModal('disputeModal')">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <i class="fas fa-exclamation-triangle" style="font-size: 64px; color: #dc3545;"></i>
                        </div>
                        <p style="margin-bottom: 20px;">Please describe the issue with this errand completion. Our support team will review and get back to you within 24 hours.</p>
                        
                        <div style="background-color: #f8f9fa; padding: 15px; border-radius: var(--radius); margin-bottom: 20px;">
                            <h4 style="margin-bottom: 10px;">Errand Details</h4>
                            <p><strong>Type:</strong> ${errand.errandType}</p>
                            <p><strong>Accepted Bid:</strong> KSH ${(errand.acceptedBid || 0).toFixed(2)}</p>
                            <p><strong>Amount at stake:</strong> KSH ${(errand.acceptedBid || 0).toFixed(2)}</p>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Dispute Reason</label>
                            <select id="disputeReason" class="form-control">
                                <option value="incomplete">Errand not completed properly</option>
                                <option value="damage">Items damaged</option>
                                <option value="late">Extremely late delivery</option>
                                <option value="wrong">Wrong items delivered</option>
                                <option value="other">Other issue</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Description</label>
                            <textarea id="disputeDescription" class="form-control" rows="4" placeholder="Please provide details about the issue..."></textarea>
                        </div>
                        
                        <div style="background-color: #f8d7da; padding: 15px; border-radius: var(--radius); margin-top: 20px;">
                            <i class="fas fa-info-circle" style="color: #dc3545; margin-right: 10px;"></i>
                            <span style="font-size: 14px; color: #721c24;">The payment of KSH ${(errand.acceptedBid || 0).toFixed(2)} will be held in escrow until the dispute is resolved.</span>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="closeModal('disputeModal')">Cancel</button>
                        <button class="btn btn-danger" style="background-color: #dc3545;" onclick="submitDispute('${errandId}')">
                            <i class="fas fa-gavel"></i> Submit Dispute
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Remove any existing dispute modal
        const existingModal = document.getElementById('disputeModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Close the completion modal
        closeModal('completionRequestModal');
        
        // Add dispute modal to body
        document.body.insertAdjacentHTML('beforeend', disputeHtml);
        
    } catch (error) {
        console.error('Error preparing dispute:', error);
        showToast('Error preparing dispute: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Submit dispute function
async function submitDispute(errandId) {
    const reason = document.getElementById('disputeReason').value;
    const description = document.getElementById('disputeDescription').value;
    
    if (!description) {
        showToast('Please provide a description of the issue', 'error');
        return;
    }
    
    showLoading();
    try {
        const errandDoc = await db.collection('errands').doc(errandId).get();
        const errand = errandDoc.data();
        
        const acceptedAmount = errand.acceptedBid || 0;
        const serviceFee = acceptedAmount * 0.20;
        const runnerReceives = acceptedAmount - serviceFee;
        
        // Update errand status to disputed
        await db.collection('errands').doc(errandId).update({
            status: 'disputed',
            disputedAt: firebase.firestore.FieldValue.serverTimestamp(),
            disputeReason: reason,
            disputeDescription: description,
            disputedBy: currentUser.uid,
            disputedAmount: acceptedAmount
        });
        
        // Create dispute ticket in admin dashboard
        await db.collection('disputes').add({
            errandId: errandId,
            clientId: currentUser.uid,
            clientName: userData.name,
            runnerId: errand.assignedRunnerId,
            runnerName: errand.assignedRunnerName,
            errandType: errand.errandType,
            originalBudget: errand.budget,
            acceptedBid: acceptedAmount,
            serviceFee: serviceFee,
            runnerAmount: runnerReceives,
            reason: reason,
            description: description,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Send notification to admin
        await db.collection('adminNotifications').add({
            type: 'new_dispute',
            errandId: errandId,
            message: `New dispute raised for errand: ${errand.errandType} - Amount: KSH ${acceptedAmount.toFixed(2)}`,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showToast('Dispute raised successfully. Support will contact you within 24 hours.', 'success');
        closeModal('disputeModal');
        
        // Refresh the view
        loadUserErrands();
        loadDashboardData();
        
    } catch (error) {
        console.error('Error raising dispute:', error);
        showToast('Error raising dispute: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function updateUserUI() {
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const profilePhone = document.getElementById('profilePhone');
    const profileId = document.getElementById('profileId');
    const profileTown = document.getElementById('profileTown');
    const profileCounty = document.getElementById('profileCounty');
    
    if (userName) userName.textContent = userData.name || 'User';
    if (userEmail) userEmail.textContent = userData.email || (currentUser ? currentUser.email : '...');
    
    if (profileName) profileName.value = userData.name || '';
    if (profileEmail) profileEmail.value = userData.email || (currentUser ? currentUser.email : '');
    if (profilePhone) profilePhone.value = userData.phone || '';
    if (profileId) profileId.value = userData.idNumber || '';
    if (profileTown) profileTown.value = userData.town || '';
    if (profileCounty) profileCounty.value = userData.county || '';
    
    if (userData.photoURL) {
        const userAvatar = document.getElementById('userAvatar');
        const profilePhoto = document.getElementById('profilePhoto');
        if (userAvatar) userAvatar.src = userData.photoURL;
        if (profilePhoto) profilePhoto.src = userData.photoURL;
    }
}

async function saveProfile() {
    if (!currentUser || !db) return;
    
    showLoading();
    try {
        const updates = {
            name: document.getElementById('profileName').value,
            phone: document.getElementById('profilePhone').value,
            idNumber: document.getElementById('profileId').value,
            town: document.getElementById('profileTown').value,
            county: document.getElementById('profileCounty').value,
            profileComplete: true,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('users').doc(currentUser.uid).update(updates);
        
        // Update local userData
        Object.assign(userData, updates);
        
        // Update UI
        updateUserUI();
        
        // Update welcome message
        const welcomeMessage = document.getElementById('welcomeMessage');
        if (welcomeMessage) {
            welcomeMessage.textContent = `HELLO ${userData.name}`;
        }
        
        showToast('Profile updated successfully!', 'success');
    } catch (error) {
        console.error('Save profile error:', error);
        showToast('Error updating profile: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function changeProfilePhoto() {
    if (!currentUser || !storage) return;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        showLoading();
        try {
            // Upload to Firebase Storage
            const storageRef = storage.ref();
            const photoRef = storageRef.child(`profile_photos/${currentUser.uid}/${file.name}`);
            await photoRef.put(file);
            const photoURL = await photoRef.getDownloadURL();
            
            // Update user document
            await db.collection('users').doc(currentUser.uid).update({
                photoURL: photoURL
            });
            
            // Update UI
            const userAvatar = document.getElementById('userAvatar');
            const profilePhoto = document.getElementById('profilePhoto');
            if (userAvatar) userAvatar.src = photoURL;
            if (profilePhoto) profilePhoto.src = photoURL;
            userData.photoURL = photoURL;
            
            showToast('Profile photo updated!', 'success');
        } catch (error) {
            console.error('Photo upload error:', error);
            showToast('Error uploading photo: ' + error.message, 'error');
        } finally {
            hideLoading();
        }
    };
    
    input.click();
}

// Errand Functions
function calculateServiceFee() {
    const budgetInput = document.getElementById('errandBudget');
    const serviceFeeElement = document.getElementById('serviceFee');
    const runnerReceivesElement = document.getElementById('runnerReceives');
    
    if (!budgetInput || !serviceFeeElement || !runnerReceivesElement) return;
    
    const budget = parseFloat(budgetInput.value) || 0;
    const serviceFee = budget * 0.20;
    const runnerReceives = budget - serviceFee;
    
    serviceFeeElement.textContent = serviceFee.toFixed(2);
    runnerReceivesElement.textContent = runnerReceives.toFixed(2);
}

async function submitErrand() {
    if (!currentUser || !db) {
        showToast('Please login first', 'error');
        return;
    }
    
    // Get selected errand type
    const selectedType = document.getElementById('selectedErrandType');
    const customType = document.getElementById('customErrandType');
    const errandType = (customType && customType.value) || (selectedType ? selectedType.value : '');
    
    if (!errandType) {
        showToast('Please select or enter an errand type', 'error');
        return;
    }
    
    const description = document.getElementById('errandDescription');
    const travelRequired = document.querySelector('input[name="travelRequired"]:checked');
    const travelFrom = document.getElementById('travelFrom');
    const travelTo = document.getElementById('travelTo');
    const town = document.getElementById('errandTown');
    const area = document.getElementById('errandArea');
    const runnerNeeds = document.getElementById('runnerNeeds');
    const meetRequired = document.querySelector('input[name="meetRequired"]:checked');
    const budget = document.getElementById('errandBudget');
    const deadline = document.getElementById('errandDeadline');
    const useLocation = document.getElementById('useCurrentLocation');
    
    if (!description || !town || !area || !budget || !travelRequired || !meetRequired) {
        showToast('Please fill all required fields with valid data. Minimum budget is KSH 500.', 'error');
        return;
    }
    
    const budgetValue = parseFloat(budget.value);
    if (budgetValue < 500) {
        showToast('Minimum budget is KSH 500.', 'error');
        return;
    }
    
    showLoading();
    try {
        const errandData = {
            clientId: currentUser.uid,
            clientName: userData.name || 'User',
            errandType: errandType,
            description: description.value,
            travelRequired: travelRequired.value === 'yes',
            travelFrom: travelRequired.value === 'yes' && travelFrom ? travelFrom.value : '',
            travelTo: travelRequired.value === 'yes' && travelTo ? travelTo.value : '',
            town: town.value,
            area: area.value,
            runnerNeeds: runnerNeeds ? runnerNeeds.value : '',
            meetRequired: meetRequired.value === 'yes',
            budget: budgetValue,
            serviceFee: budgetValue * 0.20,
            runnerAmount: budgetValue * 0.80,
            deadline: deadline && deadline.value ? new Date(deadline.value) : null,
            status: 'pending', // Pending bids, not yet paid
            bids: [],
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            paymentRequired: true,
            location: useLocation && useLocation.checked && userLocation ? userLocation : null
        };
        
        // Create errand (no wallet deduction)
        await db.collection('errands').add(errandData);
        
        showToast('Errand posted successfully! Runners can now bid on it.', 'success');
        showPage('myErrands');
        
        // Reset form
        const errandForm = document.getElementById('errandForm');
        if (errandForm) errandForm.reset();
        
        const travelDetails = document.getElementById('travelDetails');
        if (travelDetails) travelDetails.style.display = 'none';
        
        const errandOptions = document.querySelectorAll('.errand-type-option');
        errandOptions.forEach(opt => opt.classList.remove('selected'));
        
        if (selectedType) selectedType.value = '';
        calculateServiceFee();
        
        // Reload errands
        loadUserErrands();
    } catch (error) {
        console.error('Submit errand error:', error);
        showToast('Error posting errand: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function loadUserErrands() {
    if (!currentUser || !db) return;
    
    try {
        const snapshot = await db.collection('errands')
            .where('clientId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();
        
        const errandsList = document.getElementById('myErrandsList');
        if (!errandsList) return;
        
        errandsList.innerHTML = '';
        
        if (snapshot.empty) {
            errandsList.innerHTML = `
                <div style="text-align: center; padding: 40px; background-color: white; border-radius: var(--radius);">
                    <i class="fas fa-tasks" style="font-size: 48px; color: var(--medium-gray); margin-bottom: 20px;"></i>
                    <h3>No errands yet</h3>
                    <p>Post your first errand to get started!</p>
                    <button class="btn btn-primary" onclick="showPage('postErrand')" style="margin-top: 20px;">
                        <i class="fas fa-plus"></i> Post Your First Errand
                    </button>
                </div>
            `;
            return;
        }
        
        snapshot.forEach(doc => {
            const errand = doc.data();
            const errandCard = createErrandCard(errand, doc.id);
            errandsList.appendChild(errandCard);
        });
    } catch (error) {
        console.error('Load errands error:', error);
        showToast('Error loading errands: ' + error.message, 'error');
    }
}

async function loadDashboardData() {
    if (!currentUser || !db) return;
    
    try {
        // Load recent errands
        const snapshot = await db.collection('errands')
            .where('clientId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();
        
        const recentErrands = document.getElementById('recentErrands');
        if (recentErrands) {
            recentErrands.innerHTML = '';
            
            if (snapshot.empty) {
                recentErrands.innerHTML = `
                    <div style="text-align: center; padding: 40px; background-color: white; border-radius: var(--radius);">
                        <i class="fas fa-tasks" style="font-size: 48px; color: var(--medium-gray); margin-bottom: 20px;"></i>
                        <h3>No errands yet</h3>
                        <p>Post your first errand to get started!</p>
                    </div>
                `;
            } else {
                snapshot.forEach(doc => {
                    const errand = doc.data();
                    const errandCard = createErrandCard(errand, doc.id);
                    recentErrands.appendChild(errandCard);
                });
            }
        }
        
        // Update stats
        const activeCount = await getActiveErrandsCount();
        const totalSpent = await getTotalSpent();
        
        const activeErrandsCount = document.getElementById('activeErrandsCount');
        const totalSpentElement = document.getElementById('totalSpent');
        const clientRating = document.getElementById('clientRating');
        
        if (activeErrandsCount) activeErrandsCount.textContent = activeCount;
        if (totalSpentElement) totalSpentElement.textContent = `KSH ${totalSpent.toFixed(2)}`;
        if (clientRating) clientRating.textContent = userData.rating?.toFixed(1) || '5.0';
        
    } catch (error) {
        console.error('Load dashboard error:', error);
        showToast('Error loading dashboard: ' + error.message, 'error');
    }
}

async function getTotalErrands() {
    if (!currentUser || !db) return 0;
    
    const snapshot = await db.collection('errands')
        .where('clientId', '==', currentUser.uid)
        .get();
    return snapshot.size;
}

async function getTotalSpent() {
    if (!currentUser || !db) return 0;
    
    const snapshot = await db.collection('errands')
        .where('clientId', '==', currentUser.uid)
        .where('status', '==', 'completed')
        .get();
    
    let total = 0;
    snapshot.forEach(doc => {
        // Use finalAmount if available, otherwise use acceptedBid, otherwise use budget
        const errand = doc.data();
        total += errand.finalAmount || errand.acceptedBid || errand.budget || 0;
    });
    return total;
}

async function getActiveErrandsCount() {
    if (!currentUser || !db) return 0;
    
    const snapshot = await db.collection('errands')
        .where('clientId', '==', currentUser.uid)
        .where('status', 'in', ['pending', 'active', 'in_progress'])
        .get();
    return snapshot.size;
}

function createErrandCard(errand, id) {
    const card = document.createElement('div');
    card.className = 'errand-card';
    card.dataset.id = id;
    card.dataset.status = errand.status;
    
    const statusClass = `status-${errand.status}`;
    const date = errand.createdAt ? errand.createdAt.toDate().toLocaleDateString() : 'Recent';
    
    let statusText = errand.status.toUpperCase();
    if (errand.status === 'in_progress') {
        statusText = 'IN PROGRESS - RUNNER WORKING';
    } else if (errand.status === 'pending_client_approval') {
        statusText = 'AWAITING YOUR APPROVAL';
    } else if (errand.status === 'disputed') {
        statusText = 'DISPUTED - UNDER REVIEW';
    } else if (errand.status === 'pending') {
        statusText = 'AWAITING BIDS';
    } else if (errand.status === 'active') {
        statusText = 'PAID - AWAITING RUNNER';
    }
    
    // Show the accepted bid amount if available, otherwise show budget
    const displayAmount = errand.acceptedBid || errand.budget || 0;
    
    // Check if payment is required and not yet completed
    const showPaymentStatus = errand.status === 'pending' && errand.paymentRequired;
    
    card.innerHTML = `
        <div class="errand-header">
            <span class="errand-type">${errand.errandType || 'Errand'}</span>
            <span class="errand-budget">KSH ${displayAmount.toFixed(2)}</span>
        </div>
        <div class="errand-body">
            <h3 class="errand-title">${(errand.description || '').substring(0, 60)}${errand.description && errand.description.length > 60 ? '...' : ''}</h3>
            <p class="errand-desc">${errand.description || ''}</p>
            <div class="errand-details">
                <div class="errand-detail">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${errand.town || ''}, ${errand.area || ''}</span>
                </div>
                ${errand.travelRequired ? `
                <div class="errand-detail">
                    <i class="fas fa-route"></i>
                    <span>Travel Required</span>
                </div>
                ` : ''}
                ${errand.runnerNeeds ? `
                <div class="errand-detail">
                    <i class="fas fa-tools"></i>
                    <span>${errand.runnerNeeds}</span>
                </div>
                ` : ''}
                ${errand.assignedRunnerName ? `
                <div class="errand-detail">
                    <i class="fas fa-user"></i>
                    <span>Runner: ${errand.assignedRunnerName}</span>
                </div>
                ` : ''}
                <div class="errand-detail">
                    <i class="fas fa-calendar"></i>
                    <span>${date}</span>
                </div>
            </div>
        </div>
        <div class="errand-footer">
            <span class="errand-status ${statusClass}">${statusText}</span>
            <div>
                ${errand.status === 'pending' ? `
                <button class="btn btn-outline" onclick="viewBids('${id}')" style="padding: 5px 15px; font-size: 12px;">
                    <i class="fas fa-gavel"></i> View Bids (${errand.bids?.length || 0})
                </button>
                ` : ''}
                ${errand.status === 'pending_client_approval' ? `
                <button class="btn btn-success" onclick="showCompletionApproval('${id}')" style="padding: 5px 15px; font-size: 12px; background-color: var(--lime-green);">
                    <i class="fas fa-check"></i> Review & Complete
                </button>
                ` : ''}
                <button class="btn btn-outline" onclick="viewErrandDetails('${id}')" style="padding: 5px 15px; font-size: 12px;">
                    <i class="fas fa-eye"></i> Details
                </button>
            </div>
        </div>
    `;
    
    return card;
}

function filterErrands(filter) {
    const cards = document.querySelectorAll('.errand-card');
    cards.forEach(card => {
        if (filter === 'all' || card.dataset.status === filter) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

function showCompletionApproval(errandId) {
    viewErrandDetails(errandId);
    // The modal will show and we'll add a special section
    setTimeout(() => {
        const detailsContent = document.getElementById('errandDetailsContent');
        if (detailsContent) {
            const approveSection = document.createElement('div');
            approveSection.className = 'errand-details-section';
            approveSection.style.backgroundColor = '#e7f3ff';
            approveSection.style.padding = '20px';
            approveSection.style.borderRadius = 'var(--radius)';
            approveSection.style.marginTop = '20px';
            approveSection.innerHTML = `
                <h4 style="margin-bottom: 15px;">Errand Completion Request</h4>
                <p style="margin-bottom: 20px;">The runner has marked this errand as complete. Please verify and confirm.</p>
                <div style="display: flex; gap: 15px;">
                    <button class="btn btn-success" style="flex: 1;" onclick="approveCompletion('${errandId}')">
                        <i class="fas fa-check"></i> Approve Completion
                    </button>
                    <button class="btn btn-danger" style="flex: 1; background-color: #dc3545;" onclick="raiseDispute('${errandId}')">
                        <i class="fas fa-exclamation-triangle"></i> Raise Dispute
                    </button>
                </div>
            `;
            detailsContent.appendChild(approveSection);
        }
    }, 100);
}

// Errand Details and Bids Functions
async function viewErrandDetails(errandId) {
    if (!db) {
        showToast('Database not available', 'error');
        return;
    }
    
    showLoading();
    try {
        const errandDoc = await db.collection('errands').doc(errandId).get();
        if (!errandDoc.exists) {
            showToast('Errand not found', 'error');
            return;
        }
        
        const errand = errandDoc.data();
        const date = errand.createdAt ? errand.createdAt.toDate().toLocaleString() : 'N/A';
        const deadline = errand.deadline ? new Date(errand.deadline).toLocaleString() : 'Not set';
        
        // Use accepted bid if available, otherwise use budget
        const displayBudget = errand.acceptedBid || errand.budget || 0;
        const serviceFee = displayBudget * 0.20;
        const runnerReceives = displayBudget - serviceFee;
        
        let statusHtml = '';
        if (errand.status === 'in_progress' && errand.startedAt) {
            const startedDate = errand.startedAt.toDate().toLocaleString();
            statusHtml = `
                <div class="detail-row">
                    <div class="detail-label">Started:</div>
                    <div class="detail-value">${startedDate}</div>
                </div>
            `;
        } else if (errand.status === 'pending_client_approval' && errand.completionRequestedAt) {
            const requestedDate = errand.completionRequestedAt.toDate().toLocaleString();
            statusHtml = `
                <div class="detail-row">
                    <div class="detail-label">Completed:</div>
                    <div class="detail-value">${requestedDate}</div>
                </div>
                ${errand.completionNotes ? `
                <div class="detail-row">
                    <div class="detail-label">Runner's Notes:</div>
                    <div class="detail-value">${errand.completionNotes}</div>
                </div>
                ` : ''}
            `;
        } else if (errand.status === 'disputed') {
            statusHtml = `
                <div class="detail-row">
                    <div class="detail-label">Disputed:</div>
                    <div class="detail-value">${errand.disputedAt ? errand.disputedAt.toDate().toLocaleString() : 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Reason:</div>
                    <div class="detail-value">${errand.disputeReason || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Description:</div>
                    <div class="detail-value">${errand.disputeDescription || 'N/A'}</div>
                </div>
            `;
        }
        
        const detailsHtml = `
            <div class="errand-details-section">
                <h3>${errand.errandType || 'Errand'}</h3>
                <p style="color: #666; margin-top: 10px;">${errand.description || ''}</p>
            </div>
            
            <div class="errand-details-section">
                <h4>Payment Details</h4>
                ${errand.acceptedBid ? `
                <div class="detail-row">
                    <div class="detail-label">Original Budget:</div>
                    <div class="detail-value">KSH ${(errand.budget || 0).toFixed(2)}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Accepted Bid:</div>
                    <div class="detail-value" style="color: var(--dark-green); font-weight: 600;">KSH ${(errand.acceptedBid || 0).toFixed(2)}</div>
                </div>
                ` : `
                <div class="detail-row">
                    <div class="detail-label">Budget:</div>
                    <div class="detail-value">KSH ${(errand.budget || 0).toFixed(2)}</div>
                </div>
                `}
                <div class="detail-row">
                    <div class="detail-label">Service Fee (20%):</div>
                    <div class="detail-value">KSH ${serviceFee.toFixed(2)}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Runner Receives:</div>
                    <div class="detail-value">KSH ${runnerReceives.toFixed(2)}</div>
                </div>
                ${errand.paymentCompleted ? `
                <div class="detail-row">
                    <div class="detail-label">Payment Status:</div>
                    <div class="detail-value" style="color: var(--lime-green);">✓ Paid</div>
                </div>
                ` : ''}
            </div>
            
            <div class="errand-details-section">
                <h4>Location Details</h4>
                <div class="detail-row">
                    <div class="detail-label">Town:</div>
                    <div class="detail-value">${errand.town || ''}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Area:</div>
                    <div class="detail-value">${errand.area || ''}</div>
                </div>
                ${errand.travelRequired ? `
                <div class="detail-row">
                    <div class="detail-label">Travel From:</div>
                    <div class="detail-value">${errand.travelFrom || ''}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Travel To:</div>
                    <div class="detail-value">${errand.travelTo || ''}</div>
                </div>
                ` : ''}
            </div>
            
            <div class="errand-details-section">
                <h4>Runner Information</h4>
                ${errand.assignedRunnerName ? `
                <div class="detail-row">
                    <div class="detail-label">Runner:</div>
                    <div class="detail-value">${errand.assignedRunnerName}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Accepted Bid:</div>
                    <div class="detail-value">KSH ${(errand.acceptedBid || 0).toFixed(2)}</div>
                </div>
                ` : '<p>No runner assigned yet</p>'}
            </div>
            
            <div class="errand-details-section">
                <h4>Additional Information</h4>
                <div class="detail-row">
                    <div class="detail-label">Runner Needs:</div>
                    <div class="detail-value">${errand.runnerNeeds || 'None specified'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Meet Required:</div>
                    <div class="detail-value">${errand.meetRequired ? 'Yes' : 'No'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Deadline:</div>
                    <div class="detail-value">${deadline}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Posted:</div>
                    <div class="detail-value">${date}</div>
                </div>
                ${statusHtml}
                <div class="detail-row">
                    <div class="detail-label">Status:</div>
                    <div class="detail-value">
                        <span class="errand-status status-${errand.status}">${errand.status.toUpperCase()}</span>
                    </div>
                </div>
            </div>
            
            ${errand.status === 'pending' ? `
            <div style="text-align: center; margin-top: 20px;">
                <button class="btn btn-primary" onclick="viewBids('${errandId}')">
                    <i class="fas fa-gavel"></i> View Bids (${errand.bids?.length || 0})
                </button>
            </div>
            ` : ''}
            
            ${errand.status === 'pending_client_approval' ? `
            <div class="errand-details-section" style="background-color: #e7f3ff; padding: 20px; border-radius: var(--radius); margin-top: 20px;">
                <h4 style="margin-bottom: 15px;">Errand Completion Request</h4>
                <p style="margin-bottom: 20px;">The runner has marked this errand as complete. Please verify and confirm.</p>
                <div style="display: flex; gap: 15px;">
                    <button class="btn btn-success" style="flex: 1;" onclick="approveCompletion('${errandId}')">
                        <i class="fas fa-check"></i> Approve Completion
                    </button>
                    <button class="btn btn-danger" style="flex: 1; background-color: #dc3545;" onclick="raiseDispute('${errandId}')">
                        <i class="fas fa-exclamation-triangle"></i> Raise Dispute
                    </button>
                </div>
            </div>
            ` : ''}
            
            ${errand.status === 'disputed' ? `
            <div class="errand-details-section" style="background-color: #f8d7da; padding: 20px; border-radius: var(--radius); margin-top: 20px;">
                <h4 style="margin-bottom: 15px; color: #721c24;">Dispute Status</h4>
                <p style="color: #721c24;">This errand is under review by our support team. They will contact you within 24 hours.</p>
            </div>
            ` : ''}
        `;
        
        const errandDetailsContent = document.getElementById('errandDetailsContent');
        if (errandDetailsContent) {
            errandDetailsContent.innerHTML = detailsHtml;
        }
        showModal('errandDetailsModal');
    } catch (error) {
        console.error('View errand details error:', error);
        showToast('Error loading errand details: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function viewBids(errandId) {
    if (!db) {
        showToast('Database not available', 'error');
        return;
    }
    
    showLoading();
    try {
        const errandDoc = await db.collection('errands').doc(errandId).get();
        if (!errandDoc.exists) {
            showToast('Errand not found', 'error');
            return;
        }
        
        const errand = errandDoc.data();
        const bids = errand.bids || [];
        
        const bidsContent = document.getElementById('bidsContent');
        if (!bidsContent) return;
        
        if (bids.length === 0) {
            bidsContent.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-gavel" style="font-size: 48px; color: var(--medium-gray); margin-bottom: 20px;"></i>
                    <h3>No Bids Yet</h3>
                    <p>Runners haven't bid on this errand yet. Check back soon!</p>
                </div>
            `;
        } else {
            let bidsHtml = '<div style="max-height: 400px; overflow-y: auto;">';
            
            // Sort bids by amount (lowest first)
            bids.sort((a, b) => a.amount - b.amount);
            
            bids.forEach((bid, index) => {
                const bidServiceFee = bid.amount * 0.20;
                const bidRunnerReceives = bid.amount - bidServiceFee;
                
                bidsHtml += `
                    <div class="bid-card">
                        <div class="bid-header">
                            <div class="bid-amount">KSH ${(bid.amount || 0).toFixed(2)}</div>
                            <div class="bid-runner">
                                <img src="${bid.runnerPhoto || 'https://ui-avatars.com/api/?name=RUNNER&background=1e90ff&color=fff'}" 
                                     alt="Runner" class="bid-runner-avatar">
                                <div>
                                    <div class="bid-runner-name">${bid.runnerName || 'Runner'}</div>
                                    <div style="font-size: 12px; color: #666;">Rating: ${bid.runnerRating || '5.0'}</div>
                                </div>
                            </div>
                        </div>
                        <div class="bid-details">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 13px;">
                                <span>Service Fee (20%):</span>
                                <span>KSH ${bidServiceFee.toFixed(2)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 13px;">
                                <span>Runner receives:</span>
                                <span style="color: var(--dark-green);">KSH ${bidRunnerReceives.toFixed(2)}</span>
                            </div>
                            <div style="margin-top: 10px; color: #666;">${bid.message || 'No message provided'}</div>
                        </div>
                        <div class="bid-actions">
                            <button class="btn btn-outline" onclick="rejectBid('${errandId}', ${index})" style="padding: 5px 15px; font-size: 12px;">
                                <i class="fas fa-times"></i> Reject
                            </button>
                            <button class="btn btn-primary" onclick="acceptBid('${errandId}', ${index})" style="padding: 5px 15px; font-size: 12px;">
                                <i class="fas fa-check"></i> Accept & Pay
                            </button>
                        </div>
                    </div>
                `;
            });
            
            bidsHtml += '</div>';
            bidsContent.innerHTML = bidsHtml;
        }
        
        showModal('bidsModal');
    } catch (error) {
        console.error('View bids error:', error);
        showToast('Error loading bids: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// NEW FUNCTION: Accept bid and initiate payment
async function acceptBid(errandId, bidIndex) {
    if (!currentUser || !db) {
        showToast('Please login first', 'error');
        return;
    }
    
    // Show payment modal with phone number input
    showPaymentModal(errandId, bidIndex);
}

// NEW FUNCTION: Show payment modal
function showPaymentModal(errandId, bidIndex) {
    // Create payment modal HTML
    const modalHtml = `
        <div id="paymentModal" class="modal active">
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h2>Complete Payment</h2>
                    <button class="close-modal" onclick="closeModal('paymentModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <i class="fas fa-lock" style="font-size: 48px; color: var(--lime-green);"></i>
                    </div>
                    <p style="margin-bottom: 20px;">To accept this bid and start the errand, please complete payment via M-Pesa.</p>
                    
                    <div class="form-group">
                        <label class="form-label">M-Pesa Phone Number</label>
                        <input type="tel" id="paymentPhone" class="form-control" placeholder="0712345678" value="0712345678">
                        <small style="color: #666;">Enter the M-Pesa registered phone number</small>
                    </div>
                    
                    <div id="paymentStatus" style="margin-top: 20px;"></div>
                    
                    <button id="initiatePaymentBtn" class="btn btn-primary" style="width: 100%; margin-top: 20px;" onclick="initiatePayment('${errandId}', ${bidIndex})">
                        <i class="fas fa-money-bill-wave"></i> Pay Now
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing payment modal if any
    const existingModal = document.getElementById('paymentModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// NEW FUNCTION: Initiate payment via Firebase Function
async function initiatePayment(errandId, bidIndex) {
    const phoneInput = document.getElementById('paymentPhone');
    const paymentStatus = document.getElementById('paymentStatus');
    const initiateBtn = document.getElementById('initiatePaymentBtn');
    
    if (!phoneInput || !phoneInput.value) {
        showToast('Please enter your M-Pesa phone number', 'error');
        return;
    }
    
    // Validate phone number (simple validation)
    const phone = phoneInput.value.trim();
    if (!phone.match(/^(0|254)[0-9]{9}$/)) {
        showToast('Please enter a valid Kenyan phone number (e.g., 0712345678)', 'error');
        return;
    }
    
    // Disable button and show loading
    initiateBtn.disabled = true;
    initiateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    
    if (paymentStatus) {
        paymentStatus.innerHTML = '<div class="alert alert-info">Initiating payment...</div>';
    }
    
    try {
        // Call Firebase Function
        const initiatePaymentFunction = firebase.functions().httpsCallable('initiateBidPayment');
        const result = await initiatePaymentFunction({
            errandId: errandId,
            bidIndex: bidIndex,
            phoneNumber: phone
        });
        
        if (result.data.success) {
            // Show STK Push sent message
            paymentStatus.innerHTML = `
                <div class="alert alert-success">
                    <i class="fas fa-check-circle"></i> STK Push sent to your phone.<br>
                    Please enter your M-Pesa PIN to complete the payment.
                </div>
            `;
            
            // Start checking payment status
            startPaymentStatusCheck(result.data.paymentId);
        } else {
            throw new Error(result.data.message || 'Payment initiation failed');
        }
        
    } catch (error) {
        console.error('Payment initiation error:', error);
        
        if (paymentStatus) {
            paymentStatus.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle"></i> ${error.message || 'Failed to initiate payment'}
                </div>
            `;
        }
        
        // Re-enable button
        initiateBtn.disabled = false;
        initiateBtn.innerHTML = '<i class="fas fa-money-bill-wave"></i> Try Again';
    }
}

// NEW FUNCTION: Check payment status periodically
function startPaymentStatusCheck(paymentId) {
    let checkCount = 0;
    const maxChecks = 30; // Check for 2.5 minutes (30 * 5 seconds)
    
    const checkInterval = setInterval(async () => {
        checkCount++;
        
        try {
            const checkStatusFunction = firebase.functions().httpsCallable('checkPaymentStatus');
            const result = await checkStatusFunction({ paymentId: paymentId });
            
            if (result.data.status === 'completed') {
                clearInterval(checkInterval);
                
                // Show success message
                showToast('Payment successful! Errand has been assigned to runner.', 'success');
                
                // Close payment modal
                closeModal('paymentModal');
                
                // Refresh errands list
                loadUserErrands();
                loadDashboardData();
                
            } else if (result.data.status === 'failed') {
                clearInterval(checkInterval);
                
                // Show error
                showToast('Payment failed. Please try again.', 'error');
                
                // Close payment modal
                closeModal('paymentModal');
            }
            
            // If we've checked too many times, stop checking
            if (checkCount >= maxChecks) {
                clearInterval(checkInterval);
                showToast('Payment status check timed out. Please check your transactions.', 'warning');
            }
            
        } catch (error) {
            console.error('Status check error:', error);
            // Don't clear interval on error, continue checking
        }
    }, 5000); // Check every 5 seconds
}

// Reject bid function
async function rejectBid(errandId, bidIndex) {
    if (!currentUser || !db) {
        showToast('Database not available', 'error');
        return;
    }
    
    if (!confirm('Reject this bid? The runner will not be notified.')) {
        return;
    }
    
    showLoading();
    try {
        const errandDoc = await db.collection('errands').doc(errandId).get();
        const errand = errandDoc.data();
        const bids = errand.bids || [];
        
        if (bidIndex >= bids.length) {
            showToast('Bid not found', 'error');
            return;
        }
        
        // Remove the bid from the array
        const updatedBids = bids.filter((bid, index) => index !== bidIndex);
        
        await db.collection('errands').doc(errandId).update({
            bids: updatedBids
        });
        
        showToast('Bid rejected!', 'success');
        viewBids(errandId); // Refresh the bids view
    } catch (error) {
        console.error('Reject bid error:', error);
        showToast('Error rejecting bid: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Location Functions
function getCurrentLocation() {
    if (!navigator.geolocation) {
        showToast('Geolocation is not supported by your browser', 'error');
        return;
    }
    
    showLoading();
    navigator.geolocation.getCurrentPosition(
        (position) => {
            userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            showToast('Location obtained successfully!', 'success');
            hideLoading();
        },
        (error) => {
            showToast('Unable to retrieve location: ' + error.message, 'error');
            hideLoading();
        }
    );
}

// UI Helper Functions
function getCurrentPage() {
    const activePage = document.querySelector('.page.active');
    if (activePage) {
        return activePage.id.replace('Page', '');
    }
    return 'dashboard';
}

function showPage(pageId) {
    pages.forEach(page => page.classList.remove('active'));
    const pageElement = document.getElementById(`${pageId}Page`);
    if (pageElement) {
        pageElement.classList.add('active');
        
        // Load data for specific pages
        if (pageId === 'dashboard') {
            loadDashboardData();
        } else if (pageId === 'myErrands') {
            loadUserErrands();
        }
    }
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

function showToast(message, type = 'info') {
    if (!toast) return;
    
    toast.className = `toast ${type}`;
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = document.getElementById('toastIcon');
    
    if (toastMessage) toastMessage.textContent = message;
    
    if (toastIcon) {
        if (type === 'success') {
            toastIcon.className = 'fas fa-check-circle';
        } else if (type === 'error') {
            toastIcon.className = 'fas fa-exclamation-circle';
        } else {
            toastIcon.className = 'fas fa-info-circle';
        }
    }
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showLoading() {
    if (loadingSpinner) {
        loadingSpinner.style.display = 'flex';
    }
}

function hideLoading() {
    if (loadingSpinner) {
        loadingSpinner.style.display = 'none';
    }
}

function showApp() {
    if (loginPage) loginPage.style.display = 'none';
    if (appContainer) appContainer.style.display = 'flex';
}

function showLogin() {
    if (loginPage) loginPage.style.display = 'flex';
    if (appContainer) appContainer.style.display = 'none';
    currentUser = null;
    userData = {};
    isNewUser = false;
}

function refreshDashboard() {
    loadDashboardData();
    showToast('Dashboard refreshed!', 'success');
}

// Initialize with demo data
window.addEventListener('load', function() {
    // Set demo credentials
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    
    if (emailInput) emailInput.value = 'test@example.com';
    if (passwordInput) passwordInput.value = 'password123';
    
    // Auto-login for demo (remove in production)
    setTimeout(() => {
        if (!currentUser && auth) {
            // Try to sign in with demo credentials
            signInWithEmail();
        }
    }, 1000);
});

// Close modals when clicking outside
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});

// Make functions globally available
window.callSupport = callSupport;
window.whatsappSupport = whatsappSupport;
window.showPage = showPage;
window.closeModal = closeModal;
window.viewBids = viewBids;
window.viewErrandDetails = viewErrandDetails;
window.acceptBid = acceptBid;
window.rejectBid = rejectBid;
window.filterErrands = filterErrands;
window.approveCompletion = approveCompletion;
window.raiseDispute = raiseDispute;
window.submitDispute = submitDispute;
window.showCompletionApproval = showCompletionApproval;
window.initiatePayment = initiatePayment;
