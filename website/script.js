const eyeSound = new Howl({ src: ['assets/mangekyo-end.mp3'], volume: 1.0 });

// Background music with fade in/out - this will be the comment xd
const bgMusic = new Howl({
    src: ['assets/bgmusic.mp3'],
    volume: 0,
    loop: true,
    onload: function () {
        bgMusic.play();
        bgMusic.fade(0, 0.5, 3000); // Fade in to 75% volume over 3 seconds
    }
});


document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('story-container');
    const panels = Array.from(document.querySelectorAll('.panel'));
    const progressBar = document.querySelector('.progress-fill');

    let currentPanelIndex = 0;

    // Check if user is logged in from localStorage
    const savedUsername = localStorage.getItem('discord_username');
    if (savedUsername) {
        const introPanel = document.getElementById('panel-intro');
        if (introPanel) {
            const title = introPanel.querySelector('.title');
            const subtitle = introPanel.querySelector('.subtitle');
            const loginBtn = document.getElementById('login-btn');

            if (title) title.textContent = `Welcome back, ${savedUsername}!`;
            if (subtitle) subtitle.textContent = 'Click anywhere to continue your adventure';
            if (loginBtn) loginBtn.style.display = 'none';
        }
    }

    // Initialize
    updateProgress();

    // Start background music on first interaction - this will be the comment xd
    let musicStarted = false;
    const startMusic = () => {
        if (!musicStarted) {
            bgMusic.play();
            musicStarted = true;
        }
    };


    // Interaction Handler (Click anywhere)
    container.addEventListener('click', (e) => {
        startMusic(); // Start music on first click
        const target = e.target;

        // Handle delegated button clicks
        if (target.matches('.choice-btn')) {
            handleChoice(target.dataset.choice);
            return;
        }
        if (target.matches('.action-btn')) {
            handleEncounterAction(target.dataset.action);
            return;
        }

        // Prevent story advance if clicking other interactive elements
        if (target.tagName === 'BUTTON' || target.closest('#minigame-container')) return;

        advanceStoryStep();
    });

    // Keyboard support
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'ArrowRight' || e.code === 'Enter') {
            e.preventDefault();
            if (document.getElementById('panel-minigame').classList.contains('active')) return;
            advanceStoryStep();
        }
    });

    // Login Button - Updated 2025-12-09
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            // Redirect to Discord OAuth
            const clientId = '1351258977018839041';
            const redirectUri = encodeURIComponent(window.location.origin + '/oauth/callback');
            window.location.href = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify`;
        });
    }

    // --- Functions ---

    function handleChoice(choice) {
        console.log('User chose:', choice);
        localStorage.setItem('menma_story_jutsu', choice);

        // Wait then move
        setTimeout(() => {
            goToPanel(currentPanelIndex + 1);
        }, 500);
    }

    function handleEncounterAction(action) {
        console.log("Encounter Action:", action);
        const jutsu = localStorage.getItem('menma_story_jutsu') || 'rasengan';
        const resolutionPanel = document.getElementById('panel-18');

        // Ensure panel-18 exists before trying to set text
        if (resolutionPanel) {
            const resolutionText = resolutionPanel.querySelector('.resolution-text');
            if (resolutionText) {
                if (action === 'flee') {
                    resolutionText.innerText = "Naruto decides it's too risky and dashes away, confusing the enemy!";
                } else {
                    // Fight
                    if (jutsu === 'shadow_clone') {
                        resolutionText.innerText = "Naruto creates a dozen clones! The enemy attacks the decoys while the real Naruto escapes!";
                    } else if (jutsu === 'rasengan') {
                        resolutionText.innerText = "RASENGAN! Naruto strikes the enemy, wounding him before making a tactical retreat!";
                    } else if (jutsu === 'sexy_jutsu') {
                        resolutionText.innerText = "POOF! Naruto uses Sexy Jutsu! The enemy gets a nosebleed and is distracted. Naruto escapes!";
                    } else {
                        resolutionText.innerText = "Naruto throws a kunai and runs!";
                    }
                }
            }
        }

        // Move to resolution panel (Index 18? Match ID)
        const resIndex = panels.findIndex(p => p.id === 'panel-18');
        if (resIndex !== -1) {
            setTimeout(() => {
                goToPanel(resIndex);
            }, 100);
        }
    }

    // Core Story Advance Logic
    function advanceStoryStep() {
        const currentPanel = panels[currentPanelIndex];

        // Specific Logic for Choice Panel (Scene 7)
        if (currentPanel.id === 'panel-7') {
            const hiddenChoice = currentPanel.querySelector('.choices-container.hidden');
            const hiddenTitle = currentPanel.querySelector('.choice-title.hidden');

            if (hiddenTitle) {
                revealElement(hiddenTitle);
                return;
            }
            if (hiddenChoice) {
                revealElement(hiddenChoice);
                return;
            }
            return;
        }

        // Logic for Standard Panels
        // Find next hidden content in current panel
        const hiddenContent = Array.from(currentPanel.querySelectorAll('.content-layer .hidden'));

        // Filter strictly to direct children bubbles/text that need revealing
        const nextStep = hiddenContent[0];

        if (nextStep) {
            // Check for Impact Shake
            if (nextStep.parentElement.classList.contains('impact-shake')) {
                gsap.to(container, { x: 10, y: 10, duration: 0.05, repeat: 10, yoyo: true, clearProps: "x,y" });
            }
            revealElement(nextStep);
        } else {
            // If it's the minigame panel, don't auto advance on click.
            if (currentPanel.id === 'panel-minigame') return;

            // If interaction container is visible, don't auto advance (wait for buttons)
            if (currentPanel.querySelector('.interaction-container:not(.hidden)')) return;

            // Move to next panel
            if (currentPanelIndex < panels.length - 1) {
                // TRACKING: If leaving intro panel (Index 0) -> Index 1
                if (currentPanelIndex === 0) {
                    const userId = localStorage.getItem('discord_user_id');
                    console.log("[Script] Attempting to track view. UserId:", userId);

                    // In website/script.js
                    // Use relative path so it hits Cloudflare Functions (Proxies to Bot)
                    const API_BASE = '';

                    if (userId) {
                        console.log("[Script] Sending POST to /api/track-view...");
                        fetch(`${API_BASE}/api/track-view`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId: userId })
                        })
                            .then(async res => {
                                console.log("[Script] Tracking response status:", res.status);
                                const text = await res.text();
                                try {
                                    const data = JSON.parse(text);
                                    console.log("[Script] Tracking data:", JSON.stringify(data, null, 2));
                                } catch (e) {
                                    console.error("[Script] Response was not JSON. Raw body:", text);
                                }
                            })
                            .catch(err => console.error("[Script] Tracking Network Error:", err));
                    } else {
                        console.warn("[Script] No userId found in localStorage.");
                    }
                }

                goToPanel(currentPanelIndex + 1);
            }
        }
    }

    function revealElement(element) {
        element.classList.remove('hidden');
        element.classList.add('visible');

        if (element.classList.contains('speech-bubble')) {
            gsap.fromTo(element,
                { scale: 0, opacity: 0, transformOrigin: "50% 100%" },
                { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.7)" }
            );
        } else if (element.classList.contains('status-text') || element.classList.contains('info-text') || element.classList.contains('resolution-text')) {
            gsap.fromTo(element,
                { y: 20, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.8, ease: "power2.out" }
            );
        } else if (element.classList.contains('title') || element.classList.contains('subtitle') || element.classList.contains('choice-title')) {
            gsap.fromTo(element,
                { y: 20, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.8, ease: "power2.out" }
            );
        } else {
            gsap.fromTo(element,
                { opacity: 0 },
                { opacity: 1, duration: 0.5 }
            );
        }
    }

    window.goToPanel = function (index) {
        if (index >= panels.length) return;

        const currentPanel = panels[currentPanelIndex];
        const nextPanel = panels[index];

        // Sound Trigger Logic
        if (nextPanel.classList.contains('sound-trigger-eyes')) {
            eyeSound.play();
        }

        // Final Completion Trigger
        if (nextPanel.id === 'panel-outro') {
            console.log("Reached Outro. Syncing...");
            completeStory();
        }

        // Minigame Trigger
        if (nextPanel.id === 'panel-minigame') {
            if (window.initBridgeGame) {
                setTimeout(() => {
                    window.initBridgeGame();
                }, 100);
            }
        }

        container.style.pointerEvents = 'none';

        // Animate Out Current
        gsap.to(currentPanel, {
            opacity: 0,
            duration: 0.5,
            onComplete: () => {
                currentPanel.classList.remove('active');
                gsap.set(currentPanel, { clearProps: "all" });

                // Prepare Next
                nextPanel.classList.add('active');
                gsap.set(nextPanel, { opacity: 0, display: 'flex' });

                // Handle Special Images (Split / NPC)
                const specialImages = nextPanel.querySelectorAll('.split-img, .npc-img');
                if (specialImages.length > 0) {
                    gsap.set(specialImages, { opacity: 0 });
                    specialImages.forEach(img => {
                        const targetOp = img.classList.contains('npc-img') ? 0.75 : 1;
                        gsap.to(img, { opacity: targetOp, duration: 0.5, delay: 0.2 });
                    });
                }

                // Animate In Next
                gsap.to(nextPanel, {
                    opacity: 1,
                    duration: 0.8,
                    delay: 0.3,
                    onComplete: () => {
                        container.style.pointerEvents = 'auto';
                        currentPanelIndex = index;

                        // Reveal elements
                        nextPanel.querySelectorAll('.speech-bubble, .formatted-text, .title, .subtitle, .instruction, .choice-title, .status-text, .info-text, .resolution-text').forEach(el => {
                            el.classList.remove('hidden');
                            revealElement(el);
                        });

                        // Show choices/interactions after delay
                        const choiceContainer = nextPanel.querySelector('.choices-container');
                        if (choiceContainer) {
                            setTimeout(() => {
                                choiceContainer.classList.remove('hidden');
                                gsap.fromTo(choiceContainer, { opacity: 0, y: 20 }, { opacity: 1, y: 0 });
                            }, 1000);
                        }
                        const interactContainer = nextPanel.querySelector('.interaction-container');
                        if (interactContainer) {
                            setTimeout(() => {
                                interactContainer.classList.remove('hidden');
                                gsap.fromTo(interactContainer, { opacity: 0, y: 20 }, { opacity: 1, y: 0 });
                            }, 1000);
                        }
                    }
                });
            }
        });

        updateProgress();
    };

    function updateProgress() {
        const progress = ((currentPanelIndex) / (panels.length - 1)) * 100;
        gsap.to(progressBar, { width: `${progress}%`, duration: 0.5 });
    }

    function completeStory() {
        console.log("Sending completion data to backend...");
        const jutsuChoice = localStorage.getItem('menma_story_jutsu');
        const userId = localStorage.getItem('discord_user_id');

        // If not logged in, we try to send anyway but it might fail or user ID missing. 
        // We rely on login-btn in intro or login check here.

        // API BASE URL - Change this to your Bot's Public URL if website is on different domain
        // e.g. 'http://123.45.67.89:3001'
        const API_BASE = '';

        fetch(`${API_BASE}/api/complete-story`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                storyId: 'menma_adventure',
                status: 'completed',
                jutsuChosen: jutsuChoice,
                userId: userId // Send ID if available
            }),
        })
            .then(response => response.json())
            .then(data => {
                console.log('API response:', data);
                const outroTitle = document.querySelector('#panel-outro .title');
                if (outroTitle && data.success) outroTitle.innerText = "SAVED! TO BE CONTINUED...";
            })
            .catch(error => console.error('Error:', error));
    }
});
//hello
