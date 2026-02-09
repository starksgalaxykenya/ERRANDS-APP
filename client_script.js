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
    const addFundsBtn = document.getElementById('addFundsBtn');
    const submitErrandBtn = document.getElementById('submitErrandBtn');
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    const changePhotoBtn = document.getElementById('changePhotoBtn');
    const confirmAddFunds = document.getElementById('confirmAddFunds');
    const useCurrentLocation = document.getElementById('useCurrentLocation');
    const logoutBtn = document.getElementById('logoutBtn');
    const goToProfileBtn = document.getElementById('goToProfileBtn');
    
    if (refreshBtn) refreshBtn.addEventListener('click', refreshDashboard);
    if (quickPostBtn) quickPostBtn.addEventListener('click', () => showPage('postErrand'));
    if (addFundsBtn) addFundsBtn.addEventListener('click', () => showModal('addFundsModal'));
    if (submitErrandBtn) submitErrandBtn.addEventListener('click', submitErrand);
    if (saveProfileBtn) saveProfileBtn.addEventListener('click', saveProfile);
    if (changePhotoBtn) changePhotoBtn.addEventListener('click', changeProfilePhoto);
    if (confirmAddFunds) confirmAddFunds.addEventListener('click', processPayment);
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
            walletBalance: 5000, // Give new users KSH 5000 for testing
            rating: 5.0,
            totalErrands: 0,
            totalSpent: 0,
            profileComplete: false // Flag to check if profile is complete
        });
        showToast('Account created successfully! You have KSH 5000 in your wallet.', 'success');
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
            // Load wallet data
            loadWalletData();
            
            showToast('Welcome back, ' + (userData.name || 'User') + '!', 'success');
        } else {
            // Create user document if it doesn't exist
            await db.collection('users').doc(currentUser.uid).set({
                email: currentUser.email,
                name: currentUser.displayName || currentUser.email.split('@')[0],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                userType: 'client',
                walletBalance: 5000,
                rating: 5.0,
                totalErrands: 0,
                totalSpent: 0,
                profileComplete: false
            });
            
            userData = {
                email: currentUser.email,
                name: currentUser.displayName || currentUser.email.split('@')[0],
                walletBalance: 5000,
                rating: 5.0,
                profileComplete: false
            };
            
            // Show profile update modal for new users
            setTimeout(() => {
                showModal('profileUpdateModal');
            }, 1000);
            
            updateUserUI();
            showToast('Welcome to ERRANDS! You have KSH 5000 in your wallet.', 'success');
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        showToast('Error loading user data: ' + error.message, 'error');
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
    const walletBalance = document.getElementById('walletBalance');
    
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
    
    // Update wallet balance display
    if (walletBalance) {
        walletBalance.textContent = `KSH ${(userData.walletBalance || 0).toFixed(2)}`;
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
    
    if ((userData.walletBalance || 0) < budgetValue) {
        showToast('Insufficient wallet balance. Please add funds.', 'error');
        showModal('addFundsModal');
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
            status: 'pending',
            bids: [],
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            location: useLocation && useLocation.checked && userLocation ? userLocation : null
        };
        
        // Deduct from wallet
        const newBalance = (userData.walletBalance || 0) - budgetValue;
        await db.collection('users').doc(currentUser.uid).update({
            walletBalance: newBalance
        });
        
        // Create errand
        const errandRef = await db.collection('errands').add(errandData);
        
        // Create escrow transaction
        await db.collection('transactions').add({
            errandId: errandRef.id,
            clientId: currentUser.uid,
            amount: budgetValue,
            type: 'escrow_deposit',
            status: 'completed',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Update user stats
        await db.collection('users').doc(currentUser.uid).update({
            totalErrands: firebase.firestore.FieldValue.increment(1),
            walletBalance: newBalance
        });
        
        userData.walletBalance = newBalance;
        updateUserUI();
        
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
        const walletBalance = document.getElementById('walletBalance');
        
        if (activeErrandsCount) activeErrandsCount.textContent = activeCount;
        if (totalSpentElement) totalSpentElement.textContent = `KSH ${totalSpent.toFixed(2)}`;
        if (clientRating) clientRating.textContent = userData.rating?.toFixed(1) || '5.0';
        if (walletBalance) walletBalance.textContent = `KSH ${(userData.walletBalance || 0).toFixed(2)}`;
        
    } catch (error) {
        console.error('Load dashboard error:', error);
        showToast('Error loading dashboard: ' + error.message, 'error');
    }
}

async function loadWalletData() {
    if (!currentUser || !db) return;
    
    try {
        // Update wallet page balance
        const walletPageBalance = document.getElementById('walletPageBalance');
        if (walletPageBalance) {
            walletPageBalance.textContent = `KSH ${(userData.walletBalance || 0).toFixed(2)}`;
        }
        
        // Load transaction history
        const snapshot = await db.collection('transactions')
            .where('userId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();
        
        const transactionHistory = document.getElementById('transactionHistory');
        
        if (snapshot.empty) {
            if (transactionHistory) {
                transactionHistory.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #666;">
                        <i class="fas fa-exchange-alt" style="font-size: 48px; margin-bottom: 20px;"></i>
                        <h3>No transactions yet</h3>
                        <p>Your transaction history will appear here</p>
                    </div>
                `;
            }
        } else {
            let totalDeposits = 0;
            let totalWithdrawals = 0;
            let transactionsHtml = '<div style="display: grid; gap: 15px;">';
            
            snapshot.forEach(doc => {
                const transaction = doc.data();
                const date = transaction.createdAt ? transaction.createdAt.toDate().toLocaleDateString() : 'Recent';
                
                if (transaction.type === 'wallet_topup') {
                    totalDeposits += transaction.amount;
                } else if (transaction.type === 'escrow_deposit') {
                    totalWithdrawals += transaction.amount;
                }
                
                transactionsHtml += `
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: var(--radius); display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600;">${transaction.type === 'wallet_topup' ? 'Wallet Top-up' : 'Errand Payment'}</div>
                            <div style="font-size: 12px; color: #666;">${date}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-weight: 700; color: ${transaction.type === 'wallet_topup' ? 'var(--lime-green)' : 'var(--dark-green)'};">KSH ${transaction.amount.toFixed(2)}</div>
                            <div style="font-size: 12px; color: #666;">${transaction.status}</div>
                        </div>
                    </div>
                `;
            });
            
            transactionsHtml += '</div>';
            if (transactionHistory) transactionHistory.innerHTML = transactionsHtml;
            
            // Update totals
            const totalDepositsElement = document.getElementById('totalDeposits');
            const totalWithdrawalsElement = document.getElementById('totalWithdrawals');
            
            if (totalDepositsElement) totalDepositsElement.textContent = `KSH ${totalDeposits.toFixed(2)}`;
            if (totalWithdrawalsElement) totalWithdrawalsElement.textContent = `KSH ${totalWithdrawals.toFixed(2)}`;
        }
    } catch (error) {
        console.error('Load wallet data error:', error);
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
        total += doc.data().budget || 0;
    });
    return total;
}

async function getActiveErrandsCount() {
    if (!currentUser || !db) return 0;
    
    const snapshot = await db.collection('errands')
        .where('clientId', '==', currentUser.uid)
        .where('status', 'in', ['pending', 'active'])
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
    
    card.innerHTML = `
        <div class="errand-header">
            <span class="errand-type">${errand.errandType || 'Errand'}</span>
            <span class="errand-budget">KSH ${(errand.budget || 0).toFixed(2)}</span>
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
                <div class="errand-detail">
                    <i class="fas fa-calendar"></i>
                    <span>${date}</span>
                </div>
            </div>
        </div>
        <div class="errand-footer">
            <span class="errand-status ${statusClass}">${(errand.status || '').toUpperCase()}</span>
            <div>
                ${errand.status === 'pending' ? `
                <button class="btn btn-outline" onclick="viewBids('${id}')" style="padding: 5px 15px; font-size: 12px;">
                    <i class="fas fa-gavel"></i> View Bids (${errand.bids?.length || 0})
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
        
        const detailsHtml = `
            <div class="errand-details-section">
                <h3>${errand.errandType || 'Errand'}</h3>
                <p style="color: #666; margin-top: 10px;">${errand.description || ''}</p>
            </div>
            
            <div class="errand-details-section">
                <h4>Budget Details</h4>
                <div class="detail-row">
                    <div class="detail-label">Budget:</div>
                    <div class="detail-value">KSH ${(errand.budget || 0).toFixed(2)}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Service Fee (20%):</div>
                    <div class="detail-value">KSH ${(errand.serviceFee || 0).toFixed(2)}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Runner Receives:</div>
                    <div class="detail-value">KSH ${(errand.runnerAmount || 0).toFixed(2)}</div>
                </div>
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
                <div class="detail-row">
                    <div class="detail-label">Status:</div>
                    <div class="detail-value">
                        <span class="errand-status status-${errand.status}">${(errand.status || '').toUpperCase()}</span>
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
                        <div class="bid-details">${bid.message || 'No message provided'}</div>
                        <div class="bid-actions">
                            <button class="btn btn-outline" onclick="rejectBid('${errandId}', ${index})" style="padding: 5px 15px; font-size: 12px;">
                                <i class="fas fa-times"></i> Reject
                            </button>
                            <button class="btn btn-primary" onclick="acceptBid('${errandId}', ${index})" style="padding: 5px 15px; font-size: 12px;">
                                <i class="fas fa-check"></i> Accept
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

async function acceptBid(errandId, bidIndex) {
    if (!currentUser || !db) {
        showToast('Database not available', 'error');
        return;
    }
    
    if (!confirm('Accept this bid? The runner will be notified and the errand will become active.')) {
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
        
        const bid = bids[bidIndex];
        
        // Update errand status and assign runner
        await db.collection('errands').doc(errandId).update({
            status: 'active',
            assignedRunnerId: bid.runnerId,
            assignedRunnerName: bid.runnerName,
            acceptedBid: bid.amount,
            acceptedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showToast('Bid accepted! The runner has been assigned to your errand.', 'success');
        closeModal('bidsModal');
        
        // Refresh errands list
        loadUserErrands();
        loadDashboardData();
    } catch (error) {
        console.error('Accept bid error:', error);
        showToast('Error accepting bid: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

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

// Payment Functions
async function processPayment() {
    if (!currentUser || !db) {
        showToast('Please login first', 'error');
        return;
    }
    
    const addFundsAmount = document.getElementById('addFundsAmount');
    const paymentMethod = document.getElementById('paymentMethod');
    
    if (!addFundsAmount || !paymentMethod) return;
    
    const amount = parseFloat(addFundsAmount.value);
    const method = paymentMethod.value;
    
    if (!amount || amount < 1000) {
        showToast('Minimum amount is KSH 1000', 'error');
        return;
    }
    
    showLoading();
    try {
        // Update user's wallet balance
        const newBalance = (userData.walletBalance || 0) + amount;
        await db.collection('users').doc(currentUser.uid).update({
            walletBalance: newBalance
        });
        
        // Record transaction
        await db.collection('transactions').add({
            userId: currentUser.uid,
            amount: amount,
            type: 'wallet_topup',
            method: method,
            status: 'completed',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        userData.walletBalance = newBalance;
        updateUserUI();
        loadWalletData();
        
        showToast(`Successfully added KSH ${amount.toFixed(2)} to your wallet!`, 'success');
        closeModal('addFundsModal');
    } catch (error) {
        console.error('Payment error:', error);
        showToast('Payment failed: ' + error.message, 'error');
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
function showPage(pageId) {
    pages.forEach(page => page.classList.remove('active'));
    const pageElement = document.getElementById(`${pageId}Page`);
    if (pageElement) {
        pageElement.classList.add('active');
        
        // Load data for specific pages
        if (pageId === 'wallet') {
            loadWalletData();
        } else if (pageId === 'dashboard') {
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
