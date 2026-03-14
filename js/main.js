// Loading Reveal Logic
const revealSite = () => {
    if (!document.body.classList.contains('loaded')) {
        setTimeout(() => {
            document.body.classList.add('loaded');
        }, 800);
    }
};

// Main Initialization
window.addEventListener('load', revealSite);

// Failsafe: Reveal site after 4 seconds even if assets are still loading
setTimeout(revealSite, 4000);

// Set up UI interactions as soon as DOM is ready
document.addEventListener('DOMContentLoaded', () => {

    // Custom Cursor Logic
    const cursor = document.getElementById('ots-cursor');
    if (cursor) {
        document.addEventListener('mousemove', (e) => {
            const x = e.clientX - 17;
            const y = e.clientY - 17;
            cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        });
    }

    // Mobile Menu Toggle
    const burger = document.querySelector('.ots-burger');
    const mobileNav = document.querySelector('.ots-mobile-nav');
    const mobileLinks = document.querySelectorAll('.ots-mobile-nav a');

    if (burger && mobileNav) {
        burger.addEventListener('click', () => {
            burger.classList.toggle('active');
            mobileNav.classList.toggle('open');
            document.body.style.overflow = mobileNav.classList.contains('open') ? 'hidden' : 'auto';
        });

        mobileLinks.forEach(link => {
            link.addEventListener('click', () => {
                burger.classList.remove('active');
                mobileNav.classList.remove('open');
                document.body.style.overflow = 'auto';
            });
        });
    }

    // Parallax Tilt Logic (for Grid Items)
    const items = document.querySelectorAll('[data-tilt]');
    items.forEach(item => {
        item.addEventListener('mousemove', (e) => {
            const rect = item.getBoundingClientRect();
            const rotateX = (e.clientY - rect.top - rect.height / 2) / 12;
            const rotateY = (rect.width / 2 - (e.clientX - rect.left)) / 12;
            item.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
        });

        item.addEventListener('mouseleave', () => {
            item.style.transform = 'rotateX(0deg) rotateY(0deg) scale(1)';
        });
    });
});
