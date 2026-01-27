document.addEventListener('DOMContentLoaded', () => {
    const hiddenContent = document.getElementById('hidden-content');
    const body = document.body;
    let isTorchActive = false;

    // Track mouse movement
    document.addEventListener('mousemove', (e) => {
        if (!isTorchActive) return;

        const x = e.clientX;
        const y = e.clientY;

        // Update the CSS variables for the mask center
        hiddenContent.style.setProperty('--x', `${x}px`);
        hiddenContent.style.setProperty('--y', `${y}px`);
    });

    // Toggle torch on click
    document.addEventListener('click', () => {
        if (!isTorchActive) {
            isTorchActive = true;
            body.classList.add('torch-active');

            // Optional: Play a sound effect? (User said "use whatever game related assets needed")
            // For now, just the visual.
        }
    });

    // Initial position reset (off screen)
    hiddenContent.style.setProperty('--x', `-1000px`);
    hiddenContent.style.setProperty('--y', `-1000px`);
});
