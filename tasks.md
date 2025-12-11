# Winter Event & System Overhaul - Technical Master Plan

## 🚨 Instructions for AI Coders
This file serves as the strict requirements document for the Winter Update. All changes must adhere to these specifications.
**Mark tasks as completed with [x] only after verification.**

---

## 1. Event Command Revamp (`commands/event.js`)
**Objective**: Create a cohesive Story -> Raid -> Boss experience.

- [ ] **Lore Integration**
    - [ ] Update `event.js` to check `RaidStoryCompleted: true` (from `korilore.json` or `users.json`).
    - [ ] **Story Flow**:
        -   If `RaidStoryCompleted` is FALSE: Send an ephemeral message directing user to `https://shinobirpg.online` to read the lore.
        -   If `RaidStoryCompleted` is TRUE: Start the Raid Event.
    - [ ] **Raid Dialogues**: Implement webhook-style embeds for:
        -   **Intro**: Kakashi briefing the team before the Castle Raid.
        -   **Outro**: Rescuing Sasuke and return to village (Happy Ending).

- [ ] **Raid Mechanic (The "Castle")**
    - [ ] **Structure**: 50 Floors (Battles).
    - [ ] **NPC System**:
        -   Create 10 Unique Base NPCs (Ice Guards, Snow Wolves, etc.).
        -   **Tier System**: 5 Tiers.
        -   **Loop Logic**: Floor 1-10 (Tier 1 NPCs), Floor 11-20 (Tier 2 NPCs)... Floor 41-50 (Tier 5 NPCs).
        -   **Scaling**: Tier 2 must be substantially stronger than Tier 1. Use a multiplier (e.g., 1.5x stats per tier).
    - [ ] **Battle Engine**:
        -   Use `combinedcommands.js` -> `runBattle()` function.
        -   **Button Flow**: "Next Floor" button appears after each win. "Retreat" saves progress.
    - [ ] **Persistence**: Save current floor in `raid.json` (or `users.json`).

- [ ] **Boss Fight: King Kori (Floor 51)**
    - [ ] **Stats**:
        -   HP: 500,000,000 (500 Million).
        -   Power/Defense: Scale dynamically to be "Close to User's Stats" (e.g., User Stats * 1.1 + Base Value).
    - [ ] **Enrage Phase**:
        -   Trigger: HP < 75%.
        -   Effect: Unlock OHKO (One-Hit KO) moves.
    - [ ] **Boss Jutsus (New Rotation)**:
        -   `Twin Rising Dragons` (10% Chance)
        -   `Primary Lotus` (5% Chance)
        -   `Needle Assault` (10% Chance)
        -   `Planetary Devastation` (3% Chance, OHKO Effect)
    - [ ] **Battle Loop**: Boss attacks FIRST (From Soulsborne logic).
        -   Turn 1: Boss Attacks -> User Attacks.

---

## 2. Daily Rewards (`commands/daily.js` or `event.js`)
- [ ] **15-Day Calendar (Dec 10 - Dec 25)**
    - [ ] **Logic**: UTC based 24h cooldown.
    - [ ] **Rewards Pool** (Randomized per day, non-repetitive logic):
        -   EXP, Ramen, Ryo.
        -   **Guaranteed**: Christmas Tokens (High Amount).
    - [ ] **Visuals**: Use `canvas` to generate an image using the "cool image from crank" (locate this asset).

---

## 3. Shop & Jutsus (`commands/shop.js`, `commands/buy.js`)
- [ ] **Event Shop Category**
    - [ ] Remove old items.
    - [ ] Add New Jutsus (from Boss list above).
    - [ ] **Ultimate Jutsu**: `Crystal Palace` (Cost: 500 Christmas Tokens).
    - [ ] **Profile Theme**: `Frost` (High Cost, Limited).
        -   **Auto-Equip**: Buying this MUST immediately set `user.profile_color = "frost"` in `users.json`.

- [ ] **Akatsuki Shop**
    - [ ] **Fix Rotation**: Remove random daily rotation.
    - [ ] **Display All**: List ALL combos from `data/combos.json` simultaneously (like Anbu shop).

---

## 4. Battle System Updates (`commands/combinedcommands.js`)
- [ ] **Role-Based Buffs (Sannin & Hokage)**
    - [ ] **Sannin Role**: Passively regenerate 20% Max HP per round.
    - [ ] **Hokage Role**: Passively regenerate 50% Max HP per round.
    - [ ] **Implementation**: Check `member.roles.cache` inside the `runBattle` loop.
    - [ ] **Feedback**: Add an embed/log entry: *"The power of the [Role] regenerates X HP!"*

- [ ] **New Effects**
    - [ ] **OHKO**: Implement status effect/damage formula: `damage = target.health * 1` (Instant Kill).
    - [ ] **Hyuga Nerf**:
        -   Reduce Chakra Drain amount.
        -   Cap Ultimate Chakra Steal at **30**.

---

## 5. Mission & Progress Tracking (`commands/travel.js`)
- [ ] **Guardian Requirements**
    - [ ] **Logic**: Users must complete X missions/Reach Level Y to challenge Guardians.
    - [ ] **Tracking Fix**:
        -   Check `users.json` for `missions_completed` count.
        -   If missing, implement tracking: Increment `missions_completed` in `runBattle` when a user wins a Mission Battle (Battle Type: 'mission').

---

## 6. Clan System (`commands/clan.js`)
- [ ] **Clan War Penalty**
    - [ ] **Formula**: If Attacker Wins -> `Attacker Clan Power` (No change?) | `Defender Clan Power` = `Defender Power - Attacker Power`.
    -   *Clarification*: User asked "Clan power - enemy power = final power". Assumed this means the LOSER loses power equal to the WINNER's power? Implement exactly as requested.

---

## 7. Documentation
- [x] **Network Architecture**: See `networks.md`.
- [x] **Winter Task List**: This file.


The full instructions in text: finally the task is complete. now we move to the raid command i mean the entirity of the eventt command. And alot of other fixes. Before that though make me a networks.md that explains what we did so far, clearly im not very good at networking so i wannted to learn what was actually going on. everything from the website directory to cloudlfare pages to the post or whatever i need every detial in human language so i understand how its happening and can redo it in the future. Coming back to the event command though, first of all we need to fix the main page. I need you to completely revamp the event command based on what? well, we just made the website directory and in which the index.html contains the story that we created i call it the lore. So this will be like the highlight of the event, the lore. I need you to build the jutsus,. commands, themes, and i need you to actually read the story so that you know where to continue the story from, which is after kakashi says theyre gonna raid the castle. We need to continue the story from there. as for the raid itself; how will it work? well, we're gonna use the runbattle inside combined commands and use that as the battle mechanic like other commands like brank do. We need to define the 10 npcs and use them 5 times in tiers. Like after 10th npc the 11th npc is basically the first but hes repeated as the npc1 tier 2. Upto 5 tiers since we need 50 nps. The battle flow: as soon as the story ends which is through webshooks, the battle starts through a start battle button it uses the runbattle things. and saves progress to raid.json. After the 50 battles is the raid boss King Kori, he's a singular npc with alot of strnegths. Now im a biiiig soulsborne fan i have played alot of souls games like elden ring, sekiro dark souls and all and what ive learned from them is that bosses weak or strong heres the algorithm: 
boss has 100 hp so do you. Boss attacks first deals 10 damage, you attack too and deal 25 damage. Now the boss is down to 75% hp --> now hes enraged and he has one shot moves. yep all im saying is we're gonna give King Kori 500 million health and close power and defense. The current jutsus are crystal palace, Ice prison, rest i need you to replace them with twin rising dragons 10% chance and primary lotus 5% cchance. needle Assault 10% chance and planetary devestation also 3% chance. As of today its 10th december so ready up 15 days of daily rewards for the users, for the canvas image use the cool image from crank. This also means that we need to make changes to the event shop inside shop: event category replace all the old values with the new jutsus and also update the buy command to support these. Now the crystal palace jutsu will be the most expensive BUT NO! haha This times event features wayy more jutsus than the older one, so we need to adjust it so that the ultimate jutsu is like 500 christmas tokens and even more expensive..is the limited edition profile color: frost. i already made this inside the profile command so we just need to make it so that buy.js automatically sets thier color to frost when buying.  ANother change to shop is the akatsuki side, i tried to make random combos everyday but the logic failed so we need to make it so that all the combos listed inside combos.json are available at once similar to anbu shop. i need you to make a fully explanational winter_task.md in the local storage of this project so i can follow it up as well. And also we need to make changes to the combined commands runbattle as well: we need to make it so that if users have the sannin role, define role id they get 20% hp regen every round and if they have hokage they get 50% instead. Also another change is that travel challenge challenges guardians but ive added requirement slike do 10 missions, there;s no tracker for these missions so no matter how many missions the user does itll stay at zero. We need to (inside runbattle) make it so that every win contributes to +1 of that requirement or we can be smart and track requirements based on existing variable which is mentor. Mentor exp are dropped by missions so we can ask the travel command to fetch that and see if its been increasing to count users missions complted, pick the most relaible way. We need to add a penalty system to clan.js like clan power is 1000 and enemy power is 500 after the fight, if user wins the clan power should be reduced to 500. Like clan power - enemy power = final power after the battle. While we make changes inside combined commands about runbattle and sannin stuff also add a OHKO effect which has a formula of 1 * target.health. AnOther big change id like to make is to hyuga bloodline, its too op rn, drains too much chakra reduce the amount and also the hyuga ultimate should not steal more than 30 chakra. make it like that. there's obviously alot more update tasks.md with these new tasks, i need oyu to write the .md in such a way that the tasks also contain instructions for coder ai's to know exactly what to do and also add space for a white check mark emoji that marks the completion of the task. now i need you to check every file and make HEAVY task + instructions for coder ai insdide tasks.md. Just know that LINE OF CODE dosent matter! we need to achueve the goal, just remember combined commands has 4k lines so we dont need to hold back when coding the event raid command i need it to be perfect.