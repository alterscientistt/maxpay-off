import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getDatabase, ref, set, get, child, onValue, update, runTransaction, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCBMAH-2xt9JXOLojI6X81oCdtmxGNTqFs",
  authDomain: "max-pay-56450.firebaseapp.com",
  databaseURL: "https://max-pay-56450-default-rtdb.firebaseio.com",
  projectId: "max-pay-56450",
  storageBucket: "max-pay-56450.firebasestorage.app",
  messagingSenderId: "759262583517",
  appId: "1:759262583517:web:8f7c0fb4dc48a79326d934",
  measurementId: "G-KQB2T7SSQ1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// DOM Elements
const authSection = document.getElementById('auth-section');
const appDashboard = document.getElementById('app-dashboard');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const linkToSignup = document.getElementById('link-to-signup');
const linkToLogin = document.getElementById('link-to-login');
const authSubtitle = document.getElementById('auth-subtitle');
const navItems = document.querySelectorAll('.nav-item');
const sections = document.querySelectorAll('section[id$="section"]');

// State
let currentUser = null;
let currentSectionId = 'home-section';

// --- AUTHENTICATION LOGIC ---

// Only show Landing Page if not logged in
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in
        currentUser = user;
        console.log("User detected:", user.uid);
        authSection.classList.add('hidden');

        // Show chatbot only after login
        showChatbot();

        // Fetch user data from DB
        fetchUserData(user.uid);

        // Load Transaction History Independently
        loadTransactionHistory(user.uid);
        // Process daily short term rewards
        processDailyShortTermRewards(user.uid);
    } else {
        // User is signed out
        currentUser = null;
        console.log("No user signed in.");
        // Show auth section (it was hidden by default)
        authSection.classList.remove('hidden');
        // Hide chatbot on login/register pages
        hideChatbot();
        // Hide dashboard if it was somehow visible
        appDashboard.classList.add('hidden');
    }
});

// Toggle Forms (Login / Signup) with slide animation
function slideToForm(showForm, hideForm, subtitle) {
    hideForm.classList.add('hidden');
    hideForm.classList.remove('slide-form');
    void showForm.offsetWidth; // force reflow
    showForm.classList.remove('hidden');
    showForm.classList.remove('slide-form');
    void showForm.offsetWidth;
    showForm.classList.add('slide-form');
    authSubtitle.textContent = subtitle;
}

if (linkToSignup) {
    linkToSignup.addEventListener('click', (e) => {
        e.preventDefault();
        slideToForm(signupForm, loginForm, "Create your account");
    });
}

if (linkToLogin) {
    linkToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        slideToForm(loginForm, signupForm, "Welcome back!");
    });
}

// Handle LOGIN
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerText;

        if (!email || !password) return;

        submitBtn.innerText = "Logging in...";
        submitBtn.disabled = true;

        signInWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                // Signed in 
                const user = userCredential.user;
                // showModal('Success', '✅ Login Successful!', 'success'); // Optional
                // onAuthStateChanged will handle the redirection
            })
            .catch((error) => {
                const errorCode = error.code;
                const errorMessage = error.message;
                console.error("Login Error", errorCode, errorMessage);
                showModal('Login Failed', '❌ ' + errorMessage, 'error');
                submitBtn.innerText = originalText;
                submitBtn.disabled = false;
            });
    });
}

// Handle SIGNUP
if (signupForm) {
    const nameInput = document.getElementById('signup-name');
    const nameStatus = document.getElementById('name-status');
    const nameHelper = document.getElementById('name-helper');
    let nameAvailable = false;

    function validateName(val) {
        if (!val) return { valid: false, msg: '' };
        if (val.length < 3) return { valid: false, msg: 'Too short (min 3 chars)' };
        if (val.length > 20) return { valid: false, msg: 'Too long (max 20 chars)' };
        if (!/^[a-zA-Z0-9 _-]+$/.test(val)) return { valid: false, msg: 'Letters, numbers & spaces only' };
        return { valid: true, msg: '' };
    }

    if (nameInput) {
        nameInput.addEventListener('input', function () {
            this.value = this.value.replace(/[^a-zA-Z0-9 _-]/g, '');
            const v = this.value.trim();
            const check = validateName(v);

            if (!v) { nameStatus.textContent = ''; this.classList.remove('valid-name', 'invalid-name'); return; }
            if (!check.valid) {
                nameStatus.textContent = '✕';
                nameStatus.className = 'name-taken';
                this.classList.add('invalid-name');
                this.classList.remove('valid-name');
                nameAvailable = false;
                if (nameHelper) nameHelper.textContent = check.msg;
                return;
            }
            if (nameHelper) nameHelper.textContent = '3-20 characters, letters & numbers only';

            nameStatus.textContent = '⋯';
            nameStatus.className = 'name-checking';

            // Check availability in Firebase
            const usersRef = ref(database, 'users');
            const q = query(usersRef, orderByChild('name'), equalTo(v));
            get(q).then(snap => {
                if (snap.exists()) {
                    nameStatus.textContent = '✕ Taken';
                    nameStatus.className = 'name-taken';
                    nameInput.classList.add('invalid-name');
                    nameInput.classList.remove('valid-name');
                    nameAvailable = false;
                } else {
                    nameStatus.textContent = '✓';
                    nameStatus.className = 'name-available';
                    nameInput.classList.add('valid-name');
                    nameInput.classList.remove('invalid-name');
                    nameAvailable = true;
                }
            }).catch(() => {
                nameAvailable = true;
                nameStatus.textContent = '';
                nameStatus.className = '';
            });
        });
    }

    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = nameInput ? nameInput.value.trim() : '';
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirmPass = document.getElementById('signup-confirm-password').value;
        const referral = document.getElementById('signup-referral').value.trim();
        const submitBtn = signupForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerText;

        // Name validation
        const nameCheck = validateName(name);
        if (!name || !nameCheck.valid) {
            showModal('Error', '⚠️ Please enter a valid name (3-20 characters).', 'error');
            if (nameInput) nameInput.focus();
            return;
        }

        if (!nameAvailable && nameInput && nameInput.value.trim()) {
            showModal('Error', '⚠️ This name is already taken. Please choose another.', 'error');
            if (nameInput) nameInput.focus();
            return;
        }

        if (password !== confirmPass) {
            showModal('Error', '⚠️ Passwords do not match!', 'error');
            return;
        }

        if (password.length < 6) {
            showModal('Weak Password', '⚠️ Password must be at least 6 characters long!', 'error');
            return;
        }

        submitBtn.innerText = "Creating Account...";
        submitBtn.disabled = true;

        createUserWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                const user = userCredential.user;
                const newReferralId = Math.floor(100000 + Math.random() * 900000).toString();

                set(ref(database, 'users/' + user.uid), {
                    name: name,
                    email: email,
                    referral_id: newReferralId,
                    referred_by: referral || "system",
                    balance: 0,
                    investment_count: 0,
                    spins_used: 0,
                    created_at: new Date().toISOString(),
                    welcome_message_sent: false
                })
                    .then(() => {
                        showModal('Welcome!', `🎉 Welcome ${name}! Account Created Successfully! \n\nYour Referral ID: ${newReferralId}`, 'success');
                    })
                    .catch((dbError) => {
                        console.error("DB Error", dbError);
                        showModal('Setup Issue', "⚠️ Account created but profile setup failed.", 'error');
                    });
            })
            .catch((error) => {
                const errorCode = error.code;
                const errorMessage = error.message;
                console.error("Signup Error", errorCode, errorMessage);
                showModal('Signup Failed', '❌ ' + errorMessage, 'error');
                submitBtn.innerText = originalText;
                submitBtn.disabled = false;
            });
    });
}

// Auto welcome message on login/signup
function sendAutoWelcome(name, chatId, isNewUser) {
    const newUserMsg = `Hello ${name} 👋\nWelcome to MAX PAY 🎉\n\n🎁 You have received a welcome bonus! Complete the getting-started tasks to claim ₹1,000.\n\n💰 Start investing to earn daily passive income\n👥 Invite friends and earn referral commissions\n🔥 Upgrade VIP plans for higher earnings\n\nIf you need any help, I'm always here for you 😊`;

    const returningMsg = `Welcome back ${name} 👋\nYour dashboard is ready.`;

    const msg = isNewUser ? newUserMsg : returningMsg;
    const msgId = 'WEL' + Date.now();
    const data = {
        id: msgId,
        text: msg,
        sender: 'admin',
        isAI: true,
        timestamp: Date.now()
    };
    set(ref(database, `support_chats/${chatId}/messages/${msgId}`), data).then(() => {
        update(ref(database, `support_chats/${chatId}`), {
            lastMessage: msg.substring(0, 100),
            lastTimestamp: Date.now(),
            unreadByUser: true
        });
    }).catch(() => {});
}

// Fetch User Data & Update Dashboard (and keep balance in sync when admin approves deposits)
function fetchUserData(userId) {
    const dbRef = ref(database);
    get(child(dbRef, `users/${userId}`)).then((snapshot) => {
        if (snapshot.exists()) {
            const userData = snapshot.val();
            updateDashboardWithUserData(userData, userId);
            checkReferralTasks(userData.referral_id); // Initialize Referral Task Listener
            proceedToDashboard();

            // Auto welcome — first signup only (tracked via Firebase welcome_message_sent)
            const name = userData.name || userData.email || 'User';
            if (!userData.welcome_message_sent) {
                // First-time signup: send full welcome, mark as sent
                sendAutoWelcome(name, userId, true);
                update(ref(database, 'users/' + userId), { welcome_message_sent: true }).catch(function () {});
            } else {
                // Returning user: simple greeting (throttled: once per page load)
                const greetKey = 'greeting_sent_' + userId;
                if (!sessionStorage.getItem(greetKey)) {
                    sendAutoWelcome(name, userId, false);
                    sessionStorage.setItem(greetKey, '1');
                }
            }
        } else {
            updateDashboardWithUserData({ email: auth.currentUser.email }, userId);
            proceedToDashboard();
        }
        // Real-time listener: when admin approves deposit, balance updates live
        onValue(ref(database, 'users/' + userId), (snap) => {
            if (snap.exists()) updateDashboardWithUserData(snap.val(), userId);
        });
    }).catch((error) => {
        console.error("Error fetching data:", error);
    });
}

let isAutoWithdrawing = false;

function updateDashboardWithUserData(userData, explicitUserId) {
    if (!userData) return;

    // --- AUTO WITHDRAWAL LOGIC ---
    const hasUpi = (function() {
        try { return JSON.parse(localStorage.getItem('userUpiIds') || '[]').length > 0; } catch(e) { return false; }
    })();
    if (autoWithdrawalEnabled && hasUpi && userData.balance >= 100 && !isAutoWithdrawing && explicitUserId) {
        isAutoWithdrawing = true;
        
        get(ref(database, 'withdrawals')).then((snap) => {
            let pendingCount = 0;
            if (snap.exists()) {
                const wData = snap.val();
                pendingCount = Object.values(wData).filter(w => w.userId === explicitUserId && w.status === 'Pending').length;
            }
            
            if (pendingCount >= 2) {
                isAutoWithdrawing = false;
                return;
            }

            let calculatedAmount = Math.floor(userData.balance / 100) * 100;
            const withdrawAmount = calculatedAmount > 500 ? 500 : calculatedAmount;
            
            if (withdrawAmount < 100) {
                isAutoWithdrawing = false;
                return;
            }

            let savedUpiIds = [];
            try { 
                savedUpiIds = JSON.parse(localStorage.getItem('userUpiIds')) || []; 
            } catch(e) {}
            const upiId = savedUpiIds[0] || 'No UPI ID Provided';

            const userRef = ref(database, 'users/' + explicitUserId);
            return runTransaction(userRef, (user) => {
                if (user && user.balance >= withdrawAmount) {
                    user.balance -= withdrawAmount;
                }
                return user;
            }).then((result) => {
                if (result.committed) {
                    const finalUser = result.snapshot.val();
                    if (finalUser) {
                        const withdrawId = 'WD' + Date.now() + Math.floor(Math.random() * 1000);
                        const withdrawData = {
                             id: withdrawId,
                             userId: explicitUserId,
                             email: finalUser.email || (auth.currentUser ? auth.currentUser.email : 'Unknown'),
                             amount: withdrawAmount,
                             method: 'Auto-UPI',
                             details: 'Auto-withdrawn to: ' + upiId,
                             status: 'Pending',
                             timestamp: Date.now(),
                             createdAt: new Date().toISOString()
                        };
                        return set(ref(database, 'withdrawals/' + withdrawId), withdrawData);
                    }
                }
            }).then(() => {
                isAutoWithdrawing = false;
                if(typeof showModal === 'function') {
                    showModal('Auto-Withdrawal Initiated', `₹${withdrawAmount} has been automatically moved to your withdrawal section.`, 'success');
                }
            });
        }).catch((err) => {
            isAutoWithdrawing = false;
            console.error('[TXN] Auto-withdrawal failed:', err);
        });
    }
    // ----------------------------

    // Update Profile Name/Phone
    const profileHeader = document.querySelector('.profile-header h2');
    const profileEmail = document.querySelector('.profile-header p');

    const name = userData.name || "Max Pay User";
    const email = userData.email || "";
    const balance = userData.balance !== undefined ? userData.balance : 0;
    const refId = userData.referral_id || "---";

    if (profileHeader) profileHeader.textContent = name;
    if (profileEmail) profileEmail.textContent = email;

    // Update Unique ID
    const uniqueIdElement = document.getElementById('user-unique-id');
    if (uniqueIdElement) {
        uniqueIdElement.textContent = refId;
    }

    // Update Invite Links based on Referral ID
    const primaryLinkElement = document.getElementById('primary-link-code');
    const secondaryLinkElement = document.getElementById('secondary-link-code');
    if (primaryLinkElement) primaryLinkElement.textContent = `maxpay.app/ref/${refId}`;
    if (secondaryLinkElement) secondaryLinkElement.textContent = `maxpay.app/invite/${refId}`;

    // Update Profile Pic
    const profilePic = userData.profile_pic;
    const profileIcon = document.getElementById('profile-icon-default');
    const profileImg = document.getElementById('profile-img-display');

    if (profileImg && profileIcon) {
        if (profilePic) {
            profileImg.src = profilePic;
            profileImg.classList.remove('hidden');
            profileIcon.classList.add('hidden');
        } else {
            profileImg.classList.add('hidden');
            profileIcon.classList.remove('hidden');
        }
    }

    // Update Header Profile Pic
    const headerProfileImg = document.getElementById('header-profile-img');
    const headerProfileIcon = document.getElementById('header-profile-icon');
    if (headerProfileImg && headerProfileIcon) {
        if (profilePic) {
            headerProfileImg.src = profilePic;
            headerProfileImg.classList.remove('hidden');
            headerProfileIcon.classList.add('hidden');
        } else {
            headerProfileImg.classList.add('hidden');
            headerProfileIcon.classList.remove('hidden');
        }
    }

    // Update Main Balance
    const mainBalance = document.getElementById('main-balance');
    if (mainBalance) {
        mainBalance.textContent = `₹${parseFloat(balance).toFixed(2)}`;
    }

    // Update Profile Stats
    const profileInv = document.getElementById('profile-total-investment');
    if (profileInv) profileInv.textContent = `₹${parseFloat(balance).toFixed(2)}`;

    // Load Transactions - Moved to onAuthStateChanged for reliability
    // loadTransactionHistory(targetUserId); 

    // Initialize VIP Logic
    setupVIPLogic(userData);

    // Initialize Newbie Reward Status on refresh
    if (userData.newbie_reward_claimed) {
        const btnVT = document.getElementById('btn-view-tasks');
        const btnCR = document.getElementById('btn-claim-reward');
        if (btnVT) btnVT.classList.add('hidden');
        if (btnCR) {
            btnCR.classList.remove('hidden');
            btnCR.innerText = 'Claimed';
            btnCR.disabled = true;
        }
        const tpBar = document.getElementById('task-progress-bar');
        const tpCount = document.getElementById('task-count');
        if (tpBar) tpBar.style.width = '100%';
        if (tpCount) tpCount.innerText = '4';
    } else {
        if (typeof checkNewbieTaskStatus === 'function') {
            checkNewbieTaskStatus();
        }
    }
}

function proceedToDashboard() {
    authSection.classList.add('hidden');
    appDashboard.classList.remove('hidden');

    // Show Spin Button
    const spinBtn = document.getElementById('spin-widget-btn');
    if (spinBtn) spinBtn.classList.remove('hidden');

    // Trigger animation for home section
    const homeSec = document.getElementById('home-section');
    if (homeSec) homeSec.classList.add('animate-fade-in');
}

// LOGOUT
// LOGOUT
window.logoutUser = () => {
    // Direct logout without confirmation
    signOut(auth).then(() => {
        location.reload();
    }).catch((error) => {
        console.error("Logout Error", error);
        showModal('Logout Error', "Failed to log out.", 'error');
    });
}

// --- DASHBOARD UI LOGIC (Navigation, Modals, etc) ---

// Navigation
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = item.getAttribute('data-target');
        if (targetId === currentSectionId) return;

        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        sections.forEach(sec => {
            if (sec.id === targetId) {
                sec.classList.remove('hidden');
                sec.classList.add('animate-fade-in');
            } else {
                sec.classList.add('hidden');
                sec.classList.remove('animate-fade-in');
            }
        });
        currentSectionId = targetId;
        window.scrollTo(0, 0);

        // Re-check newbie task progress whenever returning to home
        if (targetId === 'home-section' && typeof checkNewbieTaskStatus === 'function') {
            checkNewbieTaskStatus();
        }
    });
});

// Header Profile Trigger
const headerProfileTrigger = document.getElementById('header-profile-trigger');
if (headerProfileTrigger) {
    headerProfileTrigger.addEventListener('click', () => {
        // Trigger navigation to profile
        // We simulate a click on the actual nav item to reuse logic
        const profileNav = document.querySelector('.nav-item[data-target="profile-section"]');
        if (profileNav) {
            profileNav.click();
        } else {
            // Fallback manual switch
            sections.forEach(sec => {
                if (sec.id === 'profile-section') {
                    sec.classList.remove('hidden');
                    sec.classList.add('animate-fade-in');
                    window.scrollTo(0, 0);
                    currentSectionId = 'profile-section';
                } else {
                    sec.classList.add('hidden');
                    sec.classList.remove('animate-fade-in');
                }
            });
            navItems.forEach(nav => nav.classList.remove('active'));
        }
    });
}

// Modal Helper
function showModal(title, message, type = 'success') {
    const modal = document.getElementById('message-modal');
    if (!modal) return alert(message);

    const titleEl = document.getElementById('msg-title');
    const textEl = document.getElementById('msg-text');
    const iconEl = document.getElementById('msg-icon');
    const btn = document.getElementById('btn-msg-ok');

    titleEl.textContent = title;
    textEl.innerHTML = message.replace(/\n/g, '<br>');

    if (type === 'success') {
        iconEl.innerHTML = '<i class="fa-solid fa-circle-check" style="color: var(--success);"></i>';
        btn.style.background = 'var(--success)';
        btn.style.color = '#000';
    } else if (type === 'error') {
        iconEl.innerHTML = '<i class="fa-solid fa-circle-xmark" style="color: var(--failed);"></i>';
        btn.style.background = 'var(--failed)';
        btn.style.color = '#fff';
    } else {
        iconEl.innerHTML = '<i class="fa-solid fa-circle-info" style="color: var(--accent-start);"></i>';
        btn.style.background = 'var(--accent-gradient)';
        btn.style.color = '#fff';
    }

    modal.classList.remove('hidden');

    const closeHandler = () => {
        modal.classList.add('hidden');
        btn.removeEventListener('click', closeHandler);
    };

    btn.addEventListener('click', closeHandler);
    modal.onclick = (e) => {
        if (e.target === modal) closeHandler();
    };
}


// Spin Wheel Logic
const spinBtn = document.getElementById('spin-widget-btn');
const spinModal = document.getElementById('spin-modal');
const closeSpinBtn = document.getElementById('close-spin');
const btnSpin = document.getElementById('btn-spin');
const wheel = document.getElementById('lucky-wheel');
const resultDiv = document.getElementById('spin-result');

const spinAvailableEl = document.getElementById('available-spins');
const spinProgressText = document.getElementById('spin-progress-text');
const spinProgressBar = document.getElementById('spin-progress-bar');

if (spinBtn) {
    // Open Modal & Check Eligibility
    spinBtn.addEventListener('click', () => {
        spinModal.classList.remove('hidden');
        checkSpinEligibility();
    });

    closeSpinBtn.addEventListener('click', () => spinModal.classList.add('hidden'));
    spinModal.addEventListener('click', (e) => { if (e.target === spinModal) spinModal.classList.add('hidden'); });

    let rotateValue = 0;
    let currentSpinsUsed = 0;

    // Eligibility Function
    function checkSpinEligibility() {
        if (!auth.currentUser) {
            updateSpinUI(0, 0);
            btnSpin.disabled = true;
            btnSpin.innerText = "Login to Spin";
            return;
        }

        const uid = auth.currentUser.uid;
        // Listen once for fresh data
        get(ref(database, 'users/' + uid)).then(snapshot => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const totalInvestments = parseInt(data.investment_count) || 0;
                const spinsUsed = parseInt(data.spins_used) || 0;

                currentSpinsUsed = spinsUsed;

                // Logic: 1 Spin for every 5 investments
                const earnedSpins = Math.floor(totalInvestments / 5);
                const availableSpins = Math.max(0, earnedSpins - spinsUsed);
                const progress = totalInvestments % 5;

                updateSpinUI(availableSpins, progress);

                if (availableSpins > 0) {
                    btnSpin.disabled = false;
                    btnSpin.innerText = "SPIN NOW";
                } else {
                    btnSpin.disabled = true;
                    btnSpin.innerText = `Invest ${5 - progress} More to Spin`;
                    // Visual feedback
                    btnSpin.style.background = '#444';
                    btnSpin.style.cursor = 'not-allowed';
                }
            } else {
                updateSpinUI(0, 0);
            }
        });
    }

    function updateSpinUI(available, progress) {
        if (spinAvailableEl) spinAvailableEl.textContent = available;
        if (spinProgressText) spinProgressText.textContent = `${progress}/5 Investments`;
        if (spinProgressBar) spinProgressBar.style.width = `${(progress / 5) * 100}%`;

        // Reset button style if available
        if (available > 0) {
            btnSpin.style.background = ''; // Reset to CSS default
            btnSpin.style.cursor = 'pointer';
        }
    }

    btnSpin.addEventListener('click', () => {
        // Double check client-side
        if (btnSpin.innerText.includes('More to Spin')) return;

        btnSpin.disabled = true;
        btnSpin.innerText = 'Spinning...';
        resultDiv.classList.add('hidden');

        // Prizes configuration (Must match HTML order)
        // 0: 500
        // 1: Try Again
        // 2: Respin
        // 3: 30
        // 4: Try Again
        // 5: Respin
        // 6: 999
        // 7: Try Again
        const prizes = [
            { label: "500", value: 500, type: "win" },
            { label: "Try Again", value: 0, type: "loss" },
            { label: "Respin", value: 0, type: "respin" },
            { label: "30", value: 30, type: "win" },
            { label: "Try Again", value: 0, type: "loss" },
            { label: "Respin", value: 0, type: "respin" },
            { label: "999", value: 999, type: "win" },
            { label: "Try Again", value: 0, type: "loss" }
        ];

        // Randomly pick a winning index (0-7)
        let winningIndex = Math.floor(Math.random() * prizes.length);
        
        // Custom spin outcomes
        if (currentSpinsUsed === 0) {
            // First spin: 30 rupee
            winningIndex = 3; // Index 3 is '30'
        } else if (currentSpinsUsed >= 2 && currentSpinsUsed <= 8) {
            // 3rd, 4th, 5th, 6th, 7th, 8th, 9th spins (currentSpinsUsed 2-8)
            winningIndex = [1, 4, 7][Math.floor(Math.random() * 3)]; // Pick a random 'Try Again' index
        } else if (currentSpinsUsed === 9) {
            // 10th spin: 500 rupee
            winningIndex = 0; // Index 0 is '500'
        }

        const prize = prizes[winningIndex];

        // Calculate rotation
        // Section angle is 45 degrees
        // To land on Index I (centered at I*45 deg), we need to rotate wheel by -I*45 deg
        const segmentAngle = 45;
        const currentRotation = rotateValue % 360;
        const targetRotationRelative = (360 - (winningIndex * segmentAngle)) % 360;

        let rotationNeeded = targetRotationRelative - currentRotation;

        // Ensure strictly positive rotation for smooth forward spin
        if (rotationNeeded <= 0) rotationNeeded += 360;

        // Add extra spins (5 to 8 full spins)
        const extraSpins = 360 * (5 + Math.floor(Math.random() * 3));
        rotationNeeded += extraSpins;

        rotateValue += rotationNeeded;
        wheel.style.transform = `rotate(${rotateValue}deg)`;

        setTimeout(() => {
            btnSpin.disabled = false;

            // Handle Result
            if (prize.type === 'win') {
                const amount = prize.value;
                resultDiv.innerHTML = `🎉 You Won <i class="fa-solid fa-indian-rupee-sign"></i>${amount}!`;
                resultDiv.style.color = 'var(--success)';

                if (auth.currentUser) {
                    btnSpin.innerText = 'Adding to Wallet...';
                    btnSpin.disabled = true;

                    const uid = auth.currentUser.uid;
                    const userRef = ref(database, 'users/' + uid);

                    // Update balance transactionally
                    runTransaction(child(userRef, 'balance'), (currentBalance) => {
                        return (parseFloat(currentBalance) || 0) + amount;
                    }).then(() => {
                        // Increment spins_used
                        const spinRef = child(userRef, 'spins_used');
                        runTransaction(spinRef, (currentSpins) => {
                            return (currentSpins || 0) + 1;
                        });

                        // Record transaction
                        const txnId = 'SPIN' + Date.now();
                        set(ref(database, 'transactions/' + txnId), {
                            id: txnId,
                            userId: uid,
                            type: 'Spin Win',
                            amount: amount,
                            status: 'Completed',
                            timestamp: Date.now(),
                            description: `Won ₹${amount} in Lucky Spin`
                        });

                        btnSpin.innerText = 'SPIN AGAIN';
                        btnSpin.disabled = false;
                        showModal('🎉 Congratulations!', `You won ₹${amount}! It has been added to your wallet.`, 'success');
                        checkSpinEligibility(); // Refresh spins count
                    }).catch((error) => {
                        console.error("Spin Update Error:", error);
                        btnSpin.innerText = 'SPIN AGAIN';
                        btnSpin.disabled = false;
                        showModal('Error', 'Failed to update wallet balance. Please contact support.', 'error');
                    });
                } else {
                    btnSpin.innerText = 'Login to Claim';
                    showModal('Login Required', 'Please login to claim your reward!', 'error');
                }

            } else if (prize.type === 'respin') {
                resultDiv.innerText = "🔄 Respin! Spin again for free.";
                resultDiv.style.color = 'var(--accent-start)';
                btnSpin.innerText = 'SPIN NOW';
                // Auto-shake button to encourage click
                btnSpin.classList.add('animate-pulse');
                setTimeout(() => btnSpin.classList.remove('animate-pulse'), 1000);
                // Don't increment spins_used for respin
                checkSpinEligibility();
            } else {
                resultDiv.innerText = "😢 Better luck next time!";
                resultDiv.style.color = 'var(--text-muted)';
                btnSpin.innerText = 'TRY AGAIN';

                // Increment spins_used for loss
                if (auth.currentUser) {
                    const uid = auth.currentUser.uid;
                    const spinRef = ref(database, 'users/' + uid + '/spins_used');
                    runTransaction(spinRef, (currentSpins) => {
                        return (currentSpins || 0) + 1;
                    }).then(() => {
                        checkSpinEligibility();
                    });
                }
            }

            resultDiv.classList.remove('hidden');
        }, 4100); // 4s transition + 100ms buffer
    });
}


// 4. Newbie Task Logic
const taskModal = document.getElementById('task-modal');
const btnViewTasks = document.getElementById('btn-view-tasks');
const closeTaskBtn = document.getElementById('close-task');
const btnClaimReward = document.getElementById('btn-claim-reward');
const taskProgressBar = document.getElementById('task-progress-bar');
const taskCountSpan = document.getElementById('task-count');
const taskButtons = document.querySelectorAll('.btn-task-action');

let completedTasks = 0;
const totalTasks = 4;

// Toggle Task Modal
btnViewTasks.addEventListener('click', () => {
    taskModal.classList.remove('hidden');
    checkNewbieTaskStatus();
});

closeTaskBtn.addEventListener('click', () => {
    taskModal.classList.add('hidden');
});

taskModal.addEventListener('click', (e) => {
    if (e.target === taskModal) {
        taskModal.classList.add('hidden');
    }
});

// 1. Static Event Listeners for Task Buttons
document.querySelectorAll('.btn-task-action').forEach(btn => {
    // We'll use a clean listener management
    btn.onclick = (e) => {
        const btnElement = e.currentTarget;
        const taskId = btnElement.getAttribute('data-task');

        if (btnElement.classList.contains('task-completed')) return;

        if (!auth.currentUser) {
            showModal('Login Required', 'Please login to perform this task.', 'error');
            return;
        }

        if (taskId === '1') {
            handleMobileVerification(btnElement);
        } else if (taskId === '2') {
            // Task 2: Starter Deposit
            taskModal.classList.add('hidden');
            const investNav = document.querySelector('.nav-item[data-target="deposit-section"]');
            if (investNav) investNav.click();
        } else if (taskId === '3') {
            // Task 3: VIP Invest
            taskModal.classList.add('hidden');
            const investNav = document.querySelector('.nav-item[data-target="deposit-section"]');
            if (investNav) investNav.click();
        } else if (taskId === '4') {
            // Task 4: Make a Referral
            taskModal.classList.add('hidden');
            const teamNav = document.querySelector('.nav-item[data-target="teams-section"]');
            if (teamNav) teamNav.click();
        }
    };
});

function checkNewbieTaskStatus() {
    if (!auth.currentUser) return;

    // Reset - we will recalculate in updateTaskProgress based on classes
    completedTasks = 0;

    const userRef = ref(database, 'users/' + auth.currentUser.uid);
    get(userRef).then((snapshot) => {
        if (snapshot.exists()) {
            const userData = snapshot.val();

            if (userData.newbie_reward_claimed) {
                const btnVT = document.getElementById('btn-view-tasks');
                const btnCR = document.getElementById('btn-claim-reward');
                if (btnVT) btnVT.classList.add('hidden');
                if (btnCR) {
                    btnCR.classList.remove('hidden');
                    btnCR.innerText = 'Claimed';
                    btnCR.disabled = true;
                }
                const tpBar = document.getElementById('task-progress-bar');
                const tpCount = document.getElementById('task-count');
                if (tpBar) tpBar.style.width = '100%';
                if (tpCount) tpCount.innerText = '4';
                return; // already claimed, no need to check further
            }

            // Task 1: Mobile Verification
            const btnTask1 = document.querySelector('.btn-task-action[data-task="1"]');
            if (userData.phone_verified) {
                markTaskAsDone(btnTask1, 'Verified');
            } else {
                markTaskAsPending(btnTask1, 'Verify');
            }

            // Task 2: Starter Deposit (100+)
            const btnTask2 = document.querySelector('.btn-task-action[data-task="2"]');
            const hasDeposited = (userData.total_deposited >= 100) || (userData.investment_count >= 1);
            if (hasDeposited) {
                markTaskAsDone(btnTask2, 'Done');
            } else {
                markTaskAsPending(btnTask2, 'Deposit');
            }

            // Task 3: VIP Invest (5000+)
            const btnTask3 = document.querySelector('.btn-task-action[data-task="3"]');
            const hasInvestedVIP = (userData.total_invested >= 5000) || (userData.investment_count >= 25);
            if (hasInvestedVIP) {
                markTaskAsDone(btnTask3, 'Completed');
            } else {
                markTaskAsPending(btnTask3, 'Invest');
            }

            // Task 4: Make a Referral
            const btnTask4 = document.querySelector('.btn-task-action[data-task="4"]');
            
            // We need to check if user has at least 1 referral
            const usersRefBranch = ref(database, 'users');
            const qRef = query(usersRefBranch, orderByChild('referred_by'), equalTo(userData.referral_id));
            get(qRef).then((refSnap) => {
                if (refSnap.exists() && Object.keys(refSnap.val()).length >= 1) {
                    markTaskAsDone(btnTask4, 'Referred');
                } else {
                    markTaskAsPending(btnTask4, 'Refer');
                }
            });
        }
    });
}

function handleTelegramJoin(btnElement) {
    window.open('https://t.me/walletproofficial', '_blank');

    // Optimistic UI update + Database Update
    setTimeout(() => {
        if (auth.currentUser) {
            update(ref(database, 'users/' + auth.currentUser.uid), { telegram_joined: true })
                .then(() => {
                    markTaskAsDone(btnElement, 'Joined');
                    checkNewbieTaskStatus(); // Re-trigger check to update progress bar
                });
        }
    }, 1000);
}

function markTaskAsDone(btn, text) {
    if (!btn) return;
    btn.innerText = text;
    if (!btn.classList.contains('task-completed')) {
        btn.classList.add('task-completed');
    }
    btn.disabled = true;

    // Style for done state
    btn.style.color = 'var(--success)';
    btn.style.borderColor = 'var(--success)';
    btn.style.background = 'rgba(99, 102, 241, 0.12)';

    updateTaskProgress();
}

function markTaskAsPending(btn, text) {
    if (!btn) return;
    btn.innerText = text;
    btn.classList.remove('task-completed');
    btn.disabled = false;

    // Style for pending state
    btn.style.color = 'white';
    btn.style.borderColor = 'rgba(255,255,255,0.2)';
    btn.style.background = 'transparent';
}

// Mobile Verification Modal Logic
const verifyMobileModal = document.getElementById('verify-mobile-modal');
const closeVerifyMobileBtn = document.getElementById('close-verify-mobile');
const mobileInputField = document.getElementById('mobile-input-field');
const btnSubmitMobile = document.getElementById('btn-submit-mobile');
let pendingMobileVerifyBtn = null; // To store which button to update on success

if (closeVerifyMobileBtn && verifyMobileModal) {
    closeVerifyMobileBtn.addEventListener('click', () => verifyMobileModal.classList.add('hidden'));
    verifyMobileModal.addEventListener('click', (e) => {
        if (e.target === verifyMobileModal) verifyMobileModal.classList.add('hidden');
    });
}

function handleMobileVerification(btnElement) {
    pendingMobileVerifyBtn = btnElement;
    if (verifyMobileModal) {
        verifyMobileModal.classList.remove('hidden');
        if (mobileInputField) mobileInputField.value = ''; // clear previous
        if (mobileInputField) mobileInputField.focus();
    }
}

// Handle Submit Mobile
if (btnSubmitMobile && mobileInputField) {
    btnSubmitMobile.addEventListener('click', () => {
        const mobile = mobileInputField.value.trim();

        // Validation
        const phoneRegex = /^[6-9]\d{9}$/;
        if (!phoneRegex.test(mobile)) {
            alert('❌ Please enter a valid 10-digit Indian mobile number (starting with 6, 7, 8, or 9).');
            return;
        }

        if (auth.currentUser) {
            const originalText = btnSubmitMobile.innerText;
            btnSubmitMobile.innerText = "Verifying...";
            btnSubmitMobile.disabled = true;

            update(ref(database, 'users/' + auth.currentUser.uid), {
                mobile_number: mobile,
                phone_verified: true
            }).then(() => {
                verifyMobileModal.classList.add('hidden');
                showModal('Success', '✅ Mobile Number Verified!');

                // Update the task button UI
                if (pendingMobileVerifyBtn) {
                    markTaskAsDone(pendingMobileVerifyBtn, 'Verified');
                    checkNewbieTaskStatus(); // Re-sync
                }

                // Reset modal button
                btnSubmitMobile.innerText = "Verify Now";
                btnSubmitMobile.disabled = false;

            }).catch(err => {
                console.error(err);
                btnSubmitMobile.innerText = originalText;
                btnSubmitMobile.disabled = false;
                alert('Error: Verification failed. Please try again.');
            });
        } else {
            alert('Please login first.');
        }
    });
}

function updateTaskProgress() {
    const executed = document.querySelectorAll('.task-completed').length;
    completedTasks = executed;

    taskCountSpan.innerText = completedTasks;
    const percentage = (completedTasks / totalTasks) * 100;
    taskProgressBar.style.width = `${percentage}%`;

    // Check if all done
    if (completedTasks === totalTasks) {
        setTimeout(() => {
            taskModal.classList.add('hidden');
            btnViewTasks.classList.add('hidden');
            btnClaimReward.classList.remove('hidden');
            // Check if already claimed? user data check ideally.
        }, 1000);
    }
}

btnClaimReward.addEventListener('click', () => {
    if (!auth.currentUser) return;

    const userRef = ref(database, 'users/' + auth.currentUser.uid);
    // Add amount
    runTransaction(userRef, (user) => {
        if (user) {
            if (user.newbie_reward_claimed) return; // already claimed
            user.balance = (user.balance || 0) + 1000;
            user.newbie_reward_claimed = true;
        }
        return user;
    }).then((result) => {
        if (result.committed) {
            showModal('Reward Claimed', '🎉 ₹1,000 Credited to your Max Pay wallet!', 'success');
            btnClaimReward.innerText = 'Claimed';
            btnClaimReward.disabled = true;
        } else {
            showModal('Already Claimed', 'You have already claimed this reward!', 'info');
        }
    }).catch((error) => {
        console.error('Claim Reward Error:', error);
        showModal('Error', 'Failed to claim reward. Please try again.', 'error');
        btnClaimReward.disabled = false;
    });
});

// 5. QR Payment Modal Logic (Stock Investment) - REAL FIREBASE IMPLEMENTATION
const qrModal = document.getElementById('qr-modal');
const closeQrBtn = document.getElementById('close-qr');
const qrAmountDisplay = document.getElementById('qr-amount');
const qrStockName = document.getElementById('qr-stock-name');
const utrInput = document.getElementById('utr-input');
const btnConfirmPayment = document.getElementById('btn-confirm-payment');

// Open payment modal with given label and amount (for stock investment)
function openDepositModal(label, amount, customQrUrl, stockId) {
    if (!auth.currentUser) {
        showModal('Login Required', 'Please login to invest', 'error');
        return;
    }
    qrStockName.innerText = label;
    qrAmountDisplay.innerText = `₹${amount}`;
    utrInput.value = '';
    btnConfirmPayment.disabled = false;
    btnConfirmPayment.innerText = 'Submit UTR';
    qrStockName.style.color = '';
    qrStockName.style.fontSize = '';
    // Store stockId on modal for use during submission
    qrModal.dataset.currentStockId = stockId || '';

    // Set QR code
    const urlToUse = customQrUrl || window.globalScannerUrl || 'upi://pay?pa=maxpay@upi&pn=MaxPay';
    const qrImageElement = document.getElementById('payment-qr-image');
    if (qrImageElement) {
        if (urlToUse.startsWith('upi://')) {
            qrImageElement.src = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(urlToUse);
        } else {
            qrImageElement.src = urlToUse;
        }
    }

    qrModal.classList.remove('hidden');
}

// Load investment stocks from Firebase and render (admin-created)
// LIVE UPDATE: This listener automatically updates all users when admin adds/updates/deletes stocks
const stocksContainer = document.getElementById('stocks-container');
const stocksLoadingEl = document.getElementById('stocks-loading');

// Track which stocks the current user has already claimed
window.userClaimedStocks = new Set();

// Listen to claimed stocks for current user and re-render whenever it changes
onAuthStateChanged(auth, (user) => {
    if (user) {
        onValue(ref(database, 'users/' + user.uid + '/claimed_stocks'), (snap) => {
            window.userClaimedStocks = new Set(snap.exists() ? Object.keys(snap.val()) : []);
            
            // Update Dashboard metrics
            const countEl = document.getElementById('bought-stocks-count');
            if (countEl) {
                countEl.innerText = `${window.userClaimedStocks.size} Stocks`;
            }

            // Re-render so claimed badges update live
            if (window.allLoadedStocks && window.allLoadedStocks.length > 0) {
                renderStockCards(window.allLoadedStocks);
            }
        });
    }
});

// Listen for Scanner / QR setup changes
window.globalScannerUrl = '';
onValue(ref(database, 'settings/scanner_url'), (snapshot) => {
    window.globalScannerUrl = snapshot.val();
});

if (stocksContainer) {
    // Real-time listener: triggers whenever admin changes stocks in Firebase
    window.allLoadedStocks = []; // Cache for filter use
    onValue(ref(database, 'investment_stocks'), (snapshot) => {
        const data = snapshot.val();
        window.allLoadedStocks = data ? Object.keys(data).map(id => ({ id, ...data[id] })) : [];

        // Remove loading indicator if present
        if (stocksLoadingEl && stocksLoadingEl.parentNode) {
            stocksLoadingEl.remove();
        }

        // Clear filter state when stocks reload
        const resultText = document.getElementById('filter-result-text');
        if (resultText) resultText.style.display = 'none';

        // Render all stocks using shared helper
        renderStockCards(window.allLoadedStocks);
    });

    // Event delegation
    stocksContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-invest-stock');
        if (!btn) return;
        const stockName = btn.getAttribute('data-stock');
        const stockPrice = btn.getAttribute('data-price');
        const stockQr = btn.getAttribute('data-qr');
        const stockId = btn.getAttribute('data-stockid');
        // Double-check claimed status before opening modal
        if (stockId && window.userClaimedStocks && window.userClaimedStocks.has(stockId)) {
            showModal('Already Claimed', '✅ You have already purchased this stock!', 'success');
            return;
        }
        if (stockName && stockPrice) openDepositModal(stockName, stockPrice, stockQr, stockId);
    });
}

// ---- Render stock cards helper ----
function renderStockCards(stocks) {
    const container = document.getElementById('stocks-container');
    if (!container) return;
    container.innerHTML = '';

    const sorted = [...stocks].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    if (sorted.length === 0) {
        container.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:30px;"><i class="fa-solid fa-magnifying-glass" style="font-size:1.5rem; margin-bottom:10px; opacity:0.4; display:block;"></i><p>No stocks found in this price range.</p></div>';
        return;
    }

    sorted.forEach(s => {
        const price = parseFloat(s.price) || 0;
        const commission = parseFloat(s.commissionPercent) || 0;
        const totalReturn = price + (price * commission / 100);
        let iconCode = 'fa-chart-line';
        const cat = (s.category || '').toLowerCase();
        if (cat.includes('tech') || cat.includes('software')) iconCode = 'fa-microchip';
        else if (cat.includes('auto') || cat.includes('car')) iconCode = 'fa-car';
        else if (cat.includes('bank') || cat.includes('finance')) iconCode = 'fa-building-columns';
        else if (cat.includes('meta') || cat.includes('crypto')) iconCode = 'fa-coins';
        else if (cat.includes('energy') || cat.includes('power')) iconCode = 'fa-bolt';

        const card = document.createElement('div');
        card.className = 'stock-card';
        // Ultra-premium, enlarged horizontal layout
        card.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 22px 25px; margin-bottom: 15px; border-radius: var(--radius-lg); background: rgba(255,255,255,0.42); backdrop-filter: blur(24px) saturate(180%); -webkit-backdrop-filter: blur(24px) saturate(180%); border: 1px solid rgba(255,255,255,0.55); box-shadow: var(--shadow-premium); gap: 20px; position: relative; overflow: hidden;';
        
        // Vibrant left-side accent
        const glow = document.createElement('div');
        glow.style.cssText = 'position: absolute; left: 0; top: 0; width: 6px; height: 100%; background: var(--accent-gradient); box-shadow: 4px 0 15px var(--accent-glow);';
        card.appendChild(glow);

        const isClaimed = window.userClaimedStocks && window.userClaimedStocks.has(s.id);
        
        card.innerHTML += `
            <!-- Left: High Impact Branding -->
            <div style="display: flex; align-items: center; gap: 18px; flex: 2.2; min-width: 0;">
                <div style="width: 54px; height: 54px; background: var(--accent-purple-light); border: 1.5px solid rgba(99, 102, 241, 0.12); border-radius: 16px; display: flex; align-items: center; justify-content: center; color: var(--accent-purple); flex-shrink: 0; box-shadow: 0 6px 20px rgba(99, 102, 241, 0.04);">
                    <i class="fa-solid ${iconCode}" style="font-size: 1.6rem;"></i>
                </div>
                <div style="min-width: 0;">
                    <h4 style="margin: 0; font-size: 1.25rem; color: var(--text-primary); font-weight: 900; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.03em;">${(s.name || 'Stock').replace(/</g, '&lt;')}</h4>
                </div>
            </div>

            <!-- Middle: Financial Performance Hub -->
            <div style="flex: 3.5; display: flex; align-items: center; justify-content: space-around; gap: 12px; border-left: 1px solid rgba(99, 102, 241, 0.08); padding-left: 20px;">
                <div style="text-align: center;">
                    <p style="margin: 0 0 5px 0; font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em;">Invest</p>
                    <span style="color: var(--text-primary); font-weight: 900; font-size: 1.15rem;">₹${price.toFixed(0)}</span>
                </div>
                <div style="text-align: center;">
                    <p style="margin: 0 0 5px 0; font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em;">Yield</p>
                    <span style="color: var(--accent-purple); font-weight: 900; font-size: 1.15rem;">+${commission.toFixed(0)}%</span>
                </div>
                <div style="text-align: center;">
                    <p style="margin: 0 0 4px 0; font-size: 0.65rem; color: var(--accent-coral); text-transform: uppercase; font-weight: 900; letter-spacing: 0.05em; opacity: 0.8;">Profit Return</p>
                    <span style="color: var(--accent-coral); font-weight: 900; font-size: 1.4rem; filter: drop-shadow(0 2px 5px rgba(235, 87, 87, 0.08));">₹${totalReturn.toFixed(0)}</span>
                </div>
            </div>

            <!-- Right: Interactive Lead -->
            <div style="flex: 0 0 auto;">
                ${isClaimed
                    ? `<div style="width: 50px; height: 50px; border-radius: 14px; background: var(--accent-green-light); color: var(--accent-green); display: flex; align-items: center; justify-content: center; border: 1.5px solid rgba(16, 185, 129, 0.2); box-shadow: inset 0 0 10px rgba(16, 185, 129, 0.05);">
                        <i class="fa-solid fa-circle-check" style="font-size: 1.6rem;"></i>
                       </div>`
                    : `<button class="btn-invest-stock" 
                        data-stock="${(s.name || 'Stock').replace(/"/g, '&quot;')}"
                        data-stockid="${s.id}"
                        data-price="${price.toFixed(2)}"
                        data-qr="${(s.qrUrl || '').replace(/"/g, '&quot;')}"
                        style="width: 50px; height: 50px; border-radius: 14px; background: var(--accent-gradient); color: white; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 10px 25px var(--accent-glow); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); transform-origin: center;">
                        <i class="fa-solid fa-chevron-right" style="font-size: 1.5rem;"></i>
                       </button>`
                }
            </div>
        `;
        container.appendChild(card);
    });
}

// ---- Stock Price Range Filter ----
function applyStockFilter() {
    const minInput = document.getElementById('filter-min-price').value;
    const maxInput = document.getElementById('filter-max-price').value;
    const minVal = minInput !== '' ? parseFloat(minInput) : NaN;
    const maxVal = maxInput !== '' ? parseFloat(maxInput) : NaN;
    const resultText = document.getElementById('filter-result-text');

    if (isNaN(minVal) && isNaN(maxVal)) {
        showModal('Filter', '⚠️ Please enter at least a Min or Max price to filter.', 'error');
        return;
    }
    if (!isNaN(minVal) && !isNaN(maxVal) && minVal > maxVal) {
        showModal('Filter', '⚠️ Min price cannot be greater than Max price.', 'error');
        return;
    }

    const stocks = window.allLoadedStocks || [];
    const filtered = stocks.filter(s => {
        const price = parseFloat(s.price) || 0;
        const aboveMin = isNaN(minVal) ? true : price >= minVal;
        const belowMax = isNaN(maxVal) ? true : price <= maxVal;
        return aboveMin && belowMax;
    });

    renderStockCards(filtered);

    if (resultText) {
        const minStr = !isNaN(minVal) ? `₹${minVal}` : '₹0';
        const maxStr = !isNaN(maxVal) ? `₹${maxVal}` : '∞';
        resultText.style.display = 'block';
        resultText.innerHTML = `<i class="fa-solid fa-filter" style="margin-right:4px;"></i> Showing <b style="color:var(--accent-start);">${filtered.length}</b> stock${filtered.length !== 1 ? 's' : ''} in range ${minStr} – ${maxStr}`;
    }
}

function clearStockFilter() {
    document.getElementById('filter-min-price').value = '';
    document.getElementById('filter-max-price').value = '';
    const resultText = document.getElementById('filter-result-text');
    if (resultText) resultText.style.display = 'none';
    renderStockCards(window.allLoadedStocks || []);
}
window.applyStockFilter = applyStockFilter;
window.clearStockFilter = clearStockFilter;

closeQrBtn.addEventListener('click', () => {
    qrModal.classList.add('hidden');
});


qrModal.addEventListener('click', (e) => {
    if (e.target === qrModal) {
        qrModal.classList.add('hidden');
    }
});

// Handle Payment Submission with Image Proof
btnConfirmPayment.addEventListener('click', () => {
    const utr = utrInput.value.trim();
    const fileInput = document.getElementById('proof-image-input');
    const file = fileInput && fileInput.files[0];

    // Get UI elements explicitly to avoid variable hoisting issues
    const stockNameElement = document.getElementById('qr-stock-name') || qrStockName;
    const amountElement = document.getElementById('qr-amount') || qrAmountDisplay;

    if (!utr) {
        showModal('Error', '⚠️ Please enter UTR number', 'error');
        return;
    }
    if (!file) {
        showModal('Error', '⚠️ Please upload payment screenshot', 'error');
        return;
    }

    if (!auth.currentUser) {
        showModal('Error', 'Please login first', 'error');
        return;
    }

    // Disable button and show processing state
    btnConfirmPayment.disabled = true;
    btnConfirmPayment.innerText = 'Compressing Proof...';

    // Compress and Convert Image
    const reader = new FileReader();
    reader.onload = function (e) {
        const img = new Image();
        img.src = e.target.result;
        img.onload = function () {
            // Resize logic (max 800px width)
            const MAX_WIDTH = 800;
            const scaleSize = Math.min(1, MAX_WIDTH / img.width);
            const canvas = document.createElement('canvas');
            canvas.width = img.width * scaleSize;
            canvas.height = img.height * scaleSize;

            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Get compressed Base64
            const proofImageBase64 = canvas.toDataURL("image/jpeg", 0.7);

            submitTransaction(utr, proofImageBase64);
        };
        img.onerror = function () {
            showModal('Error', 'Failed to process image', 'error');
            btnConfirmPayment.disabled = false;
            btnConfirmPayment.innerText = 'Submit UTR';
        };
    };
    reader.onerror = function () {
        showModal('Error', 'Failed to read file', 'error');
        btnConfirmPayment.disabled = false;
        btnConfirmPayment.innerText = 'Submit UTR';
    };
    reader.readAsDataURL(file);

    function submitTransaction(utr, proofImage) {
        btnConfirmPayment.innerText = 'Initiating Secure Transaction...';

        const stockName = stockNameElement.innerText;
        // Handle price parsing carefully (remove currency symbol)
        const stockPrice = parseFloat(amountElement.innerText.replace(/[^\d.]/g, ''));

        // Update modal UI
        stockNameElement.innerText = '⏳ Verifying Investment...';
        stockNameElement.style.color = '#6366f1';

        // Create IDs
        const transactionId = 'TXN' + Date.now();
        const userId = auth.currentUser.uid;
        const userEmail = auth.currentUser.email;
        const now = Date.now();
        const isoDate = new Date().toISOString();

        // Transaction Data
        const transactionData = {
            id: transactionId,
            userId: userId,
            email: userEmail,
            type: 'Investment',
            stockName: stockName,
            amount: stockPrice,
            utr: utr,
            proofImage: proofImage, // Store Base64
            status: 'Pending',
            timestamp: now,
            createdAt: isoDate
        };

        // Deposit Request Data (Admin View)
        const depositRequest = {
            id: transactionId,
            userId: userId,
            email: userEmail,
            amount: stockPrice,
            method: 'UPI',
            details: `UTR: ${utr} | ${stockName}`,
            proofImage: proofImage, // Same image
            status: 'Pending',
            timestamp: now,
            createdAt: isoDate
        };

        // Batch Updates manually via promise chain
        set(ref(database, 'transactions/' + transactionId), transactionData)
            .then(() => {
                return set(ref(database, 'deposits/' + transactionId), depositRequest);
            })
            .then(() => {
                // Mark stock as claimed for this user (so they cannot buy same stock again)
                const claimedStockId = qrModal.dataset.currentStockId;
                if (claimedStockId && auth.currentUser) {
                    set(ref(database, 'users/' + auth.currentUser.uid + '/claimed_stocks/' + claimedStockId), {
                        stockName: stockName,
                        claimedAt: isoDate
                    });
                }
            })
            .then(() => {
                // Success!
                // NOTE: We do NOT need to manually update the DOM here because the onValue listeners
                // in loadTransactionHistory will pick up the new transaction automatically!

                showModal('Investment Submitted!', `✅ Your investment request has been submitted successfully!\n\nTransaction ID: ${transactionId}\nUTR: ${utr}\n\nYour purchase will be verified shortly.`, 'success');

                // Close and Reset
                qrModal.classList.add('hidden');
                utrInput.value = '';
                fileInput.value = ''; // Reset file input

                btnConfirmPayment.disabled = false;
                btnConfirmPayment.innerText = 'Submit UTR';

                // Reset stock name display
                stockNameElement.innerText = stockName;
                stockNameElement.style.color = '';
            })
            .catch((error) => {
                console.error('Transaction Error:', error);
                showModal('Transaction Failed', '❌ Failed to save transaction. Please check your connection.', 'error');
                btnConfirmPayment.disabled = false;
                btnConfirmPayment.innerText = 'Submit UTR';
                stockNameElement.innerText = stockName; // Revert
                stockNameElement.style.color = '';
            });
    }
});



// 7. Manage Multiple UPI IDs
const btnAddUpi = document.getElementById('btn-add-upi');
const newUpiInput = document.getElementById('new-upi-input');
const upiListContainer = document.getElementById('upi-list');

// Array to store UPI IDs
let upiIds = [];

// Load UPI IDs from localStorage
function loadUpiIds() {
    const saved = localStorage.getItem('userUpiIds');
    if (saved) {
        try {
            upiIds = JSON.parse(saved);
        } catch (e) {
            upiIds = [];
        }
    }
    renderUpiList();
}

// Save UPI IDs to localStorage
function saveUpiIds() {
    localStorage.setItem('userUpiIds', JSON.stringify(upiIds));
}

// Render UPI list
function renderUpiList() {
    if (upiIds.length === 0) {
        upiListContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 10px;">No UPI IDs added yet.</p>';
        return;
    }

    upiListContainer.innerHTML = upiIds.map((upi, index) => `
            <div class="transaction-item glass-card" style="padding: 12px; border-radius: 8px; margin-bottom: 8px;">
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: var(--text-primary);">${upi}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">UPI ID ${index + 1}</div>
                </div>
                <button class="btn-remove-upi" data-index="${index}" style="background: none; border: 1px solid var(--failed); color: var(--failed); padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; transition: all 0.2s;">
                    <i class="fa-solid fa-trash"></i> Remove
                </button>
            </div>
        `).join('');

    // Add event listeners to remove buttons
    document.querySelectorAll('.btn-remove-upi').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.getAttribute('data-index'));
            removeUpiId(index);
        });
    });
}

// Add new UPI ID
if (btnAddUpi && newUpiInput) {
    btnAddUpi.addEventListener('click', () => {
        const upiId = newUpiInput.value.trim();

        if (!upiId) {
            showModal('Input Required', '⚠️ Please enter a UPI ID', 'error');
            return;
        }

        // Basic UPI ID validation (should contain @ symbol)
        if (!upiId.includes('@')) {
            showModal('Invalid Format', '⚠️ Please enter a valid UPI ID (e.g., yourname@paytm)', 'error');
            return;
        }

        // Check if UPI ID already exists
        if (upiIds.includes(upiId)) {
            showModal('Duplicate', '⚠️ This UPI ID is already added', 'error');
            return;
        }

        // Add UPI ID to array
        upiIds.push(upiId);
        saveUpiIds();
        renderUpiList();

        // Clear input
        newUpiInput.value = '';

        // Show success message
        showModal('Success', `✅ UPI ID Added Successfully!\n\nUPI ID: ${upiId}`, 'success');

        // Visual feedback on button
        btnAddUpi.innerHTML = '<i class="fa-solid fa-check"></i> Added!';
        btnAddUpi.style.background = 'var(--success)';

        setTimeout(() => {
            btnAddUpi.innerHTML = '<i class="fa-solid fa-plus"></i> Add UPI ID';
            btnAddUpi.style.background = '';
        }, 1500);
    });
}

// Remove UPI ID
// Remove UPI ID
function removeUpiId(index) {
    // Direct removal
    upiIds.splice(index, 1);
    saveUpiIds();
    renderUpiList();
    // Optional: showModal('Removed', 'UPI ID removed.');
}

// Initialize on page load
loadUpiIds();

// --- Auto Withdrawal Toggle ---
let autoWithdrawalEnabled = false;

function loadAutoWithdrawalPref() {
    try {
        autoWithdrawalEnabled = localStorage.getItem('autoWithdrawalEnabled') === 'true';
    } catch (e) { autoWithdrawalEnabled = false; }
}

function saveAutoWithdrawalPref() {
    localStorage.setItem('autoWithdrawalEnabled', autoWithdrawalEnabled ? 'true' : 'false');
}

function updateAutoWithdrawUI() {
    const toggle = document.getElementById('auto-withdraw-toggle');
    const statusText = document.getElementById('auto-withdraw-status-text');
    const slider = document.getElementById('auto-withdraw-slider');
    if (!toggle || !statusText || !slider) return;
    toggle.checked = autoWithdrawalEnabled;
    statusText.textContent = autoWithdrawalEnabled ? 'Enabled' : 'Disabled';
    statusText.style.color = autoWithdrawalEnabled ? 'var(--success)' : 'var(--text-muted)';
    slider.style.background = autoWithdrawalEnabled ? 'var(--success)' : '#555';
}

// Initialize auto-withdrawal toggle
(function initAutoWithdraw() {
    loadAutoWithdrawalPref();
    // Delay to ensure DOM is ready
    setTimeout(function () {
        updateAutoWithdrawUI();
        const toggle = document.getElementById('auto-withdraw-toggle');
        if (toggle) {
            toggle.addEventListener('change', function () {
                autoWithdrawalEnabled = this.checked;
                saveAutoWithdrawalPref();
                updateAutoWithdrawUI();
                if (autoWithdrawalEnabled) {
                    const upiCount = (function() {
                        try { return JSON.parse(localStorage.getItem('userUpiIds') || '[]').length; } catch(e) { return 0; }
                    })();
                    if (upiCount === 0) {
                        showModal('No UPI ID', 'Please add at least one UPI ID before enabling auto withdrawal.', 'error');
                        autoWithdrawalEnabled = false;
                        saveAutoWithdrawalPref();
                        updateAutoWithdrawUI();
                    }
                }
            });
        }
    }, 500);
})();

// 8. Teams Section Implementation - TAB SWITCHING
const teamTabs = document.querySelectorAll('.team-tab');
if (teamTabs.length > 0) {
    teamTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const level = tab.getAttribute('data-level');
            
            // Switch Active UI
            teamTabs.forEach(t => {
                t.classList.remove('active');
                t.style.background = 'transparent';
                t.style.color = 'var(--text-muted)';
            });
            tab.classList.add('active');
            tab.style.background = 'var(--accent-gradient)';
            tab.style.color = 'white';
            
            // Re-render list for this level
            if (window.renderReferralList) {
                window.renderReferralList(level);
            }
        });
    });
}

// Share Referral Link
const shareButtons = document.querySelectorAll('.btn-primary');
shareButtons.forEach(btn => {
    if (btn.textContent.includes('Share Link')) {
        btn.addEventListener('click', () => {
            const actualLinkCode = document.getElementById('primary-link-code');
            const referralLink = actualLinkCode ? 'https://' + actualLinkCode.textContent : 'https://maxpay.app/';
            const shareText = `Join Max Pay and start investing smartly! 🚀\n\nUse my referral link: ${referralLink}\n\nGet ₹1,000 welcome bonus on signup!`;

            // Check if Web Share API is available
            if (navigator.share) {
                navigator.share({
                    title: 'Join Max Pay',
                    text: shareText,
                    url: referralLink
                }).then(() => {
                    console.log('Shared successfully');
                }).catch((error) => {
                    console.log('Error sharing:', error);
                });
            } else {
                // Fallback - copy to clipboard
                navigator.clipboard.writeText(shareText).then(() => {
                    showModal('Copied', '✅ Referral message copied!', 'success');
                }).catch(() => {
                    showModal('Share Link', 'Link: ' + referralLink);
                });
            }
        });
    }
});


// Claim Referral Task Bonus Logic
let referralTaskListenerUnsubscribe = null;

function checkReferralTasks(myReferralCode) {
    if (!myReferralCode || myReferralCode === '---') return;
    if (referralTaskListenerUnsubscribe) return;
    referralTaskListenerUnsubscribe = true;

    const usersRef = ref(database, 'users');

    // To get all 3 levels, we'll fetch all users once (if the app is small enough)
    // or we'll do nested queries. For performance, we'll listen to the entire users branch
    // but only process what we need.
    onValue(usersRef, (snapshot) => {
        if (!snapshot.exists()) return;

        const allUsers = snapshot.val();
        const l1Users = [];
        const l2Users = [];
        const l3Users = [];

        // 1. Get Level 1
        Object.entries(allUsers).forEach(([uid, data]) => {
            if (data.referred_by === myReferralCode) {
                l1Users.push({ uid, code: data.referral_id, ...data });
            }
        });

        // 2. Get Level 2
        const l1Codes = l1Users.map(u => u.code);
        if (l1Codes.length > 0) {
            Object.entries(allUsers).forEach(([uid, data]) => {
                if (l1Codes.includes(data.referred_by)) {
                    l2Users.push({ uid, code: data.referral_id, ...data });
                }
            });
        }

        // 3. Get Level 3
        const l2Codes = l2Users.map(u => u.code);
        if (l2Codes.length > 0) {
            Object.entries(allUsers).forEach(([uid, data]) => {
                if (l2Codes.includes(data.referred_by)) {
                    l3Users.push({ uid, code: data.referral_id, ...data });
                }
            });
        }

        // Update UI Counts
        const l1CountEl = document.getElementById('team-l1-count');
        const l2CountEl = document.getElementById('team-l2-count');
        const l3CountEl = document.getElementById('team-l3-count');
        const totalSizeEl = document.getElementById('team-total-members');

        if (l1CountEl) l1CountEl.innerText = l1Users.length;
        if (l2CountEl) l2CountEl.innerText = l2Users.length;
        if (l3CountEl) l3CountEl.innerText = l3Users.length;
        if (totalSizeEl) totalSizeEl.innerText = (l1Users.length + l2Users.length + l3Users.length);

        // Referral Task - Qualified members (only L1 typically counts for the direct 200 reward)
        let qualifiedCount = l1Users.filter(u => (parseInt(u.investment_count) || 0) >= 10).length;
        const totalReferralsUI = document.getElementById('team-total-referrals');
        if (totalReferralsUI) totalReferralsUI.innerText = l1Users.length;

        const qualifiedText = document.getElementById('qualified-referrals-count');
        if (qualifiedText) qualifiedText.innerText = `${qualifiedCount} Users`;

        // Update Claimable Reward (Direct L1 Qualifiers)
        if (auth.currentUser) {
            const myData = allUsers[auth.currentUser.uid];
            if (myData) {
                const claimedAmount = parseFloat(myData.referral_task_claimed_amount) || 0;
                const totalEarnable = qualifiedCount * 200;
                const claimable = Math.max(0, totalEarnable - claimedAmount);

                const claimableDisplay = document.getElementById('claimable-referral-bonus');
                const btnClaim = document.getElementById('btn-claim-ref-bonus');

                if (claimableDisplay) claimableDisplay.innerText = `₹${claimable.toFixed(2)}`;

                if (btnClaim) {
                    if (claimable >= 200) {
                        btnClaim.disabled = false;
                        btnClaim.innerText = 'Claim Reward';
                        btnClaim.style.opacity = '1';
                        btnClaim.onclick = () => claimReferralReward(claimable);
                    } else {
                        btnClaim.disabled = true;
                        btnClaim.innerText = 'No Reward Yet';
                        btnClaim.style.opacity = '0.5';
                    }
                }
            }
        }

        // Update Cumulative Commission Stats from Transactions
        const txnRef = ref(database, 'transactions');
        const txnQuery = query(txnRef, orderByChild('userId'), equalTo(auth.currentUser.uid));
        onValue(txnQuery, (txnSnapshot) => {
            let totalComm = 0;
            let todayComm = 0;
            let weekComm = 0;
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const startOfWeek = startOfToday - (7 * 24 * 60 * 60 * 1000);

            if (txnSnapshot.exists()) {
                txnSnapshot.forEach((childSnap) => {
                    const txn = childSnap.val();
                    if (txn.type === 'Commission' && txn.status === 'Approved') {
                        const amt = parseFloat(txn.amount) || 0;
                        totalComm += amt;
                        const txTime = parseInt(txn.timestamp) || 0;
                        if (txTime >= startOfToday) todayComm += amt;
                        if (txTime >= startOfWeek) weekComm += amt;
                    }
                });
            }

            const elTotal = document.getElementById('team-total-commission');
            const elToday = document.getElementById('team-today-commission');
            const elWeek = document.getElementById('team-week-commission');

            if (elTotal) elTotal.innerText = `₹${totalComm.toFixed(2)}`;
            if (elToday) elToday.innerText = `₹${todayComm.toFixed(2)}`;
            if (elWeek) elWeek.innerText = `₹${weekComm.toFixed(2)}`;
        });
    });
}

function claimReferralReward(amount) {
    if (!auth.currentUser || amount <= 0) return;

    const uid = auth.currentUser.uid;
    // We need to re-select the button because it might have been cloned/replaced
    const btn = document.getElementById('btn-claim-ref-bonus');

    if (btn) {
        btn.disabled = true;
        btn.innerText = 'Claiming...';
    }

    const userRef = ref(database, 'users/' + uid);

    runTransaction(userRef, (user) => {
        if (user) {
            user.balance = (parseFloat(user.balance) || 0) + amount;
            user.referral_task_claimed_amount = (parseFloat(user.referral_task_claimed_amount) || 0) + amount;
        }
        return user;
    }).then(() => {
        showModal('🎉 Success!', `Congratulations! ₹${amount} has been added to your wallet.`);
        // Listner loops will auto-update UI
    }).catch((err) => {
        console.error(err);
        showModal('Error', 'Failed to claim reward. Please try again.', 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerText = 'Claim Reward';
        }
    });
}


// 9. Profile Section Implementation
// Edit Profile Modal Logic
const editProfileModal = document.getElementById('edit-profile-modal');
const btnEditProfile = document.getElementById('btn-edit-profile');
const closeEditProfile = document.getElementById('close-edit-profile');
const editProfileNameInput = document.getElementById('edit-profile-name');
const editProfilePicInput = document.getElementById('edit-profile-pic-input');
const editProfilePreview = document.getElementById('edit-profile-preview');
const editProfileIcon = document.getElementById('edit-profile-icon');
const btnSaveProfile = document.getElementById('btn-save-profile');

let newProfilePicBase64 = null;

if (btnEditProfile) {
    btnEditProfile.addEventListener('click', () => {
        if (!auth.currentUser) return;

        // Pre-fill data
        const currentName = document.querySelector('.profile-header h2').innerText;
        editProfileNameInput.value = currentName === "Max Pay User" ? "" : currentName;

        // Reset image preview state
        newProfilePicBase64 = null;
        editProfilePicInput.value = ''; // clear input

        // Check if user has current profile pic to show in preview
        const profileImgDisplay = document.getElementById('profile-img-display');
        const hasCurrentImg = profileImgDisplay && !profileImgDisplay.classList.contains('hidden');

        if (hasCurrentImg) {
            editProfilePreview.src = profileImgDisplay.src;
            editProfilePreview.classList.remove('hidden');
            editProfileIcon.classList.add('hidden');
        } else {
            editProfilePreview.classList.add('hidden');
            editProfileIcon.classList.remove('hidden');
        }

        editProfileModal.classList.remove('hidden');
    });
}

if (closeEditProfile) {
    closeEditProfile.addEventListener('click', () => editProfileModal.classList.add('hidden'));
}
// click outside to close
if (editProfileModal) {
    editProfileModal.addEventListener('click', (e) => {
        if (e.target === editProfileModal) editProfileModal.classList.add('hidden');
    });
}

// Handle File Input Change
if (editProfilePicInput) {
    editProfilePicInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // processing...
        const reader = new FileReader();
        reader.onload = function (e) {
            // Compress/Resize logic
            const img = new Image();
            img.src = e.target.result;
            img.onload = function () {
                const MAX_WIDTH = 300; // Small size for avatar
                const scaleSize = Math.min(1, MAX_WIDTH / img.width);
                const canvas = document.createElement('canvas');
                canvas.width = img.width * scaleSize;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                newProfilePicBase64 = canvas.toDataURL("image/jpeg", 0.7);

                // Show preview
                editProfilePreview.src = newProfilePicBase64;
                editProfilePreview.classList.remove('hidden');
                editProfileIcon.classList.add('hidden');
            }
        };
        reader.readAsDataURL(file);
    });
}

// Handle Save
if (btnSaveProfile) {
    btnSaveProfile.addEventListener('click', () => {
        const newName = editProfileNameInput.value.trim();
        if (!newName) {
            showModal('Error', 'Please enter your name', 'error');
            return;
        }

        if (!auth.currentUser) return;

        btnSaveProfile.disabled = true;
        btnSaveProfile.innerText = "Saving...";

        const updates = {};
        updates[`users/${auth.currentUser.uid}/name`] = newName;
        if (newProfilePicBase64) {
            updates[`users/${auth.currentUser.uid}/profile_pic`] = newProfilePicBase64;
        }

        update(ref(database), updates).then(() => {
            showModal('Success', '✅ Profile Updated Successfully!', 'success');
            editProfileModal.classList.add('hidden');
            btnSaveProfile.disabled = false;
            btnSaveProfile.innerText = "Save Changes";
            // UI will auto-update via onValue listener in fetchUserData
        }).catch(err => {
            console.error(err);
            showModal('Error', 'Failed to update profile.', 'error');
            btnSaveProfile.disabled = false;
            btnSaveProfile.innerText = "Save Changes";
        });
    });
}

// Contact Support Button
const contactSupportBtn = document.querySelector('.btn-primary');
if (contactSupportBtn && contactSupportBtn.innerHTML.includes('headset')) {
    contactSupportBtn.addEventListener('click', () => {
        alert('📞 Contact Support\n\nEmail: support@walletpro.com\nPhone: +91 1800-123-4567\n\nOur support team is available 24/7 to assist you!');
    });
}



// Transaction History Logic for Profile
let currentListenerUid = null; // Track current listener UID
let cachedUserTxnsForProfit = [];
let profitResetTimerInterval = null;
let profitResetMidnightTimeout = null;

/** Local calendar day bounds — Today's Profit resets at 12:00 AM */
function getStartOfLocalDay(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0).getTime();
}

function getStartOfNextLocalDay(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0).getTime();
}

function parseTxnTime(txn) {
    if (txn.timestamp != null) {
        const t = Number(txn.timestamp);
        if (!Number.isNaN(t) && t > 0) return t;
    }
    if (txn.createdAt) {
        const t = new Date(txn.createdAt).getTime();
        if (!Number.isNaN(t)) return t;
    }
    return 0;
}

function isTxnToday(txn) {
    const txTime = parseTxnTime(txn);
    return txTime >= getStartOfLocalDay() && txTime < getStartOfNextLocalDay();
}

function calculateTodayProfit(userTxns) {
    let todayProfit = 0;
    userTxns.forEach((txn) => {
        const isCredit = txn.type === 'Spin Win' || txn.type === 'Bonus' || txn.type === 'Commission' || (txn.type === 'Investment' && txn.amount > 0);
        const isSuccessful = !txn.status || ['Approved', 'Completed', 'Success'].includes(txn.status);
        if (isCredit && isTxnToday(txn) && isSuccessful) {
            todayProfit += parseFloat(txn.amount || 0);
        }
    });
    return todayProfit;
}

function formatProfitResetCountdown(msUntilMidnight) {
    const totalSec = Math.max(0, Math.floor(msUntilMidnight / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `Resets at 12 AM: ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function scheduleProfitMidnightRefresh() {
    if (profitResetMidnightTimeout) clearTimeout(profitResetMidnightTimeout);
    const msUntilMidnight = getStartOfNextLocalDay() - Date.now();
    profitResetMidnightTimeout = setTimeout(() => {
        updateTodayProfitUI(cachedUserTxnsForProfit);
        scheduleProfitMidnightRefresh();
    }, Math.max(msUntilMidnight, 0) + 100);
}

function startProfitResetTimer() {
    const timerEl = document.getElementById('profit-reset-timer');
    if (!timerEl) return;

    if (profitResetTimerInterval) clearInterval(profitResetTimerInterval);

    const tick = () => {
        timerEl.textContent = formatProfitResetCountdown(getStartOfNextLocalDay() - Date.now());
    };
    tick();
    profitResetTimerInterval = setInterval(tick, 1000);
    scheduleProfitMidnightRefresh();
}

function updateTodayProfitUI(userTxns) {
    cachedUserTxnsForProfit = userTxns || [];
    const todayProfitEl = document.getElementById('today-profit');
    if (todayProfitEl) {
        const todayProfit = calculateTodayProfit(cachedUserTxnsForProfit);
        todayProfitEl.textContent = `₹${todayProfit.toFixed(2)}`;
    }
    startProfitResetTimer();
}

function loadTransactionHistory(userId) {
    console.log('[TXN] loadTransactionHistory called for userId:', userId);

    // Static container now exists in HTML
    const txnContainer = document.getElementById('user-transaction-history');
    if (!txnContainer) {
        console.error('[TXN] Transaction container not found!');
        return;
    }

    if (currentListenerUid === userId) {
        console.log('[TXN] Listener already attached for this user, skipping.');
        return;
    }
    currentListenerUid = userId;

    // Set up real-time listener for transactions
    console.log('[TXN] Setting up transaction listener');

    // Fetch Transactions
    const txnsRef = ref(database, 'transactions');
    onValue(txnsRef, (snapshot) => {
        const data = snapshot.val();
        console.log('[TXN] Received transaction data:', data);
        txnContainer.innerHTML = ''; // Clear loading/existing

        if (!data) {
            console.log('[TXN] No transaction data found');
            txnContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 10px;">No transactions found.</p>';
            updateTodayProfitUI([]);
            return;
        }

        // Filter for current user and convert to array
        const userTxns = Object.values(data)
            .filter(txn => txn.userId === userId || (auth.currentUser && txn.email === auth.currentUser.email))
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)); // Newest first

        console.log('[TXN] Filtered transactions for user:', userTxns.length, 'transactions');
        console.log('[TXN] User transactions:', userTxns);

        const txnHomeList = document.getElementById('transaction-list');

        if (userTxns.length === 0) {
            console.log('[TXN] No transactions found for this user');
            if (txnContainer) txnContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 10px;">No transactions found.</p>';

            if (txnHomeList) {
                txnHomeList.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); padding: 20px;">
                    <i class="fa-regular fa-clock" style="font-size: 1.5rem; margin-bottom: 10px; opacity: 0.5;"></i>
                    <p>No recent transactions</p>
                </div>`;
            }
            updateTodayProfitUI([]);
            return;
        }

        // 1. Populate Profile List (Full History)
        if (txnContainer) {
            userTxns.forEach(txn => {
                txnContainer.appendChild(createTxnElement(txn));
            });
        }

        // 2. Populate Home List (Recent 5)
        if (txnHomeList) {
            txnHomeList.innerHTML = '';
            userTxns.slice(0, 5).forEach(txn => {
                txnHomeList.appendChild(createTxnElement(txn));
            });
        }

        // 3. Today's Profit (resets at local midnight / 12:00 AM)
        updateTodayProfitUI(userTxns);

        // 4. Calculate Total Invested & Total Withdrawal
        const totalInvEl = document.getElementById('total-invested-small');
        const totalWdEl = document.getElementById('total-withdrawals-small');
        
        let totalInvested = 0;
        let totalWithdrawn = 0;
        
        userTxns.forEach(txn => {
            const isSuccessful = !txn.status || ['Approved', 'Completed', 'Success'].includes(txn.status);
            
            if (txn.type === 'Investment' && isSuccessful) {
                // If amount is negative (debit) we take absolute for "Total Invested"
                totalInvested += Math.abs(parseFloat(txn.amount || 0));
            }
            
            if (txn.type === 'Withdrawal' && isSuccessful) {
                totalWithdrawn += Math.abs(parseFloat(txn.amount || 0));
            }
        });
        
        if (totalInvEl) totalInvEl.textContent = `₹${totalInvested.toFixed(2)}`;
        if (totalWdEl) totalWdEl.textContent = `₹${totalWithdrawn.toFixed(2)}`;
    });

    // 3. Populate Withdrawal History (Tools Section)
    const withdrawalListEl = document.getElementById('withdrawal-history-list');
    if (withdrawalListEl) {
        onValue(ref(database, 'withdrawals'), (snapshot) => {
            const data = snapshot.val();
            withdrawalListEl.innerHTML = '';
            
            if (!data) {
                withdrawalListEl.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); padding: 20px;">
                    <i class="fa-regular fa-clock" style="font-size: 1.5rem; margin-bottom: 10px; opacity: 0.5;"></i>
                    <p>No withdrawals yet</p>
                </div>`;
                return;
            }

            const userWithdrawals = Object.values(data)
                .filter(w => w.userId === userId || (auth.currentUser && w.email === auth.currentUser.email))
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            if (userWithdrawals.length === 0) {
                withdrawalListEl.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); padding: 20px;">
                    <i class="fa-regular fa-clock" style="font-size: 1.5rem; margin-bottom: 10px; opacity: 0.5;"></i>
                    <p>No withdrawals yet</p>
                </div>`;
                return;
            }

            userWithdrawals.forEach(w => {
                let statusColor = w.status === 'Approved' ? 'var(--success)' :
                                  w.status === 'Rejected' ? 'var(--danger-color)' : 'var(--accent-start)';
                
                const item = document.createElement('div');
                item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid #333; background: rgba(255,255,255,0.02); margin-bottom: 5px; border-radius: 8px;';
                item.innerHTML = `
                    <div style="flex:1;">
                        <h4 style="margin:0; color:white; font-size: 1rem;">Auto Withdrawal</h4>
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top:4px;">${new Date(w.timestamp).toLocaleDateString()}</div>
                        <div style="font-size: 0.75rem; color: #aaa; margin-top:2px;">${(w.details || '').substring(0,25)}...</div>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 1.1rem; font-weight: bold; color: ${statusColor};">₹${parseFloat(w.amount || 0).toFixed(2)}</span>
                        <div style="font-size: 0.75rem; background: rgba(0,0,0,0.5); padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 4px; border: 1px solid ${statusColor}; color: ${statusColor};">${w.status}</div>
                    </div>
                `;
                withdrawalListEl.appendChild(item);
            });
        });
    }
}

// Legacy logout and profile logic removed in favor of Supabase implementation.


// Global function for copy button
window.copyUserId = function () {
    const userId = document.getElementById('user-unique-id').textContent;
    navigator.clipboard.writeText(userId).then(() => {
        showModal('Copied', '✅ User ID copied!', 'success');
    }).catch(() => {
        showModal('User ID', userId);
    });
};

// Helper function to create transaction item HTML
function createTxnElement(txn) {
    const date = new Date(txn.timestamp || txn.createdAt || Date.now()).toLocaleDateString();

    // Status Logic
    let statusColor = 'var(--text-muted)';
    if (txn.status === 'Pending') statusColor = 'var(--pending)';
    else if (txn.status === 'Approved' || txn.status === 'Completed' || txn.status === 'Success') statusColor = 'var(--success)';
    else if (txn.status === 'Failed' || txn.status === 'Rejected') statusColor = 'var(--failed)';

    // Amount Color Logic
    const isCredit = txn.type === 'Spin Win' || txn.type === 'Bonus' || txn.type === 'Commission';
    const amountColor = isCredit ? 'var(--success)' : (txn.amount > 0 ? 'var(--text-main)' : 'var(--failed)');

    // Icon Logic
    let icon = 'fa-file-invoice-dollar';
    if (txn.type === 'Investment') icon = 'fa-arrow-trend-up';
    if (txn.type === 'Spin Win') icon = 'fa-gift';
    if (txn.type === 'Withdrawal') icon = 'fa-money-bill-transfer';
    if (txn.type === 'Deposit') icon = 'fa-wallet';
    if (txn.type === 'Commission') icon = 'fa-hand-holding-dollar';

    const item = document.createElement('div');
    item.className = 'transaction-item';
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.justifyContent = 'space-between';
    item.style.padding = '12px';
    item.style.marginBottom = '8px';
    item.style.background = 'rgba(255,255,255,0.03)';
    item.style.borderRadius = '8px';

    item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <div style="background: rgba(255, 255, 255, 0.05); width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <i class="fa-solid ${icon}" style="color: var(--accent-start);"></i>
            </div>
            <div>
                <div style="font-weight: 600; font-size: 0.9rem;">${txn.type}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${txn.stockName || txn.details || txn.description || date}</div>
                <div style="font-size: 0.7rem; color: ${statusColor}; font-weight: 500;">
                    ${txn.status || 'Completed'}
                </div>
            </div>
        </div>
        <div style="text-align: right;">
            <div style="font-weight: bold; color: ${amountColor};">₹${parseFloat(txn.amount || 0).toFixed(2)}</div>
            <div style="font-size: 0.7rem; color: var(--text-muted);">${date}</div>
        </div>
    `;
    return item;
}
// End of Module

// 🌟 VIP System Logic
function setupVIPLogic(userData) {
    if (!userData) return;

    const vipBadge = document.getElementById('vip-badge-trigger');
    const vipLevelText = document.getElementById('vip-level-text');
    const vipModal = document.getElementById('vip-modal');
    const closeVipBtn = document.getElementById('close-vip');

    // VIP Thresholds
    const vipLevels = [
        { level: 0, min: 0, label: 'VIP 0', color: '#a0a0a0' },
        { level: 1, min: 5000, label: 'VIP 1', color: '#ffffff' },
        { level: 2, min: 25000, label: 'VIP 2', color: '#6366f1' },
        { level: 3, min: 100000, label: 'VIP 3', color: '#8b5cf6' }
    ];

    // Calculate Level based on investment count/volume
    // Here we use balance as a proxy for "Total Investment" if investment_total isn't tracked separately
    // Ideally, we should track 'total_invested_amount' in DB. For now, let's use 'balance' + a heuristic or assume userData has field.
    // Let's assume userData.total_invested exists, if not default to 0. 
    // We can also check investment_count.

    // BETTER APPROACH: Calculate total investment from transaction history if strictly needed, 
    // but for UI responsiveness, let's use a field 'total_invested' which we should update on investment.
    // If it doesn't exist, we fallback to 0.
    const totalInvested = parseFloat(userData.total_invested || userData.balance || 0);

    let currentVIP = vipLevels[0];
    let nextVIP = vipLevels[1];

    for (let i = 0; i < vipLevels.length; i++) {
        if (totalInvested >= vipLevels[i].min) {
            currentVIP = vipLevels[i];
            nextVIP = vipLevels[i + 1] || null;
        }
    }

    // Auto-credit VIP 1 Reward
    if (currentVIP.level >= 1 && !userData.vip1_reward_claimed && auth.currentUser) {
        const uid = auth.currentUser.uid;
        const userRef = ref(database, 'users/' + uid);
        runTransaction(userRef, (user) => {
            if (user && !user.vip1_reward_claimed) {
                user.balance = (parseFloat(user.balance) || 0) + 200;
                user.vip1_reward_claimed = true;
            }
            return user;
        }).then((result) => {
            if (result.committed) {
                showModal('VIP Level Up!', '🎉 Congratulations on reaching VIP 1! A reward of ₹200 has been credited to your wallet.', 'success');
                const txnId = 'VIP1_' + Date.now();
                set(ref(database, 'transactions/' + txnId), {
                    id: txnId,
                    userId: uid,
                    email: auth.currentUser.email,
                    type: 'Bonus',
                    amount: 200,
                    status: 'Completed',
                    timestamp: Date.now(),
                    description: 'VIP 1 Level Up Reward',
                    createdAt: new Date().toISOString()
                });
            }
        }).catch(err => console.error(err));
    }

    // Auto-credit VIP 2 Reward
    if (currentVIP.level >= 2 && !userData.vip2_reward_claimed && auth.currentUser) {
        const uid = auth.currentUser.uid;
        const userRef = ref(database, 'users/' + uid);
        runTransaction(userRef, (user) => {
            if (user && !user.vip2_reward_claimed) {
                user.balance = (parseFloat(user.balance) || 0) + 2500;
                user.vip2_reward_claimed = true;
            }
            return user;
        }).then((result) => {
            if (result.committed) {
                showModal('VIP Level Up!', '🎉 Congratulations on reaching VIP 2! A reward of ₹2,500 has been credited to your wallet.', 'success');
                const txnId = 'VIP2_' + Date.now();
                set(ref(database, 'transactions/' + txnId), {
                    id: txnId,
                    userId: uid,
                    email: auth.currentUser.email,
                    type: 'Bonus',
                    amount: 2500,
                    status: 'Completed',
                    timestamp: Date.now(),
                    description: 'VIP 2 Level Up Reward',
                    createdAt: new Date().toISOString()
                });
            }
        }).catch(err => console.error(err));
    }

    // Auto-credit VIP 3 Reward
    if (currentVIP.level >= 3 && !userData.vip3_reward_claimed && auth.currentUser) {
        const uid = auth.currentUser.uid;
        const userRef = ref(database, 'users/' + uid);
        runTransaction(userRef, (user) => {
            if (user && !user.vip3_reward_claimed) {
                user.balance = (parseFloat(user.balance) || 0) + 10000;
                user.vip3_reward_claimed = true;
            }
            return user;
        }).then((result) => {
            if (result.committed) {
                showModal('VIP Level Up!', '🎉 Congratulations on reaching VIP 3! A reward of ₹10,000 has been credited to your wallet.', 'success');
                const txnId = 'VIP3_' + Date.now();
                set(ref(database, 'transactions/' + txnId), {
                    id: txnId,
                    userId: uid,
                    email: auth.currentUser.email,
                    type: 'Bonus',
                    amount: 10000,
                    status: 'Completed',
                    timestamp: Date.now(),
                    description: 'VIP 3 Level Up Reward',
                    createdAt: new Date().toISOString()
                });
            }
        }).catch(err => console.error(err));
    }

    // Update Badge UI
    if (vipLevelText) {
        vipLevelText.textContent = currentVIP.label;
        vipLevelText.style.color = currentVIP.color;
        // Icon color
        const icon = vipBadge.querySelector('i');
        if (icon) icon.style.color = currentVIP.color;
    }

    // Modal Logic
    if (vipBadge) {
        // Remove old listeners to prevent duplicates
        const newBadge = vipBadge.cloneNode(true);
        vipBadge.parentNode.replaceChild(newBadge, vipBadge);

        newBadge.addEventListener('click', () => {
            if (vipModal) {
                vipModal.classList.remove('hidden');
                updateVIPModalUI(totalInvested, currentVIP, nextVIP);
            }
        });
    }

    if (closeVipBtn) {
        closeVipBtn.addEventListener('click', () => vipModal.classList.add('hidden'));
    }

    if (vipModal) {
        vipModal.addEventListener('click', (e) => {
            if (e.target === vipModal) vipModal.classList.add('hidden');
        });
    }

    // Update VIP Page Elements (if they exist)
    updateVIPPage(totalInvested, currentVIP, nextVIP);
}

function updateVIPModalUI(currentAmount, currentVIP, nextVIP) {
    const investText = document.getElementById('vip-modal-investment');
    const progressBar = document.getElementById('vip-progress-bar-fill');
    const nextTargetText = document.getElementById('vip-next-target');

    if (investText) investText.textContent = `₹${currentAmount.toLocaleString()}`;

    // Highlight active card
    document.querySelectorAll('.vip-tier-card').forEach(card => card.classList.remove('active'));

    // Simple ID mapping
    // ID: vip-card-0 (VIP 1), vip-card-1 (VIP 2), vip-card-2 (VIP 3)
    // Current VIP Level 0 -> No card active or maybe implicit
    // Level 1 -> vip-card-0 active
    if (currentVIP.level > 0) {
        const activeCard = document.getElementById(`vip-card-${currentVIP.level - 1}`);
        if (activeCard) activeCard.classList.add('active');
    }

    // Progress Bar
    if (nextVIP) {
        // Range: currentVIP.min to nextVIP.min
        const range = nextVIP.min - currentVIP.min;
        const progress = currentAmount - currentVIP.min;
        const percent = Math.min(100, Math.max(0, (progress / range) * 100));

        if (progressBar) progressBar.style.width = `${percent}%`;
        if (nextTargetText) nextTargetText.textContent = `₹${nextVIP.min.toLocaleString()}`;
    } else {
        // Max Level
        if (progressBar) progressBar.style.width = '100%';
        if (nextTargetText) nextTargetText.textContent = 'Max Level Reached';
    }
}

// Update the full VIP Page
function updateVIPPage(currentAmount, currentVIP, nextVIP) {
    const pageInvest = document.getElementById('vip-page-investment');
    const pageProgress = document.getElementById('vip-page-progress-bar-fill');
    const pageNextTarget = document.getElementById('vip-page-next-target');
    const pageLevelText = document.getElementById('vip-page-level-text');
    const pagePercent = document.getElementById('vip-page-percent');

    if (pageInvest) pageInvest.textContent = `₹${currentAmount.toLocaleString()}`;
    if (pageLevelText) {
        pageLevelText.textContent = currentVIP.label;
        pageLevelText.style.color = currentVIP.color;
        // update icon color in badge
        const badge = pageLevelText.closest('.vip-badge');
        if (badge) {
            const icon = badge.querySelector('i');
            if (icon) icon.style.color = currentVIP.color;
        }
    }

    // Reset card styles
    const allPageCards = document.querySelectorAll('#vip-page-tiers-container .vip-tier-card');
    allPageCards.forEach(card => {
        card.classList.remove('active');
        const badge = card.querySelector('.status-badge');
        if (badge) {
            badge.textContent = 'Locked';
            badge.style.color = 'var(--text-muted)';
            badge.style.background = 'rgba(255,255,255,0.05)';
        }
    });

    // Mark current level as Active/Current
    const currentCard = document.getElementById(`vip-page-card-${currentVIP.level}`);
    if (currentCard) {
        currentCard.classList.add('active');
        const badge = currentCard.querySelector('.status-badge');
        if (badge) {
            badge.textContent = 'Current';
            badge.style.color = 'var(--success)';
            badge.style.background = 'rgba(99, 102, 241, 0.12)';
        }
    }

    // Mark previous levels as Unlocked
    for (let i = 0; i < currentVIP.level; i++) {
        const prevCard = document.getElementById(`vip-page-card-${i}`);
        if (prevCard) {
            const badge = prevCard.querySelector('.status-badge');
            if (badge) {
                badge.textContent = 'Unlocked';
                badge.style.color = 'var(--text-muted)';
                badge.style.background = 'rgba(255,255,255,0.1)';
            }
        }
    }

    // Progress Bar Logic
    if (nextVIP) {
        const range = nextVIP.min - currentVIP.min;
        const progress = currentAmount - currentVIP.min;
        const percent = Math.min(100, Math.max(0, (progress / range) * 100));

        if (pageProgress) pageProgress.style.width = `${percent}%`;
        if (pageNextTarget) pageNextTarget.textContent = `₹${nextVIP.min.toLocaleString()}`;
        if (pagePercent) pagePercent.textContent = `${Math.floor(percent)}%`;
    } else {
        if (pageProgress) pageProgress.style.width = '100%';
        if (pageNextTarget) pageNextTarget.textContent = 'Max Level';
        if (pagePercent) pagePercent.textContent = '100%';
    }
}




// ============================================================
// 🔔 NOTIFICATION SYSTEM
// ============================================================

let notifPanelOpen = false;

function toggleNotifPanel(event) {
    if (event) event.stopPropagation();
    const panel = document.getElementById('notif-panel');
    const supportPanel = document.getElementById('support-panel');
    if (!panel) return;
    
    // Close support if open
    if (supportPanel) supportPanel.classList.add('hidden');
    supportPanelOpen = false;

    notifPanelOpen = !notifPanelOpen;
    if (notifPanelOpen) {
        panel.classList.remove('hidden');
        panel.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Lock background
    } else {
        panel.classList.add('hidden');
        document.body.style.overflow = ''; // Unlock background
    }
}
window.toggleNotifPanel = toggleNotifPanel;

// Close panels when clicking outside
document.addEventListener('click', (e) => {
    const nPanel = document.getElementById('notif-panel');
    const nBell = document.getElementById('notif-bell-btn');
    const sPanel = document.getElementById('support-panel');
    const sBtn = document.getElementById('support-btn');

    if (nPanel && nBell && !nPanel.contains(e.target) && !nBell.contains(e.target)) {
        nPanel.classList.add('hidden');
        notifPanelOpen = false;
    }
});

function renderNotifications(notifications) {
    const list = document.getElementById('notif-list');
    const empty = document.getElementById('notif-empty');
    const badge = document.getElementById('notif-badge');
    if (!list) return;

    // Remove old items (keep the empty placeholder)
    Array.from(list.children).forEach(c => { if (c.id !== 'notif-empty') c.remove(); });

    if (!notifications || notifications.length === 0) {
        if (empty) empty.style.display = 'block';
        if (badge) badge.style.display = 'none';
        return;
    }

    if (empty) empty.style.display = 'none';

    let unreadCount = 0;

    // Sort newest first
    const sorted = [...notifications].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    sorted.forEach(notif => {
        if (!notif.read) unreadCount++;

        const iconMap = {
            success: { icon: 'fa-circle-check', color: 'var(--success)' },
            error:   { icon: 'fa-circle-xmark', color: 'var(--danger)' },
            info:    { icon: 'fa-circle-info',  color: 'var(--accent-purple)' },
            warning: { icon: 'fa-triangle-exclamation', color: 'var(--warning)' },
        };
        const style = iconMap[notif.type] || iconMap.info;

        const timeAgo = notif.timestamp ? getTimeAgo(notif.timestamp) : '';

        const item = document.createElement('div');
        item.style.cssText = `display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-bottom:1px solid rgba(99, 102, 241, 0.06);background:${notif.read ? 'transparent' : 'var(--accent-purple-light)'};cursor:pointer;transition:background 0.2s;`;
        item.innerHTML = `
            <div style="width:32px;height:32px;border-radius:50%;background:rgba(99, 102, 241, 0.05);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;">
                <i class="fa-solid ${style.icon}" style="color:${style.color};font-size:0.9rem;"></i>
            </div>
            <div style="flex:1;min-width:0;">
                <div style="color:var(--text-primary);font-size:0.82rem;font-weight:${notif.read ? '400' : '600'};line-height:1.4;">${notif.message || 'New notification'}</div>
                <div style="color:var(--text-muted);font-size:0.72rem;margin-top:3px;">${timeAgo}</div>
            </div>
            ${!notif.read ? '<div style="width:7px;height:7px;border-radius:50%;background:var(--accent-purple);flex-shrink:0;margin-top:6px;"></div>' : ''}
        `;
        list.appendChild(item);
    });

    // Update badge
    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

function markAllNotifsRead() {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    get(ref(database, 'notifications/' + uid)).then(snap => {
        if (!snap.exists()) return;
        const updates = {};
        snap.forEach(child => {
            updates[`notifications/${uid}/${child.key}/read`] = true;
        });
        update(ref(database), updates);
    });
}
window.markAllNotifsRead = markAllNotifsRead;


// ============================================================
// 🎧 CUSTOMER SUPPORT SYSTEM
// ============================================================

let supportPanelOpen = false;

function hideChatbot() {
    const panel = document.getElementById('support-panel');
    const btn = document.getElementById('support-btn');
    if (panel) { panel.classList.add('hidden'); panel.style.display = ''; }
    if (btn) btn.classList.add('hidden');
    supportPanelOpen = false;
    document.body.style.overflow = '';
}
window.hideChatbot = hideChatbot;

function showChatbot() {
    const btn = document.getElementById('support-btn');
    if (btn) btn.classList.remove('hidden');
}

function toggleSupportPanel(event) {
    if (event) event.stopPropagation();
    if (!currentUser) return;
    const panel = document.getElementById('support-panel');
    const notifPanel = document.getElementById('notif-panel');
    if (!panel) return;
    
    // Close notifications if open
    if (notifPanel) notifPanel.classList.add('hidden');
    notifPanelOpen = false;

    supportPanelOpen = !supportPanelOpen;
    if (supportPanelOpen) {
        panel.classList.remove('hidden');
        panel.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Lock background
        // Mark as read when opening
        update(ref(database, `support_chats/${currentUser.uid}`), { unreadByUser: false });
        // Scroll to bottom
        setTimeout(() => {
            const chatMessages = document.getElementById('support-chat-messages');
            if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 100);
    } else {
        panel.classList.add('hidden');
        document.body.style.overflow = ''; // Unlock background
    }
}
window.toggleSupportPanel = toggleSupportPanel;

// Event listeners for support
const supportBtn = document.getElementById('support-btn');
const supportBtnHome = document.getElementById('support-btn-home');

if (supportBtn) {
    supportBtn.addEventListener('click', toggleSupportPanel);
}
if (supportBtnHome) {
    supportBtnHome.addEventListener('click', toggleSupportPanel);
}

const closeSupportBtn = document.getElementById('close-support-panel');
if (closeSupportBtn) {
    closeSupportBtn.addEventListener('click', () => {
        document.getElementById('support-panel').classList.add('hidden');
        document.body.style.overflow = ''; // Unlock background
        supportPanelOpen = false;
    });
}

const sendSupportBtn = document.getElementById('send-support-msg');
const supportInput = document.getElementById('support-input');
const supportFileBtn = document.getElementById('attach-support-file');
const supportFileInput = document.getElementById('support-file-input');

if (supportFileBtn && supportFileInput) {
    supportFileBtn.addEventListener('click', () => supportFileInput.click());
    supportFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) sendMessage('', file);
    });
}

if (sendSupportBtn && supportInput) {
    const handleSend = () => {
        const msg = supportInput.value.trim();
        if (msg) sendMessage(msg);
    };
    sendSupportBtn.addEventListener('click', handleSend);
    supportInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSend();
    });
}

function sendMessage(msg, file = null) {
    if (!currentUser) return;
    const chatId = currentUser.uid;
    const msgId = 'MSG' + Date.now();
    
    const sendData = (finalMsg, imageUrl = null) => {
        const messageData = {
            id: msgId,
            text: finalMsg,
            sender: 'user',
            timestamp: Date.now(),
            image: imageUrl
        };

        set(ref(database, `support_chats/${chatId}/messages/${msgId}`), messageData)
            .then(() => {
                supportInput.value = '';
                // Fetch user name for admin display
                get(child(ref(database), 'users/' + currentUser.uid + '/name')).then(nameSnap => {
                    const userName = nameSnap.exists() ? nameSnap.val() : '';
                    update(ref(database, `support_chats/${chatId}`), {
                        lastMessage: imageUrl ? '🖼️ [Image]' : finalMsg,
                        lastTimestamp: Date.now(),
                        unreadByAdmin: true,
                        userEmail: currentUser.email,
                        userId: currentUser.uid,
                        userName: userName
                    });
                }).catch(() => {
                    update(ref(database, `support_chats/${chatId}`), {
                        lastMessage: imageUrl ? '🖼️ [Image]' : finalMsg,
                        lastTimestamp: Date.now(),
                        unreadByAdmin: true,
                        userEmail: currentUser.email,
                        userId: currentUser.uid
                    });
                });

                // 🤖 Trigger AI Auto-reply
                if (!imageUrl && finalMsg) {
                    triggerAISupport(finalMsg, chatId);
                }
            });
    };

    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            // Compress image if needed
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600;
                const scale = Math.min(1, MAX_WIDTH / img.width);
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                sendData(msg, dataUrl);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    } else {
        sendData(msg);
    }
}

// ═══════════════════════════════════════════════════════════
// 🤖 SMART AI SUPPORT — MAX PAY FINANCIAL ASSISTANT
// ═══════════════════════════════════════════════════════════

let chatContext = { lastIntent: '', lastResponse: '', msgCount: 0, fetchRetryCount: 0, userDataCache: null };

function detectIntent(msg) {
    const i = (word) => msg.includes(word);
    const hi = (word) => msg.includes(word);

    if (i('balance') || i('wallet') || i('money') || i('rupees') || i('paise') || hi('paisa') || hi('baki') || hi('kitna') || i('account') && (i('balance') || i('money') || i('amount'))) return 'balance';
    if (i('referral') || i('refer') || i('invite') || i('team') || i('commission') || i('referral id') || hi('refer') || hi('reffer') || hi('refar')) return 'referral';
    if (i('invest') || i('deposit') || i('buy') || i('stock') || i('plan') || i('trade') || hi('invest') || hi('nivesh') || hi('khareed') || hi('lage') || hi('lagaye')) return 'invest';
    if (i('withdraw') || i('payout') || i('withdrawal') || i('nikal') || i('nikalna') || hi('nikasi') || hi('paisa nikal') || hi('withdraw')) return 'withdrawal';
    if (i('vip') || i('level') || i('upgrade') || i('crown') || hi('vip')) return 'vip';
    if (i('profile') || i('my account') || i('account details') || i('name') || i('email') || i('phone') || i('mobile') || hi('profile')) return 'profile';
    if (i('earning') || i('income') || i('profit') || i('earn') || i('kamai') || hi('kama') || hi('earning')) return 'earnings';
    if (i('transaction') || i('history') || i('activity') || i('ledger') || i('recent')) return 'transactions';
    if (i('kyc') || i('verify') || i('verification') || hi('kyc')) return 'kyc';
    if (i('reward') || i('bonus') || i('gift') || i('free') || i('welcome') || hi('inam') || hi('bonus') || hi('reward')) return 'rewards';
    if (i('task') || i('daily') || i('complete') && i('task') || hi('task') || hi('kaam')) return 'tasks';
    if (i('support') || i('help') || i('problem') || i('issue') || i('complaint') || i('shikayat') || hi('madad') || hi('problem')) return 'support';
    if (i('security') || i('safe') || i('secure') || i('protect') || i('encrypt') || hi('suraksha')) return 'security';
    if (i('promotion') || i('offer') || i('discount') || i('coupon') || i('scheme') || hi('offer')) return 'promotions';
    if (i('hello') || i('hi') || i('hey') || i('good morning') || i('good evening') || i('namaste') || hi('namaste') || hi('hello')) return 'greeting';
    if (i('thanks') || i('thank you') || i('thanku') || i('dhanyavad') || i('shukriya') || hi('thanks')) return 'thanks';
    if (i('help') || i('what can you') || i('guide') || hi('kya kar sakte') || hi('guide')) return 'help';
    return 'unknown';
}

function isHindiMsg(msg) {
    return /(kya|hai|kaise|kahan|kyu|ho|aap|tum|mein|mera|tere|sakte|sakta|kar|sakta|paise|paisa|nikal|madad|nahi|chahiye|baat|karo|karte|raha|rahi|hoon|hai|hain|kaam|aapka|aapki|mere|mujhe|karein|karna|lagta|lagti|diya|liya|kuch|aur|wala|wali|wale)/i.test(msg);
}

function triggerAISupport(userMsg, chatId) {
    const msg = userMsg.toLowerCase().trim();
    const typingIndicator = document.getElementById('support-typing-indicator');
    const uid = currentUser ? currentUser.uid : (auth.currentUser ? auth.currentUser.uid : null);
    const hi = isHindiMsg(msg);

    if (!uid) {
        sendAIResponse(hi
            ? "Sir, aapko support chat use karne ke liye pehle login karna hoga."
            : "Please log in first to use the support chat.", typingIndicator, chatId);
        return;
    }

    chatContext.msgCount++;

    const snapToVal = (s) => s.exists() ? s.val() : null;
    const toArray = (v) => v ? Object.values(v) : [];

    const userPromise = get(ref(database, 'users/' + uid)).then(s => snapToVal(s)).catch(() => null);
    const txnPromise = get(query(ref(database, 'transactions'), orderByChild('userId'), equalTo(uid))).then(s => toArray(s.val())).catch(() => []);
    const depPromise = get(query(ref(database, 'deposits'), orderByChild('userId'), equalTo(uid))).then(s => toArray(s.val())).catch(() => []);
    const withdrawalPromise = get(query(ref(database, 'withdrawals'), orderByChild('userId'), equalTo(uid))).then(s => toArray(s.val())).catch(() => []);

    Promise.all([userPromise, txnPromise, depPromise, withdrawalPromise]).then(([userData, allTxns, allDeps, allWds]) => {
        chatContext.fetchRetryCount = 0;
        if (userData) chatContext.userDataCache = userData;

        const name = userData ? userData.name || currentUser.email || 'User' : currentUser.email || 'User';
        const balance = userData ? parseFloat(userData.balance || 0) : 0;
        const refId = userData ? userData.referral_id : '---';
        const refBy = userData ? userData.referred_by : '---';
        const invCount = userData ? parseInt(userData.investment_count) || 0 : 0;
        const totalInv = userData ? parseFloat(userData.total_invested || 0) : 0;
        const phoneVerified = userData ? userData.phone_verified : false;
        const totalComm = userData ? parseFloat(userData.total_team_commission || 0) : 0;
        const nrc = userData ? userData.newbie_reward_claimed : false;
        const mobileNumber = userData ? userData.mobile_number : null;
        const profileName = userData ? userData.name || 'Not set' : 'Not set';

        const pendingDeps = allDeps.filter(d => d.status === 'Pending');
        const approvedDeps = allDeps.filter(d => d.status === 'Approved');
        const rejectedDeps = allDeps.filter(d => d.status === 'Rejected');
        const totalDeposited = approvedDeps.reduce((s, d) => s + parseFloat(d.amount || 0), 0);

        const pendingWds = allWds.filter(w => w.status === 'Pending');
        const approvedWds = allWds.filter(w => w.status === 'Approved');
        const totalWithdrawn = approvedWds.reduce((s, w) => s + parseFloat(w.amount || 0), 0);

        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const todayTxns = allTxns.filter(t => (t.timestamp || 0) >= todayStart.getTime());
        const todayEarnings = todayTxns.filter(t => t.type === 'Commission' || t.type === 'Bonus' || t.type === 'Spin Win')
            .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
        const totalEarnings = allTxns.filter(t => t.type === 'Commission' || t.type === 'Bonus' || t.type === 'Spin Win')
            .reduce((s, t) => s + parseFloat(t.amount || 0), 0);

        const vipLevels = [
            { level: 0, min: 0, label: 'VIP 0', reward: 0 },
            { level: 1, min: 5000, label: 'VIP 1', reward: 200 },
            { level: 2, min: 25000, label: 'VIP 2', reward: 2500 },
            { level: 3, min: 100000, label: 'VIP 3', reward: 10000 }
        ];
        let currentVIP = vipLevels[0];
        let nextVIP = null;
        for (let i = 0; i < vipLevels.length; i++) {
            if (totalInv >= vipLevels[i].min) { currentVIP = vipLevels[i]; nextVIP = vipLevels[i + 1] || null; }
        }

        const isAngry = /(gussa|pagal|google|complain|case|cheating|fraud|scam|thief|dhokha|chutiya|bewakoof|lawyer|report|bhag|jana|jail|police|warning|suck|worst|stupid|loser)/i.test(msg);
        const isUrgent = /(urgent|jaldi|fast|immediately|turant|abhii|abhi|jldi)/i.test(msg);
        const isConfused = /(confuse|confused|samajh|nhi aaya|samajh nahi|explain|kaise kaam|nhi pata|kya matlab|kya hai ye|thoda aur|detail|please explain|i don't understand|how does|guide me)/i.test(msg);
        const isExcited = /(wow|awesome|amazing|fantastic|incredible|super|excellent|bhaut acha|maza aa|great|love it|fantastic|mind blowing|best ever)/i.test(msg);

        let teamCount = 0;
        let teamPromise = get(query(ref(database, 'users'), orderByChild('referred_by'), equalTo(refId)));
        teamPromise.then(teamSnap => {
            teamCount = teamSnap.exists() ? Object.keys(teamSnap.val()).length : 0;
        }).catch(() => {
            teamCount = 0;
        }).finally(() => {
            const intent = detectIntent(msg);
            chatContext.lastIntent = intent;
            let aiResponse = '';

            if (intent === 'greeting') {
                const period = (() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; })();
                if (hi) {
                    aiResponse = `Namaste ${name} ji 🙏 Main Maya hoon, MAX PAY ki aapki personal assistant. Aapke account ka sara data mere paas hai.\n\nAap kya janna chahenge?\n\n💰 Balance & Wallet\n📈 Investment & Plans\n👥 Referral & Team\n💳 Withdrawal status\n👑 VIP level & rewards\n🔐 KYC status`;
                } else {
                    aiResponse = `Hello ${name} 👋 ${period}! I'm Maya, your MAX PAY assistant. I have your complete account details with me.\n\nWhat would you like to know?\n\n💰 Balance & Wallet\n📈 Investments & Plans\n👥 Referrals & Team\n💳 Withdrawals\n👑 VIP & Rewards\n🔐 KYC status`;
                }

            } else if (intent === 'balance') {
                const bns = totalEarnings > 0 ? `🏆 **Total Earnings**: ₹${totalEarnings.toFixed(2)}` : '';
                const smartTip = totalInv >= 5000 ? `\n\n🔥 ${name}, aap already VIP me active hain. Aur invest karke aur zyada rewards paayein!` : totalInv > 0 ? `\n\n💡 ${name}, VIP upgrade ke liye ₹${(5000 - totalInv) > 0 ? (5000 - totalInv).toLocaleString() : '0'} aur invest karein.` : '';
                if (hi) {
                    aiResponse = `${name} ji, aapke wallet ki details yeh hain:\n\n💰 **Balance**: ₹${balance.toFixed(2)}\n📈 **Invested**: ₹${totalInv.toLocaleString()}\n📥 **Deposited**: ₹${totalDeposited.toLocaleString()}\n📤 **Withdrawn**: ₹${totalWithdrawn.toLocaleString()}\n💵 **Today's Earning**: ₹${todayEarnings.toFixed(2)}\n👑 **${currentVIP.label}**\n👥 **Team**: ${teamCount}${bns ? '\n' + bns : ''}\n\n${pendingDeps.length > 0 ? `📌 ${pendingDeps.length} deposit${pendingDeps.length > 1 ? '' : ''} pending approval hai.` : ''}${smartTip}`;
                } else {
                    const pct = nextVIP ? Math.min(100, ((totalInv - currentVIP.min) / (nextVIP.min - currentVIP.min)) * 100).toFixed(0) : 100;
                    const vipProg = nextVIP ? `${pct}% to ${nextVIP.label}` : 'Max level';
                    aiResponse = `${name}, here's your wallet overview:\n\n💰 **Balance**: ₹${balance.toFixed(2)}\n📈 **Invested**: ₹${totalInv.toLocaleString()}\n📥 **Deposited**: ₹${totalDeposited.toLocaleString()}\n📤 **Withdrawn**: ₹${totalWithdrawn.toLocaleString()}\n💵 **Today's Earning**: ₹${todayEarnings.toFixed(2)}\n👑 **${currentVIP.label}** (${vipProg})\n👥 **Team**: ${teamCount}${bns ? '\n' + bns : ''}\n\n${pendingDeps.length > 0 ? `📌 ${pendingDeps.length} deposit${pendingDeps.length > 1 ? 's' : ''} pending approval.` : ''}${smartTip}`;
                }

            } else if (intent === 'referral') {
                const teamNote = teamCount >= 3 ? `\n\n🔥 ${name}, aapki team achi performance kar rahi hai!` : '';
                if (hi) {
                    aiResponse = `${name} ji, aapki referral details yeh hain:\n\n🔑 **Aapka Referral ID**: ${refId}\n👥 **Team Members**: ${teamCount}\n💰 **Total Commission**: ₹${totalComm.toFixed(2)}\n\n**Commission Structure:**\n• Level 1 (direct): 15%\n• Level 2 (unke referrals): 5%\n• Level 3: 2%\n\n📤 Apna ID ${refId} share karein aur unlimited kamaayein!${teamNote}`;
                } else {
                    aiResponse = `${name}, here's your referral dashboard:\n\n🔑 **Referral ID**: ${refId}\n👥 **Team Size**: ${teamCount}\n💰 **Total Commission**: ₹${totalComm.toFixed(2)}\n\n**Commission Structure:**\n• Level 1 (direct): 15%\n• Level 2: 5%\n• Level 3: 2%\n\n📤 Share your ID ${refId} and start earning commissions!${teamNote}`;
                }

            } else if (intent === 'invest') {
                const planTip = totalInv >= 25000 ? `\n\n🔥 ${name}, aap VIP 2+ me hain. ₹1,00,000 tak invest karke VIP 3 aur ₹10,000 reward paayein!` : totalInv >= 5000 ? `\n\n🔥 ${name}, aap VIP 1+ me hain. ₹25,000 tak invest karke VIP 2 aur ₹2,500 reward paayein!` : '';
                if (hi) {
                    aiResponse = `${name} ji, investment guide:\n\n📊 **Aapka Portfolio:**\n• Total Invested: ₹${totalInv.toLocaleString()}\n• Investments: ${invCount}\n• Available Balance: ₹${balance.toFixed(2)}\n\n**Kaise karein:**\n1️⃣ Invest section mein jayen\n2️⃣ Plan select karein\n3️⃣ QR scan karke payment karein\n4️⃣ UTR aur screenshot submit karein\n5️⃣ 2-3 minute mein approval ✅\n\n💡 Jitna zyada investment, utna zyada VIP rewards!${planTip}`;
                } else {
                    aiResponse = `${name}, here's how to invest:\n\n📊 **Your Portfolio:**\n• Total Invested: ₹${totalInv.toLocaleString()}\n• Investments Made: ${invCount}\n• Available Balance: ₹${balance.toFixed(2)}\n\n**Steps:**\n1️⃣ Go to Invest section\n2️⃣ Pick a plan\n3️⃣ Scan QR & pay\n4️⃣ Submit UTR + screenshot\n5️⃣ Approval in 2-3 min ✅\n\n💡 Higher investment unlocks better VIP rewards!${planTip}`;
                }

            } else if (intent === 'withdrawal') {
                if (hi) {
                    aiResponse = `${name} ji, aapke withdrawal details:\n\n💰 **Available Balance**: ₹${balance.toFixed(2)}\n⏳ **Pending**: ${pendingWds.length}\n📤 **Total Withdrawn**: ₹${totalWithdrawn.toLocaleString()}\n\n${balance >= 100 ? `✅ Aapka balance ₹100 se upar hai, auto-withdrawal process ho jayega.` : `ℹ️ Auto-withdrawal ke liye minimum ₹100 balance chahiye. Abhi ₹${(100 - balance).toFixed(2)} aur chahiye.`}\n\n• UPI ID pe transfer hoga\n• Max ₹500 per transaction`;
                } else {
                    aiResponse = `${name}, your withdrawal info:\n\n💰 **Balance**: ₹${balance.toFixed(2)}\n⏳ **Pending**: ${pendingWds.length}\n📤 **Total Withdrawn**: ₹${totalWithdrawn.toLocaleString()}\n\n${balance >= 100 ? `✅ Your balance is above ₹100, auto-withdrawal will process.` : `ℹ️ Minimum ₹100 required for auto-withdrawal. You need ₹${(100 - balance).toFixed(2)} more.`}\n\n• Sent to your primary UPI ID\n• Max ₹500 per transaction`;
                }

            } else if (intent === 'vip') {
                const nextT = nextVIP ? `₹${nextVIP.min.toLocaleString()}` : 'Max Level';
                const pct = nextVIP ? Math.min(100, ((totalInv - currentVIP.min) / (nextVIP.min - currentVIP.min)) * 100).toFixed(0) : 100;
                const smartVipNote = currentVIP.level >= 2 ? `\n\n🔥 ${name}, aap already ${currentVIP.label} pe hain aur achi earning kar rahe hain. Aur invest karke max level achieve karein!` : teamCount >= 5 ? `\n\n🔥 ${name}, aapki team bhi achi hai. VIP upgrade ke saath aapko aur commission benefits milenge.` : '';
                if (hi) {
                    aiResponse = `${name} ji, aapka VIP status:\n\n👑 **Current Level**: ${currentVIP.label}\n📊 **Total Invested**: ₹${totalInv.toLocaleString()}\n📈 **Progress**: ${pct}% to ${nextT}\n\n**VIP Benefits:**\n• VIP 1: ₹5,000 invest → ₹200 reward\n• VIP 2: ₹25,000 invest → ₹2,500 reward\n• VIP 3: ₹1,00,000 invest → ₹10,000 reward\n\n${nextVIP ? `🚀 Sirf ₹${(nextVIP.min - totalInv).toLocaleString()} aur invest karke ${nextVIP.label} achieve karein!` : '🏆 Aap max level pe hain! Congratulations!'}${smartVipNote}`;
                } else {
                    aiResponse = `${name}, your VIP status:\n\n👑 **Level**: ${currentVIP.label}\n📊 **Invested**: ₹${totalInv.toLocaleString()}\n📈 **Progress**: ${pct}% to ${nextT}\n\n**VIP Rewards:**\n• VIP 1: ₹5,000 → ₹200 bonus\n• VIP 2: ₹25,000 → ₹2,500 bonus\n• VIP 3: ₹1,00,000 → ₹10,000 bonus\n\n${nextVIP ? `🚀 Invest ₹${(nextVIP.min - totalInv).toLocaleString()} more to reach ${nextVIP.label}!` : '🏆 You are at max level! Congratulations!'}${smartVipNote}`;
                }

            } else if (intent === 'earnings') {
                const congrats = totalEarnings > 10000 ? `\n\n🎉 ${name}, aapki earning kaafi achi grow kar rahi hai!` : todayEarnings > 500 ? `\n\n🔥 ${name}, aapne aaj bhi achi earning ki hai!` : '';
                if (hi) {
                    aiResponse = `${name} ji, aapki earning details:\n\n💵 **Aaj ki Earning**: ₹${todayEarnings.toFixed(2)}\n🏆 **Total Earning**: ₹${totalEarnings.toFixed(2)}\n👥 **Commission**: ₹${totalComm.toFixed(2)}\n📊 **Investments**: ${invCount}${congrats}\n\nZyada invest aur refer karke earning badhayein!`;
                } else {
                    aiResponse = `${name}, your earnings at a glance:\n\n💵 **Today**: ₹${todayEarnings.toFixed(2)}\n🏆 **Total**: ₹${totalEarnings.toFixed(2)}\n👥 **Commission**: ₹${totalComm.toFixed(2)}\n📊 **Investments**: ${invCount}${congrats}\n\nKeep investing and referring to grow your earnings!`;
                }

            } else if (intent === 'transactions') {
                const recent = allTxns.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 8);
                if (recent.length === 0) {
                    aiResponse = hi
                        ? `${name} ji, abhi tak koi transaction nahi hui hai. Investment karke start karein!`
                        : `${name}, no transactions yet. Start investing to see your activity here.`;
                } else {
                    const list = recent.map((t, i) =>
                        `${i + 1}. ${t.type} — ₹${parseFloat(t.amount || 0).toFixed(2)} (${t.status || 'Completed'}) • ${new Date(t.timestamp || 0).toLocaleDateString()}`
                    ).join('\n');
                    aiResponse = hi
                        ? `${name} ji, aapke recent transactions:\n\n${list}\n\nPoori history Profile section mein dekhein.`
                        : `${name}, your recent transactions:\n\n${list}\n\nFull history is in your Profile section.`;
                }

            } else if (intent === 'kyc') {
                if (hi) {
                    aiResponse = phoneVerified
                        ? `${name} ji, aapka KYC complete hai ✅ Mobile ${mobileNumber || 'verified'}. Aap saari features use kar sakte hain.`
                        : `${name} ji, aapka KYC abhi complete nahi hai ❌\n\n**Kaise karein:**\n1️⃣ Home mein Welcome Rewards mein jayen\n2️⃣ Verify Mobile par click karein\n3️⃣ Apna 10-digit number enter karein ✅`;
                } else {
                    aiResponse = phoneVerified
                        ? `${name}, your KYC is complete ✅ Mobile ${mobileNumber || 'verified'}. All features are active.`
                        : `${name}, your KYC is pending ❌\n\n**To verify:**\n1️⃣ Go to Welcome Rewards on Home\n2️⃣ Click Verify Mobile\n3️⃣ Enter your 10-digit number ✅`;
                }

            } else if (intent === 'rewards') {
                if (hi) {
                    aiResponse = `${name} ji, aapke liye rewards:\n\n🔥 **Welcome Reward**: ${nrc ? '✅ Claimed (₹1,000)' : '⏳ 4 tasks complete karke ₹1,000 paayein!'}\n👑 **VIP Rewards**: ₹10,000 tak\n👥 **Referral Commission**: 15%\n🎡 **Lucky Spin**: ₹999 tak jeetein!\n\nWelcome rewards complete karke start karein!`;
                } else {
                    aiResponse = `${name}, here are your rewards:\n\n🔥 **Welcome Reward**: ${nrc ? '✅ Claimed (₹1,000)' : '⏳ Complete 4 tasks → ₹1,000'}\n👑 **VIP Rewards**: Up to ₹10,000\n👥 **Referral Commission**: 15%\n🎡 **Lucky Spin**: Win up to ₹999\n\nComplete Welcome Rewards to get started!`;
                }

            } else if (intent === 'tasks') {
                const done = [phoneVerified, invCount >= 1, totalInv >= 5000, teamCount >= 1];
                const doneCount = done.filter(Boolean).length;
                if (hi) {
                    aiResponse = `${name} ji, aapke Welcome Rewards ka progress:\n\n**${doneCount}/4 tasks complete** 🎯\n**Inaam**: ₹1,000\n\n1️⃣ Mobile Verify: ${done[0] ? '✅' : '❌'}\n2️⃣ ₹100 Deposit: ${done[1] ? '✅' : '❌'}\n3️⃣ ₹5,000 Invest: ${done[2] ? '✅' : '❌'}\n4️⃣ Refer a Friend: ${done[3] ? '✅' : '❌'}\n\nSaare tasks complete karke ₹1,000 paayein!`;
                } else {
                    aiResponse = `${name}, your Welcome Rewards progress:\n\n**${doneCount}/4 tasks complete** 🎯\n**Reward**: ₹1,000\n\n1️⃣ Verify Mobile: ${done[0] ? '✅' : '❌'}\n2️⃣ Deposit ₹100+: ${done[1] ? '✅' : '❌'}\n3️⃣ Invest ₹5,000+: ${done[2] ? '✅' : '❌'}\n4️⃣ Refer a Friend: ${done[3] ? '✅' : '❌'}\n\nComplete all tasks to claim ₹1,000!`;
                }

            } else if (intent === 'profile') {
                if (hi) {
                    aiResponse = `${name} ji, aapki profile details:\n\n👤 **Name**: ${profileName}\n📧 **Email**: ${currentUser.email}\n📱 **Phone**: ${mobileNumber || 'Not set'}\n🔑 **Referral ID**: ${refId}\n💰 **Balance**: ₹${balance.toFixed(2)}\n📈 **Invested**: ₹${totalInv.toLocaleString()}\n👑 **VIP**: ${currentVIP.label}\n✅ **KYC**: ${phoneVerified ? 'Complete' : 'Pending'}\n👥 **Team**: ${teamCount}\n\nEdit karne ke liye Me section mein jayen.`;
                } else {
                    aiResponse = `${name}, your profile at a glance:\n\n👤 **Name**: ${profileName}\n📧 **Email**: ${currentUser.email}\n📱 **Phone**: ${mobileNumber || 'Not set'}\n🔑 **Referral ID**: ${refId}\n💰 **Balance**: ₹${balance.toFixed(2)}\n📈 **Invested**: ₹${totalInv.toLocaleString()}\n👑 **VIP**: ${currentVIP.label}\n✅ **KYC**: ${phoneVerified ? 'Complete' : 'Pending'}\n👥 **Team**: ${teamCount}\n\nEdit from the Me section.`;
                }

            } else if (intent === 'security') {
                aiResponse = hi
                    ? `${name} ji, MAX PAY ki security ke baare mein:\n\n✅ **256-bit Encryption** — Bank jaisi security\n✅ **Secure Gateways** — Safe transactions\n✅ **Legal Operations** — Poori tarah kanooni\n✅ **Privacy First** — Aapka data safe hai\n✅ **24/7 Monitoring** — Hamesha protected\n\nAapke funds 100% safe hain.`
                    : `${name}, here's how MAX PAY keeps your account secure:\n\n✅ **256-bit Encryption** — Bank-grade security\n✅ **Secure Gateways** — All transactions protected\n✅ **Fully Legal** — Compliant operations\n✅ **Privacy First** — Your data is never shared\n✅ **24/7 Monitoring** — Always protected\n\nYour funds are 100% safe with us.`;

            } else if (intent === 'promotions') {
                if (hi) {
                    aiResponse = `${name} ji, abhi ke offers:\n\n🔥 **Welcome Reward**: ₹1,000 free\n👥 **Refer & Earn**: 15% commission\n👑 **VIP Rewards**: ₹10,000 tak\n🎡 **Lucky Spin**: Rozana prizes!\n\nJaldi karein, offers limited hain!`;
                } else {
                    aiResponse = `${name}, current offers for you:\n\n🔥 **Welcome Reward**: ₹1,000 free\n👥 **Refer & Earn**: 15% commission\n👑 **VIP Rewards**: Up to ₹10,000\n🎡 **Lucky Spin**: Win daily prizes!\n\nThese offers won't last forever!`;
                }

            } else if (intent === 'support') {
                if (hi) {
                    aiResponse = `${name} ji, main aapki kaise madad kar sakta hoon?\n\nMain yeh sab batane ke liye hoon:\n\n💰 Balance aur wallet details\n📈 Investment guide\n👥 Referral aur commissions\n💳 Withdrawal process\n👑 VIP level aur rewards\n📋 Recent transactions\n\nHuman support ke liye: Telegram @walletproofficial`;
                } else {
                    aiResponse = `${name}, I can help you with:\n\n💰 **Balance** — Wallet & earnings\n📈 **Invest** — How to invest\n👥 **Referral** — Team & commissions\n💳 **Withdraw** — Withdrawal help\n👑 **VIP** — Status & rewards\n📋 **Transactions** — Recent activity\n\nFor human support: Telegram @walletproofficial`;
                }

            } else if (intent === 'help') {
                if (hi) {
                    aiResponse = `${name} ji, main Maya hoon. Aap yeh pooch sakte hain:\n\n💰 "Mera balance kitna hai?"\n📈 "Investment kaise karein?"\n👥 "Meri team kitni hai?"\n💳 "Withdraw kaise karein?"\n👑 "Mera VIP level kya hai?"\n🔐 "KYC kaise karein?"\n🎁 "Rewards kya milenge?"\n\nKya poochna chahenge?`;
                } else {
                    aiResponse = `${name}, I'm Maya. Try asking me:\n\n💰 **"My balance"**\n📈 **"How to invest?"**\n👥 **"My referrals"**\n💳 **"Withdraw money"**\n👑 **"My VIP status"**\n🔐 **"KYC status"**\n🎁 **"Rewards"**\n\nWhat would you like to know?`;
                }

            } else if (intent === 'thanks') {
                if (hi) {
                    aiResponse = `Aapka swagat hai ${name} ji 😊\n\nKoi aur madad chahiye?\n\n💡 Welcome Rewards complete karein → ₹1,000 free\n👥 Referral ID share karein → Commission kamayein\n📈 Zyada invest karein → VIP rewards paayein`;
                } else {
                    aiResponse = `You're welcome, ${name} 😊\n\nAnything else I can help with?\n\n💡 Complete Welcome Rewards → ₹1,000 free\n👥 Share your Referral ID → Earn commissions\n📈 Invest more → VIP rewards up to ₹10,000`;
                }

            } else {
                if (hi) {
                    aiResponse = `${name} ji, main samajh gaya. Aap yeh pooch sakte hain:\n\n💰 **Balance** — Wallet kitna hai\n📈 **Invest** — Paisa kaise lagayein\n👥 **Referral** — Team aur commission\n💳 **Withdraw** — Paisa nikalna\n👑 **VIP** — Level check\n🔐 **KYC** — Verification\n\nKya poochna chahenge?`;
                } else {
                    aiResponse = `${name}, I understand you have a question. Here's what I can help with:\n\n💰 **Balance** — Check wallet\n📈 **Invest** — Investment guide\n👥 **Referral** — Team & commissions\n💳 **Withdraw** — Withdrawal help\n👑 **VIP** — Level & rewards\n🔐 **KYC** — Verification status\n\nWhat would you like to know?`;
                }
            }

            const isHappy = /(thank|thanks|awesome|great|nice|wow|super|best|love|amazing|fantastic|bahut|acha|laga|maza)/i.test(msg);
            if (isExcited && intent !== 'thanks') {
                aiResponse += `\n\n${hi
                    ? `Bahut acha ${name} 🎉 aapko MAX PAY ka experience acha lag raha hai! Kisi aur cheez mein madad chahiye?`
                    : `That's wonderful ${name} 🎉 so glad you're enjoying MAX PAY! Need help with anything else?`}`;
            } else if (isHappy && intent !== 'thanks') {
                aiResponse += `\n\n${hi
                    ? `Awesome ${name} 🎉 aapki earning aur activity kaafi achi lag rahi hai. Kisi aur cheez mein madad chahiye?`
                    : `Awesome ${name} 🎉 your earnings and activity are looking great. Need help with anything else?`}`;
            } else if (isConfused) {
                aiResponse += `\n\n${hi
                    ? `Koi baat nahi ${name} ji 😊 Main aapko step-by-step samjhaata hoon. Kripya yeh batayein ki exactly kya samajhna chahte hain?`
                    : `No worries ${name} 😊 Let me explain step by step. Just tell me what you'd like me to clarify.`}`;
            } else if (isAngry) {
                aiResponse += `\n\n${hi
                    ? `${name} ji, inconvenience ke liye sincerely sorry 🙏 Hamari support team aapke issue ko priority par check kar rahi hai. Kripya mujhe exact problem batayein.`
                    : `${name}, sincerely sorry for the inconvenience 🙏 Our support team is checking your issue on priority. Please let me know the exact problem.`}`;
            } else if (isUrgent) {
                aiResponse += `\n\n${hi
                    ? `⚡ Samajh gaya ${name} ji, yeh urgent hai. Main turant aapki help kar raha hoon.`
                    : `⚡ I understand this is urgent, ${name}. Let me help you right away.`}`;
            }

            sendAIResponse(aiResponse, typingIndicator, chatId);
        });
    }).catch((err) => {
        console.error('[AI] Data fetch failed:', err);
        chatContext.fetchRetryCount = (chatContext.fetchRetryCount || 0) + 1;
        const retry = chatContext.fetchRetryCount;
        const cached = chatContext.userDataCache;
        const cachedName = cached ? (cached.name || currentUser.email || 'User') : null;
        const n = cachedName || (currentUser ? currentUser.email || 'User' : 'User');

        if (retry <= 1) {
            sendAIResponse(hi
                ? `Hello ${n} 👋 Aapka data load hone mein thoda time lag raha hai. Kripya ek pal ruke, main secure tarike se reconnect kar raha hoon.`
                : `Hello ${n} 👋 Your data is taking a little longer than usual to load. Please wait a moment while I reconnect securely.`,
                typingIndicator, chatId);
        } else if (retry <= 2) {
            if (cached) {
                sendAIResponse(hi
                    ? `${n} ji, main aapka naya data fetch nahi kar paaya. Lekin aapka pehle ka data mere paas hai, aap phir bhi pooch sakte hain. Kya jaanna chahenge?`
                    : `${n}, I couldn't fetch fresh data this time. But I still have your previous data cached, so feel free to ask. What would you like to know?`,
                    typingIndicator, chatId);
            } else {
                sendAIResponse(hi
                    ? `Sorry ${n} 😔 Main temporarily MAX PAY servers se connect nahi kar paaya. Kripya kuch der baad try karein.`
                    : `Sorry ${n} 😔 I'm temporarily unable to connect to the MAX PAY servers. Please try again in a few moments.`,
                    typingIndicator, chatId);
            }
        } else {
            if (cached) {
                const basicName = cachedName || 'User';
                const basicBalance = parseFloat(cached.balance || 0).toFixed(2);
                sendAIResponse(hi
                    ? `Namaste ${basicName} ji 🙏 MAX PAY servers temporarily unavailable hain. Lekin aapka last known balance ₹${basicBalance} tha. Kya main kisi aur cheez mein madad kar sakta hoon?`
                    : `Hi ${basicName} 🙏 MAX PAY servers are temporarily unavailable. Your last known balance was ₹${basicBalance}. Can I help with anything else?`,
                    typingIndicator, chatId);
            } else {
                sendAIResponse(hi
                    ? `MAX PAY services currently under maintenance 🔧 Kuch features temporarily unavailable ho sakte hain. Kripya kuch der baad try karein.`
                    : `MAX PAY services are currently under maintenance 🔧 Some features may be temporarily unavailable. Please try again shortly.`,
                    typingIndicator, chatId);
            }
        }
    });
}

function sendAIResponse(response, typingIndicator, chatId) {
    if (typingIndicator) typingIndicator.classList.remove('hidden');
    const delay = 1000 + Math.random() * 1000;
    setTimeout(() => {
        if (typingIndicator) typingIndicator.classList.add('hidden');
        const aiMsgId = 'AI' + Date.now();
        const aiMessageData = {
            id: aiMsgId,
            text: response,
            sender: 'admin',
            isAI: true,
            timestamp: Date.now()
        };
        set(ref(database, `support_chats/${chatId}/messages/${aiMsgId}`), aiMessageData)
            .then(() => {
                update(ref(database, `support_chats/${chatId}`), {
                    lastMessage: response.substring(0, 100),
                    lastTimestamp: Date.now(),
                    unreadByUser: true
                });
            });
    }, delay);
}


function renderSupportMessages(messagesObj) {
    const chatContainer = document.getElementById('support-chat-messages');
    if (!chatContainer) return;

    chatContainer.innerHTML = '';
    
    if (!messagesObj) {
        chatContainer.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); padding: 20px;">
                <i class="fa-solid fa-comments" style="font-size: 1.8rem; opacity: 0.3; display: block; margin-bottom: 8px;"></i>
                How can we help you today?
            </div>`;
        return;
    }

    const entries = Object.entries(messagesObj).sort((a, b) => a[1].timestamp - b[1].timestamp);

    entries.forEach(([key, msg]) => {
        const isUser = msg.sender === 'user';
        const msgDiv = document.createElement('div');
        msgDiv.style.cssText = `
            max-width: 80%;
            padding: 10px 14px;
            border-radius: 14px;
            font-size: 0.85rem;
            line-height: 1.5;
            align-self: ${isUser ? 'flex-end' : 'flex-start'};
            background: ${isUser ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#1e1e36'};
            color: #ffffff;
            border-bottom-${isUser ? 'right' : 'left'}-radius: 4px;
            ${!isUser ? 'border: 1px solid rgba(99,102,241,0.2);' : ''}
            white-space: pre-wrap;
            word-break: break-word;
            position: relative;
            transition: opacity 0.2s;
        `;
        
        let content = '';
        if (msg.image) {
            content += `<img src="${msg.image}" style="width: 100%; border-radius: 8px; margin-bottom: 5px; cursor: pointer;" onclick="window.open('${msg.image}', '_blank')">`;
        }
        if (msg.text) {
            const formatted = msg.text.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#a78bfa;">$1</strong>');
            content += `<div>${formatted}</div>`;
        }
        
        msgDiv.innerHTML = content;
        chatContainer.appendChild(msgDiv);

        // Long press to delete user's own messages
        if (isUser && currentUser) {
            var uid = currentUser.uid;
            var msgPath = 'support_chats/' + uid + '/messages/' + key;
            var pressTimer = null;

            msgDiv.addEventListener('touchstart', function () {
                pressTimer = setTimeout(function () {
                    if (confirm('Delete this message?')) {
                        msgDiv.style.opacity = '0.3';
                        set(ref(database, msgPath), null)
                            .catch(function () { msgDiv.style.opacity = '1'; });
                    }
                }, 600);
            }, { passive: true });

            msgDiv.addEventListener('touchend', function () {
                clearTimeout(pressTimer);
            }, { passive: true });

            msgDiv.addEventListener('touchmove', function () {
                clearTimeout(pressTimer);
            }, { passive: true });

            msgDiv.addEventListener('contextmenu', function (e) {
                e.preventDefault();
                if (confirm('Delete this message?')) {
                    msgDiv.style.opacity = '0.3';
                    set(ref(database, msgPath), null)
                        .catch(function () { msgDiv.style.opacity = '1'; });
                }
            });
        }
    });

    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function getTimeAgo(timestamp) {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

// Global UI handler for notifications
window.showNotifInPanel = (list) => {
    renderNotifications(list);
};

// Listen for notifications and support for the logged-in user
let notifListener, supportMsgListener, supportUnreadListener;
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Notifications
        notifListener = onValue(ref(database, 'notifications/' + user.uid), (snap) => {
            const data = snap.val();
            const list = data ? Object.values(data) : [];
            if (window.showNotifInPanel) window.showNotifInPanel(list);
        });

        // Support messages
        supportMsgListener = onValue(ref(database, `support_chats/${user.uid}/messages`), (snap) => {
            renderSupportMessages(snap.val());
        });

        // Support unread badge
        supportUnreadListener = onValue(ref(database, `support_chats/${user.uid}/unreadByUser`), (snap) => {
            const hasUnread = snap.val();
            const badge = document.getElementById('support-badge');
            if (badge) {
                if (hasUnread) {
                    badge.style.display = 'flex';
                    badge.textContent = '1';
                } else {
                    badge.style.display = 'none';
                }
            }
        });
    } else {
        hideChatbot();
        if (notifListener) { notifListener(); notifListener = null; }
        if (supportMsgListener) { supportMsgListener(); supportMsgListener = null; }
        if (supportUnreadListener) { supportUnreadListener(); supportUnreadListener = null; }
    }
});

// 📈 Advanced Invest Section Tab Logic
const tabMarket = document.getElementById('tab-market');
const tabShortTerm = document.getElementById('tab-short-term');
const tabPortfolio = document.getElementById('tab-portfolio');
const marketView = document.getElementById('invest-market-view');
const shortTermView = document.getElementById('invest-short-term-view');
const portfolioView = document.getElementById('invest-portfolio-view');

function switchInvestTab(activeTab) {
    [tabMarket, tabShortTerm, tabPortfolio].forEach(t => { if (t) t.classList.remove('active'); });
    [marketView, shortTermView, portfolioView].forEach(v => { if (v) v.classList.add('hidden'); });
    if (activeTab) activeTab.classList.add('active');
}

if (tabMarket && tabPortfolio) {
    tabMarket.addEventListener('click', () => {
        switchInvestTab(tabMarket);
        marketView.classList.remove('hidden');
    });

    tabShortTerm.addEventListener('click', () => {
        switchInvestTab(tabShortTerm);
        shortTermView.classList.remove('hidden');
        renderShortTermPlans();
        if (currentUser) renderUserShortTermInvestments(currentUser.uid);
    });

    tabPortfolio.addEventListener('click', () => {
        switchInvestTab(tabPortfolio);
        portfolioView.classList.remove('hidden');
        if (currentUser) renderUserPortfolio(currentUser.uid);
    });
}

// ⏳ Short Term Plans
function renderShortTermPlans() {
    const container = document.getElementById('short-term-plans-container');
    if (!container) return;
    onValue(ref(database, 'short_term_plans'), (snap) => {
        const data = snap.val();
        const plans = data ? Object.keys(data).map(id => ({ id, ...data[id] })) : [];
        container.innerHTML = '';
        if (plans.length === 0) {
            container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:30px;"><i class="fa-solid fa-clock" style="font-size:1.5rem;opacity:0.3;display:block;margin-bottom:10px;"></i><p>No short term plans available right now.</p></div>';
            return;
        }
        plans.sort((a, b) => (a.minAmount || 0) - (b.minAmount || 0));
        plans.forEach(p => {
            const minA = parseFloat(p.minAmount) || 0;
            const maxA = parseFloat(p.maxAmount) || 0;
            const dailyPct = parseFloat(p.dailyReward) || 0;
            const duration = parseInt(p.duration) || 1;
            const card = document.createElement('div');
            card.style.cssText = 'background:rgba(255,255,255,0.42);backdrop-filter:blur(24px) saturate(180%);border:1px solid rgba(255,255,255,0.55);border-radius:var(--radius-lg);padding:20px 22px;box-shadow:var(--shadow-premium);';
            card.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <div style="width:44px;height:44px;border-radius:12px;background:var(--accent-purple-light);display:flex;align-items:center;justify-content:center;color:var(--accent-purple);">
                            <i class="fa-solid fa-clock" style="font-size:1.2rem;"></i>
                        </div>
                        <div>
                            <h4 style="margin:0;font-size:1rem;font-weight:800;color:var(--text-primary);">${(p.name || 'Short Term Plan').replace(/</g, '&lt;')}</h4>
                            <p style="margin:2px 0 0;font-size:0.7rem;color:var(--text-muted);">${duration} day${duration > 1 ? 's' : ''} duration</p>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;letter-spacing:0.04em;display:block;">Daily Reward</span>
                        <span style="font-size:1.3rem;font-weight:900;color:var(--accent-purple);">${dailyPct}%</span>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
                    <div style="background:var(--bg-secondary);padding:10px;border-radius:12px;text-align:center;">
                        <span style="font-size:0.6rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;display:block;">Min Invest</span>
                        <span style="font-size:1rem;font-weight:800;color:var(--text-primary);">₹${minA.toLocaleString()}</span>
                    </div>
                    <div style="background:var(--bg-secondary);padding:10px;border-radius:12px;text-align:center;">
                        <span style="font-size:0.6rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;display:block;">Max Invest</span>
                        <span style="font-size:1rem;font-weight:800;color:var(--text-primary);">₹${maxA.toLocaleString()}</span>
                    </div>
                </div>
                <div style="display:flex;gap:10px;">
                    <input type="number" id="st-invest-${p.id}" min="${minA}" max="${maxA}" step="1" placeholder="Enter amount (₹${minA} - ₹${maxA})" style="flex:1;padding:10px 14px;border:1px solid rgba(99,102,241,0.15);border-radius:12px;font-size:0.85rem;background:rgba(255,255,255,0.5);outline:none;color:var(--text-primary);">
                    <button onclick="investShortTerm('${p.id}')" style="padding:10px 22px;border-radius:12px;background:var(--accent-gradient);color:white;border:none;font-weight:800;font-size:0.85rem;cursor:pointer;white-space:nowrap;box-shadow:0 6px 16px var(--accent-glow);">Invest</button>
                </div>
                <div id="st-msg-${p.id}" style="font-size:0.75rem;margin-top:6px;display:none;"></div>
            `;
            container.appendChild(card);
        });
    }, { onlyOnce: true });
}

window.investShortTerm = function(planId) {
    if (!currentUser) { showModal('Login Required', 'Please login to invest', 'error'); return; }
    const input = document.getElementById('st-invest-' + planId);
    const msgEl = document.getElementById('st-msg-' + planId);
    const amount = parseFloat(input.value);
    if (!amount || amount <= 0) { msgEl.style.display = 'block'; msgEl.style.color = '#ef4444'; msgEl.textContent = 'Please enter a valid amount.'; return; }

    const plansRef = ref(database, 'short_term_plans/' + planId);
    get(plansRef).then((snap) => {
        if (!snap.exists()) { msgEl.style.display = 'block'; msgEl.style.color = '#ef4444'; msgEl.textContent = 'Plan not found.'; return; }
        const plan = snap.val();
        const minA = parseFloat(plan.minAmount) || 0;
        const maxA = parseFloat(plan.maxAmount) || 0;
        if (amount < minA || amount > maxA) {
            msgEl.style.display = 'block'; msgEl.style.color = '#ef4444';
            msgEl.textContent = 'Amount must be between ₹' + minA.toLocaleString() + ' and ₹' + maxA.toLocaleString() + '.';
            return;
        }
        msgEl.style.display = 'none';
        const uid = currentUser.uid;
        const invId = 'ST' + Date.now();
        const dailyPct = parseFloat(plan.dailyReward) || 0;
        const duration = parseInt(plan.duration) || 1;
        const dailyAmt = amount * dailyPct / 100;
        const totalReturn = amount + (dailyAmt * duration);
        const now = Date.now();
        const data = {
            planId, planName: plan.name || 'Short Term',
            amount, dailyRewardPct: dailyPct,
            dailyRewardAmt: dailyAmt, duration,
            totalReturn, investedAt: now,
            createdAt: new Date().toISOString(),
            lastRewardDate: '', rewardsClaimed: 0,
            status: 'active'
        };
        set(ref(database, 'short_term_investments/' + uid + '/' + invId), data).then(() => {
            showModal('Investment Successful!', '✅ You have invested ₹' + amount.toLocaleString() + ' in ' + (plan.name || 'Short Term') + '.\n\nDaily Reward: ₹' + dailyAmt.toFixed(2) + '\nDuration: ' + duration + ' day(s)\nTotal Return: ₹' + totalReturn.toFixed(2), 'success');
            input.value = '';
            renderUserShortTermInvestments(uid);
        }).catch((err) => {
            console.error(err);
            showModal('Error', 'Failed to save investment.', 'error');
        });
    }).catch((err) => {
        console.error(err);
        msgEl.style.display = 'block'; msgEl.style.color = '#ef4444';
        msgEl.textContent = 'Error loading plan.';
    });
};

function renderUserShortTermInvestments(uid) {
    const container = document.getElementById('user-short-term-list');
    if (!container) return;
    onValue(ref(database, 'short_term_investments/' + uid), (snap) => {
        const data = snap.val();
        const list = data ? Object.keys(data).map(id => ({ id, ...data[id] })) : [];
        container.innerHTML = '';
        if (list.length === 0) {
            container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;"><p>No active short term investments.</p></div>';
            return;
        }
        list.sort((a, b) => (b.investedAt || 0) - (a.investedAt || 0));
        list.forEach(inv => {
            const dailyAmt = parseFloat(inv.dailyRewardAmt) || 0;
            const claimed = parseInt(inv.rewardsClaimed) || 0;
            const dur = parseInt(inv.duration) || 1;
            const remaining = dur - claimed;
            const div = document.createElement('div');
            div.style.cssText = 'background:rgba(255,255,255,0.42);backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.55);border-radius:var(--radius-md);padding:14px 16px;box-shadow:var(--shadow-premium);';
            div.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <p style="margin:0;font-size:0.85rem;font-weight:800;color:var(--text-primary);">${(inv.planName || 'Short Term').replace(/</g, '&lt;')}</p>
                        <p style="margin:2px 0 0;font-size:0.7rem;color:var(--text-muted);">Invested: ₹${parseFloat(inv.amount).toLocaleString()} · ${dur} days</p>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:0.9rem;font-weight:900;color:var(--accent-purple);">₹${dailyAmt.toFixed(0)}/day</span>
                        <span style="display:block;font-size:0.65rem;color:var(--text-muted);">${claimed}/${dur} days</span>
                    </div>
                </div>
                <div style="margin-top:8px;height:4px;background:#e2e8f0;border-radius:4px;overflow:hidden;">
                    <div style="height:100%;width:${Math.min(100, (claimed / dur) * 100)}%;background:var(--accent-gradient);border-radius:4px;transition:width 0.5s;"></div>
                </div>
                <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-size:0.65rem;color:var(--text-muted);">${remaining > 0 ? remaining + ' reward(s) remaining' : 'Completed'}</span>
                    <span style="font-size:0.7rem;font-weight:800;color:var(--accent-green);">Total: ₹${parseFloat(inv.totalReturn).toFixed(0)}</span>
                </div>
            `;
            container.appendChild(div);
        });
    });
}

// Daily reward cron — called on page load for logged-in users
function processDailyShortTermRewards(uid) {
    get(ref(database, 'short_term_investments/' + uid)).then((snap) => {
        if (!snap.exists()) return;
        const data = snap.val();
        const now = Date.now();
        const today = new Date().toDateString();
        const updates = {};
        Object.keys(data).forEach(id => {
            const inv = data[id];
            if (inv.status !== 'active') return;
            if (inv.lastRewardDate === today) return;
            const claimed = parseInt(inv.rewardsClaimed) || 0;
            const dur = parseInt(inv.duration) || 1;
            if (claimed >= dur) {
                updates[id + '/status'] = 'completed';
                return;
            }
            const dailyAmt = parseFloat(inv.dailyRewardAmt) || 0;
            updates[id + '/rewardsClaimed'] = claimed + 1;
            updates[id + '/lastRewardDate'] = today;
        });
        if (Object.keys(updates).length > 0) {
            update(ref(database, 'short_term_investments/' + uid), updates);
            // Also credit daily reward to user balance
            let totalReward = 0;
            Object.keys(data).forEach(id => {
                const inv = data[id];
                if (inv.status !== 'active') return;
                if (inv.lastRewardDate === today) return;
                const claimed = parseInt(inv.rewardsClaimed) || 0;
                const dur = parseInt(inv.duration) || 1;
                if (claimed >= dur) return;
                totalReward += parseFloat(inv.dailyRewardAmt) || 0;
            });
            if (totalReward > 0 && uid) {
                runTransaction(ref(database, 'users/' + uid + '/balance'), (bal) => (bal || 0) + totalReward);
            }
        }
    }).catch((err) => console.error('Daily reward error:', err));
}

function renderUserPortfolio(uid) {
    const listEl = document.getElementById('portfolio-investments-list');
    const totalActiveEl = document.getElementById('portfolio-total-active');
    const totalCommEl = document.getElementById('portfolio-total-commission');
    if (!listEl) return;

    onValue(ref(database, 'transactions'), (snap) => {
        const data = snap.val();
        if (!data) return;

        const myInvestments = Object.values(data).filter(t => t.userId === uid && t.type === 'Investment');
        
        if (myInvestments.length === 0) {
            listEl.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 40px 20px;">
                                    <i class="fa-solid fa-face-meh" style="font-size: 2.2rem; opacity: 0.2; display: block; margin-bottom: 12px;"></i>
                                    <p>No active investments found.</p>
                                </div>`;
            if (totalActiveEl) totalActiveEl.innerText = '₹0.00';
            if (totalCommEl) totalCommEl.innerText = '₹0.00';
            return;
        }

        listEl.innerHTML = '';
        let totalActive = 0;
        let totalComm = 0;

        myInvestments.sort((a,b) => b.timestamp - a.timestamp).forEach(inv => {
            const amount = parseFloat(inv.amount || 0);
            totalActive += amount;
            
            // Heuristic or actual commission from stock data if archived? 
            // For now, let's assume a generic commission if not saved in transaction
            const comm = amount * 0.15; // Placeholder Logic (15%)
            totalComm += comm;

            const item = document.createElement('div');
            item.className = 'glass-card';
            item.style.cssText = 'padding: 15px; border-radius: 12px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;';
            item.innerHTML = `
                <div>
                    <h4 style="margin:0; color:var(--text-primary);">${inv.stockName || 'Active Asset'}</h4>
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top:4px;">${new Date(inv.timestamp).toLocaleDateString()} • ${inv.id}</div>
                    <div style="font-size: 0.8rem; color: #6366f1; margin-top: 6px; font-weight: 600;"><i class="fa-solid fa-hand-holding-dollar"></i> Commission: ₹${comm.toFixed(2)}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-weight: 800; color: var(--text-primary); font-size: 1.1rem;">₹${amount.toFixed(2)}</div>
                    <div style="font-size: 0.7rem; background: var(--success-bg); color: var(--success); padding: 2px 8px; border-radius: 4px; display: inline-block; margin-top: 5px; border: 1px solid rgba(16, 185, 129, 0.25);">Active</div>
                </div>
            `;
            listEl.appendChild(item);
        });

        if (totalActiveEl) totalActiveEl.innerText = `₹${totalActive.toLocaleString()}`;
        if (totalCommEl) totalCommEl.innerText = `₹${totalComm.toLocaleString()}`;
    });
}
