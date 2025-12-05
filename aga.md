Winter Frost Royal Theme - Enhanced Effects Code
Replace the "Sparkling Effects" section in 
profile.js
 (around lines 364-376) with this enhanced winter code:

// --- Sparkling Effects (for premium themes) ---
    if (theme.isPremium) {
        if (theme.isWinter) {
            // === WINTER FROST ROYAL EFFECTS ===
            
            // 1. Falling Snowflakes (animated look)
            for (let i = 0; i < 200; i++) {
                const x = Math.random() * canvas.width;
                const y = Math.random() * canvas.height;
                const size = Math.random() * 3 + 1;
                const alpha = Math.random() * 0.8 + 0.2;
                
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(Math.random() * Math.PI * 2);
                
                // Draw 6-armed snowflake
                for (let j = 0; j < 6; j++) {
                    ctx.rotate(Math.PI / 3);
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(0, -size * 2);
                    ctx.strokeStyle = `rgba(224, 242, 254, ${alpha})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                    
                    // Side branches
                    ctx.beginPath();
                    ctx.moveTo(0, -size);
                    ctx.lineTo(-size * 0.5, -size * 1.5);
                    ctx.moveTo(0, -size);
                    ctx.lineTo(size * 0.5, -size * 1.5);
                    ctx.stroke();
                }
                ctx.restore();
            }
            
            // 2. Icy Diamond Crystals
            for (let i = 0; i < 50; i++) {
                const x = Math.random() * canvas.width;
                const y = Math.random() * canvas.height;
                const size = Math.random() * 4 + 2;
                const alpha = Math.random() * 0.4 + 0.1;
                
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(Math.random() * Math.PI);
                
                // Diamond crystal shape
                ctx.beginPath();
                ctx.moveTo(0, -size);
                ctx.lineTo(size * 0.6, 0);
                ctx.lineTo(0, size);
                ctx.lineTo(-size * 0.6, 0);
                ctx.closePath();
                
                const crystalGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
                crystalGradient.addColorStop(0, `rgba(240, 249, 255, ${alpha * 1.5})`);
                crystalGradient.addColorStop(1, `rgba(224, 242, 254, ${alpha * 0.3})`);
                ctx.fillStyle = crystalGradient;
                ctx.fill();
                
                ctx.strokeStyle = `rgba(240, 249, 255, ${alpha})`;
                ctx.lineWidth = 0.5;
                ctx.stroke();
                ctx.restore();
            }
            
            // 3. Frost Shimmer Effect (large glowing particles)
            for (let i = 0; i < 30; i++) {
                const x = Math.random() * canvas.width;
                const y = Math.random() * canvas.height;
                const radius = Math.random() * 3 + 2;
                const alpha = Math.random() * 0.3 + 0.1;
                
                const shimmerGradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 3);
                shimmerGradient.addColorStop(0, `rgba(224, 242, 254, ${alpha * 2})`);
                shimmerGradient.addColorStop(0.5, `rgba(224, 242, 254, ${alpha})`);
                shimmerGradient.addColorStop(1, `rgba(224, 242, 254, 0)`);
                
                ctx.fillStyle = shimmerGradient;
                ctx.beginPath();
                ctx.arc(x, y, radius * 3, 0, Math.PI * 2);
                ctx.fill();
            }
            
        } else {
            // Regular sparkles for other premium themes
            for (let i = 0; i < 150; i++) {
                const x = Math.random() * canvas.width;
                const y = Math.random() * canvas.height;
                const radius = Math.random() * 1.5 + 0.5;
                const alpha = Math.random() * 0.6 + 0.2;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2, false);
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.fill();
            }
        }
    }
Additional Enhancement: Crystalline Borders
Also update the 
drawSection
 function (around line 620) to add icy borders for winter theme:

function drawSection(ctx, x, y, width, height, borderColor) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 10);
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y + 5);
    ctx.lineTo(x, y + height - 5);
    ctx.stroke();
    
    // Add crystalline effect for frost theme
    if (borderColor === '#e0f2fe') {  // Frost Royal primary color
        // Inner glow
        ctx.strokeStyle = 'rgba(240, 249, 255, 0.3)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 10);
        ctx.stroke();
        
        // Outer glow
        ctx.strokeStyle = 'rgba(224, 242, 254, 0.2)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 10);
        ctx.stroke();
        
        // Add small ice crystals on corners
        const corners = [
            {x: x + 15, y: y + 15},
            {x: x + width - 15, y: y + 15},
            {x: x + 15, y: y + height - 15},
            {x: x + width - 15, y: y + height - 15}
        ];
        
        corners.forEach(corner => {
            ctx.save();
            ctx.translate(corner.x, corner.y);
            ctx.rotate(Math.PI / 4);
            
            ctx.beginPath();
            ctx.moveTo(0, -3);
            ctx.lineTo(2, 0);
            ctx.lineTo(0, 3);
            ctx.lineTo(-2, 0);
            ctx.closePath();
            
            ctx.fillStyle = 'rgba(224, 242, 254, 0.6)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(240, 249, 255, 0.8)';
            ctx.lineWidth = 0.5;
            ctx.stroke();
            ctx.restore();
        });
    }
}
Instructions:
Find the "Sparkling Effects" section (lines 364-376)
Replace it with the first code block above
Find the 
drawSection
 function (around line 620)
Replace it with the second code block above
This will give the FROST_ROYAL theme:

❄️ 200 animated snowflakes
💎 50 icy diamond crystals
✨ 30 frost shimmer particles
🔷 Crystalline glowing borders on all sections
💠 Ice crystal decorations on section corners