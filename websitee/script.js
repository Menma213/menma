// Global audio element
let bgMusic;

document.addEventListener('DOMContentLoaded', () => {
    const introOverlay = document.getElementById('intro-animation-overlay');
    const appContent = document.getElementById('app-content');

    // --- Background Music Integration ---
    // Make sure 'assets' directory exists or adjust path
    bgMusic = new Howl({
        src: ['bgmusicstatic.mp3'], // Assuming it's in the same directory for now
        volume: 0.0, // Start at 0 volume
        loop: true,
        autoplay: false // Will play after animation
    });

    // --- Handwriting Animation ---
    const paths = Array.from(document.querySelectorAll('#intro-animation-overlay svg path'));
    let tl = gsap.timeline({ paused: true }); // Pause timeline initially

    paths.forEach(path => {
        const length = path.getTotalLength();
        path.style.strokeDasharray = length;
        path.style.strokeDashoffset = length;

        // Animate each path
        tl.to(path, { strokeDashoffset: 0, duration: 0.8, ease: "power1.out" }, "-=0.2"); // Overlap animations
    });

    // Play the animation, then fade out the overlay
    tl.play();
    tl.then(() => {
        // After SVG animation, start background music and fade in main content
        bgMusic.play();
        bgMusic.fade(0, 0.3, 2000); // Fade in to 30% volume over 2 seconds

        gsap.to(introOverlay, {
            opacity: 0,
            duration: 1,
            onComplete: () => {
                introOverlay.classList.add('hidden'); // Add hidden class after fade
                // Show main content if it was hidden for the animation
                // appContent.style.display = 'block'; // If you want to explicitly show
            }
        });
    });


    // --- Navigation Logic (from previous step) ---
    const navLinks = document.querySelectorAll('.nav-link');
    const pageSections = document.querySelectorAll('.page-section');

    function showPage(pageId) {
        pageSections.forEach(section => {
            if (section.id === `${pageId}-page`) {
                section.classList.add('active');
            } else {
                section.classList.remove('active');
            }
        });

        navLinks.forEach(link => {
            if (link.dataset.page === pageId) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = e.target.dataset.page;
            if (pageId) {
                showPage(pageId);
                history.pushState({ page: pageId }, '', `#${pageId}`);
            }
        });
    });

    window.addEventListener('popstate', (event) => {
        if (event.state && event.state.page) {
            showPage(event.state.page);
        } else {
            showPage('home');
        }
    });

    const initialPage = window.location.hash.substring(1) || 'home';
    showPage(initialPage);

    // --- Game Page Logic ---
    const playGameBtn = document.getElementById('play-game-btn');
    const gameContainer = document.getElementById('game-container');
    const gameIframe = document.getElementById('game-iframe');

    if (playGameBtn && gameContainer && gameIframe) {
        playGameBtn.addEventListener('click', () => {
            gameIframe.src = 'pixel-dungeon-game/index.html';
            gameContainer.style.display = 'block';
            playGameBtn.style.display = 'none';
        });
    }
});
