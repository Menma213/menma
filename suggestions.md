<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ShinobiRPG - The Unlimited Winter</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Lato:ital,wght@0,300;0,400;1,400&family=Bangers&display=swap"
        rel="stylesheet">
    <link rel="stylesheet" href="style.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/howler/2.2.3/howler.min.js"></script>
</head>

<body>
    <div id="story-container">
        <!-- Intro Panel -->
        <div class="panel active" id="panel-intro">
            <div class="background-layer" style="background: #000;"></div>
            <div class="content-layer centered-text">
                <h1 class="title">Instructions</h1>
                <p class="subtitle">Read the text from left to right. Click anywhere to proceed.</p>
                <div class="instruction">Click to Start</div>
                <button id="login-btn" class="action-btn" style="margin-top: 2rem; pointer-events: auto;">Login with
                    Discord</button>
            </div>
        </div>

        <!-- 1. Konoha Field -->
        <div class="panel" id="panel-1">
            <div class="background-layer">
                <img src="assets/konoha_field.png" alt="Konoha Training Field" class="bg-img">
            </div>
            <div class="content-layer">
                <div class="speech-bubble top-left hidden">
                    <p>It's time for daily practice!</p>
                </div>
                <div class="speech-bubble bottom-right hidden">
                    <p>Wait... where is Sasuke?</p>
                </div>
            </div>
        </div>

        <!-- Info 1 -->
        <div class="panel info-panel" id="panel-info-1">
            <div class="background-layer"></div>
            <div class="content-layer centered-text">
                <div class="info-text hidden">Naruto searches the entire village...</div>
            </div>
        </div>

        <!-- 2. Sasuke's House -->
        <div class="panel" id="panel-2">
            <div class="background-layer">
                <img src="https://i.postimg.cc/Pq3jsLG0/image.png" alt="Sasuke's House" class="bg-img">
            </div>
            <div class="content-layer">
                <div class="speech-bubble left hidden">
                    <p>It's completely empty...</p>
                </div>
                <div class="speech-bubble right hidden">
                    <p>He didn't even sleep here last night.</p>
                </div>
            </div>
        </div>

        <!-- Info 2 -->
        <div class="panel info-panel" id="panel-info-2">
            <div class="background-layer"></div>
            <div class="content-layer centered-text">
                <div class="info-text hidden">Worried, he checks inside...</div>
            </div>
        </div>

        <!-- 3. Naruto Indoors -->
        <div class="panel" id="panel-3">
            <div class="background-layer">
                <img src="https://i.postimg.cc/HxqFdX65/image.png" alt="Naruto Indoors" class="bg-img">
            </div>
            <div class="content-layer">
                <div class="speech-bubble bottom-center hidden">
                    <p>I wonder where he went...</p>
                </div>
            </div>
        </div>

        <!-- Info 3 -->
        <div class="panel info-panel" id="panel-info-3">
            <div class="background-layer"></div>
            <div class="content-layer centered-text">
                <div class="info-text hidden">Suddenly, Kakashi Sensei appears.</div>
            </div>
        </div>

        <!-- 4. Kakashi Explains -->
        <div class="panel" id="panel-4">
            <div class="background-layer">
                <img src="https://i.postimg.cc/Y25KNKfY/image.png" alt="Kakashi Explains" class="bg-img zoomed-out-img">
            </div>
        </div>

        <!-- Info 4 -->
        <div class="panel info-panel" id="panel-info-4">
            <div class="background-layer"></div>
            <div class="content-layer centered-text">
                <div class="info-text hidden">They are summoned to the Council immediately.</div>
            </div>
        </div>

        <!-- 5. Council -->
        <div class="panel" id="panel-5">
            <div class="background-layer">
                <img src="https://i.postimg.cc/HnhQM9ys/image.png" alt="Hokage Council" class="bg-img zoomed-out-img">
            </div>
            <div class="content-layer">
                <div class="speech-bubble hidden">
                    <p>The Elders of the Earth Village have reported that the mysterious occurrence is happening again.
                    </p>
                </div>
                <div class="speech-bubble center impact-shake hidden">
                    <p class="impact-text">Except this time... It is much stronger!</p>
                    <p>We must rescue whoever is missing from Konoha. At all costs!</p>
                </div>
            </div>
        </div>

        <!-- Info 5 -->
        <div class="panel info-panel" id="panel-info-5">
            <div class="background-layer"></div>
            <div class="content-layer centered-text">
                <div class="info-text hidden">A rescue team is formed.</div>
            </div>
        </div>

        <!-- 6. Split Scene -->
        <div class="panel" id="panel-6">
            <div class="background-layer split-bg">
                <img src="https://i.postimg.cc/cLprV4YS/image.png" alt="Kakashi" class="split-img left">
                <img src="https://i.postimg.cc/Kv4jjgrd/image.png" alt="Naruto" class="split-img right">
            </div>
        </div>

        <!-- Info 6 -->
        <div class="panel info-panel" id="panel-info-6">
            <div class="background-layer"></div>
            <div class="content-layer centered-text">
                <div class="info-text hidden">Before leaving, Naruto must prepare.</div>
            </div>
        </div>

        <!-- 7. Choice -->
        <div class="panel" id="panel-7">
            <div class="background-layer">
                <img src="https://i.postimg.cc/BQJXphFB/image.png" alt="Naruto Home" class="bg-img">
            </div>
            <div class="content-layer centered-col">
                <h2 class="choice-title hidden">Choose your Jutsu for the journey</h2>
                <div class="choices-container hidden">
                    <button class="choice-btn" data-choice="shadow_clone">Shadow Clone Jutsu</button>
                    <button class="choice-btn" data-choice="rasengan">Rasengan</button>
                    <button class="choice-btn" data-choice="sexy_jutsu">Sexy Jutsu</button>
                </div>
            </div>
        </div>

        <!-- Info 7 -->
        <div class="panel info-panel" id="panel-info-7">
            <div class="background-layer"></div>
            <div class="content-layer centered-text">
                <div class="info-text hidden">The journey to The Land of Earth begins.</div>
            </div>
        </div>

        <!-- 8. Journey -->
        <div class="panel" id="panel-8">
            <div class="background-layer">
                <img src="https://i.postimg.cc/TPTpRNkD/image.png" alt="Journey Start" class="bg-img zoomed-out-img">
            </div>
        </div>

        <!-- Info 8 -->
        <div class="panel info-panel" id="panel-info-8">
            <div class="background-layer"></div>
            <div class="content-layer centered-text">
                <div class="info-text hidden">They arrive at Iwagakure.</div>
            </div>
        </div>

        <!-- 9. Before -->
        <div class="panel" id="panel-9">
            <div class="background-layer">
                <img src="https://i.postimg.cc/C5nZ7D3m/image.png" alt="Iwagakure" class="bg-img">
            </div>
            <div class="content-layer">
            </div>
        </div>

        <!-- Info 9 -->
        <div class="panel info-panel" id="panel-info-9">
            <div class="background-layer"></div>
            <div class="content-layer centered-text">
                <div class="info-text hidden">But it has changed...</div>
            </div>
        </div>

        <!-- 10. After (NEW IMAGE) -->
        <div class="panel" id="panel-10">
            <div class="background-layer">
                <img src="https://i.postimg.cc/HWMc9M7j/image.png" alt="Iwagakure Snowy" class="bg-img">
            </div>
        </div>

        <!-- Info 10 -->
        <div class="panel info-panel" id="panel-info-10">
            <div class="background-layer"></div>
            <div class="content-layer centered-text">
                <div class="info-text hidden">Sasuke..</div>
            </div>
        </div>

        <!-- 11. Old After Image (Tunnel/Cave) -->
        <div class="panel" id="panel-11">
            <div class="background-layer">
                <img src="https://i.postimg.cc/WbMmPLKp/image.png" alt="Frozen Path" class="bg-img">
            </div>
        </div>

        <!-- Info 11 -->
        <div class="panel info-panel" id="panel-info-11">
            <div class="background-layer"></div>
            <div class="content-layer centered-text">
                <div class="info-text hidden">Suddenly, a strange noise echoes.</div>
            </div>
        </div>

        <!-- 12. Red Eyes (Sound Trigger) -->
        <div class="panel sound-trigger-eyes" id="panel-12">
            <div class="background-layer">
                <img src="https://i.postimg.cc/6qcnqKwB/eye.png" alt="Red Eyes" class="bg-img">
            </div>
        </div>

        <!-- Info 12 -->
        <div class="panel info-panel" id="panel-info-12">
            <div class="background-layer"></div>
            <div class="content-layer centered-text">
                <div class="info-text hidden">Meanwhile...</div>
            </div>
        </div>


        <!-- 14. Climb Mission -->
        <div class="panel" id="panel-14">
            <div class="background-layer">
                <img src="https://i.postimg.cc/R0yHRLCV/image.png" alt="Climb Mission" class="bg-img zoomed-out-img">
            </div>
            <div class="content-layer">
                <div class="speech-bubble top-left hidden">
                    <p>Naruto, climb that mountain and see what's happening up there!</p>
                </div>
            </div>
        </div>

        <!-- 15. MINIGAME -->
        <div class="panel" id="panel-minigame">
            <div id="minigame-container"></div>
            <div class="content-layer game-ui" style="pointer-events: none;">
                <button id="start-game-btn" style="pointer-events: auto;">START CLIMB</button>
            </div>

            <!-- Mobile Controls -->
            <div id="touch-controls">
                <div class="d-pad">
                    <div class="d-btn d-up">▲</div>
                    <div class="d-btn d-left">◀</div>
                    <div class="d-btn d-right">▶</div>
                    <div class="d-btn d-down">▼</div>
                </div>
                <div class="action-pad">
                    <button class="control-btn sprint-btn">Run</button>
                    <button class="control-btn jump-btn">Jump</button>
                </div>
            </div>
        </div>


        <!-- 16. NPC Encounter -->
        <div class="panel" id="panel-16">
            <div class="background-layer" style="background: #1a1a1a;">
                <img src="https://i.postimg.cc/TPTpRNkD/image.png" alt="Snowy Peak" class="bg-img"
                    style="opacity: 0.5;">
                <img src="https://i.postimg.cc/LX73fc5q/image.png" alt="Mystery NPC" class="npc-img centered-img"
                    style="height: 80%; width: auto; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);">
            </div>
            <div class="content-layer centered-col">
                <div class="speech-bubble hidden">
                    <p>"Naruto, huh? This'll be fun!"</p>
                </div>
            </div>
        </div>

        <!-- 17. Interaction -->
        <div class="panel" id="panel-17">
            <div class="background-layer" style="background: #1a1a1a;">
                <img src="https://i.postimg.cc/LX73fc5q/image.png" alt="Mystery NPC" class="npc-img centered-img"
                    style="height: 80%; width: auto; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);">
            </div>
            <div class="content-layer centered-col">
                <h2 class="choice-title hidden">What will you do?</h2>
                <div class="interaction-container hidden">
                    <button class="action-btn fight" data-action="fight">FIGHT</button>
                    <button class="action-btn flee" data-action="flee">FLEE</button>
                </div>
            </div>
        </div>

        <!-- 18. Resolution (Text) -->
        <div class="panel" id="panel-18">
            <div class="background-layer" style="background: #000;"></div>
            <div class="content-layer centered-text">
                <div class="resolution-text hidden"
                    style="font-size: 2rem; color: white; padding: 2rem; text-align: center;">...</div>
            </div>
        </div>

        <!-- 19. Info: Return to Team -->
        <div class="panel info-panel" id="panel-19">
            <div class="background-layer"></div>
            <div class="content-layer centered-text">
                <div class="info-text hidden">Naruto rushes back to Kakashi and Sakura.</div>
            </div>
        </div>

        <!-- 20. Kakashi Convo -->
        <div class="panel" id="panel-20">
            <div class="background-layer">
                <img src="https://i.postimg.cc/cLygYsmH/image.png" alt="Kakashi Talk" class="bg-img">
            </div>
        </div>

        <!-- 21. Raid Plan -->
        <div class="panel" id="panel-21">
            <div class="background-layer">
                <img src="https://i.postimg.cc/nhys4nGX/image.png" alt="Raid Plan" class="bg-img">
            </div>
            <div class="content-layer">
                <div class="speech-bubble bottom-center hidden">
                    <p>"We're raiding this place."</p>
                </div>
            </div>
        </div>

        <!-- Outro -->
        <div class="panel" id="panel-outro">
            <div class="background-layer" style="background: #000;"></div>
            <div class="content-layer centered-text">
                <h1 class="title hidden">TO BE CONTINUED IN DISCORD</h1>
                <p class="subtitle hidden">The raid continues on the server.</p>
                <div class="info-text hidden" style="margin-top:20px; font-size: 1rem;">(Your progress has been saved)
                </div>
                <button class="restart-btn hidden" onclick="location.reload()"
                    style="pointer-events: auto; margin-top: 2rem;">Replay Story</button>
            </div>
        </div>

        <!-- UI Overlay -->
        <div class="progress-bar">
            <div class="progress-fill"></div>
        </div>
    </div>

    <script src="bridge_game.js"></script>
    <script src="script.js"></script>
</body>

</html>
<!--this will be the comment xd-->


hub.html:
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ShinobiRPG - Hub</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Lato:ital,wght@0,300;0,400;1,400&family=Bangers&display=swap"
        rel="stylesheet">
    <style>
        /* this will be the comment xd */
        :root {
            --bg-dark: #050505;
            --accent: #ff4757;
            --text-primary: #ffffff;
            --font-heading: 'Cinzel', serif;
            --font-body: 'Lato', sans-serif;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            width: 100%;
            min-height: 100vh;
            background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
            font-family: var(--font-body);
            color: var(--text-primary);
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }

        .hub-container {
            max-width: 600px;
            width: 100%;
            text-align: center;
            background: rgba(0, 0, 0, 0.7);
            padding: 3rem 2rem;
            border-radius: 20px;
            border: 2px solid var(--accent);
            box-shadow: 0 0 50px rgba(255, 71, 87, 0.3);
        }

        h1 {
            font-family: var(--font-heading);
            font-size: 3rem;
            margin-bottom: 1rem;
            background: linear-gradient(to right, #ffffff, #ff4757);
            background-clip: text;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .welcome-text {
            font-size: 1.5rem;
            margin-bottom: 3rem;
            color: #ccc;
        }

        .story-btn {
            padding: 1.5rem 3rem;
            font-size: 1.5rem;
            font-family: var(--font-heading);
            background: var(--accent);
            color: white;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            box-shadow: 0 5px 20px rgba(255, 71, 87, 0.4);
        }

        .story-btn:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 30px rgba(255, 71, 87, 0.6);
        }

        .user-info {
            margin-bottom: 2rem;
            font-size: 1.2rem;
            opacity: 0.8;
        }

        @media (max-width: 768px) {
            h1 {
                font-size: 2rem;
            }

            .welcome-text {
                font-size: 1.2rem;
            }

            .story-btn {
                padding: 1rem 2rem;
                font-size: 1.2rem;
            }
        }
    </style>
</head>

<body>
    <div class="hub-container">
        <h1>ShinobiRPG</h1>
        <div class="user-info">
            <p class="welcome-text">Welcome, <span id="username">Ninja</span>!</p>
        </div>
        <button class="story-btn" onclick="window.location.href='/'">Continue Story</button>
    </div>

    <script>
        // Get user data from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const username = urlParams.get('username');
        const discordId = urlParams.get('discord_id');
        const avatar = urlParams.get('avatar');

        if (username) {
            document.getElementById('username').textContent = username;
            // Store in localStorage for the story page
            localStorage.setItem('discord_username', username);
            localStorage.setItem('discord_user_id', discordId);
            if (avatar) localStorage.setItem('discord_avatar', avatar);
        }
    </script>
</body>

</html>