# 🎴 Project Shinobi TCG: "Classic Gwent" Integration Plan

This document outlines the roadmap to align our Anime TCG with the **Gwent Classic** mechanics found in the `temporary/` folder.

---

## 🏗️ 1. Card Structure Alignment
To match the `gwent-classic` engine, our character cards need to map to the following schema:

| Classic Field | Anime TCG Mapping | Notes |
| :--- | :--- | :--- |
| `name` | Character Full Name | Already implemented. |
| `deck` | Source Anime (e.g., "Naruto") | Will serve as our "Factions". |
| `row` | `close`, `ranged`, `siege`, `agile` | Need to map series/character types to rows. |
| `strength` | OVR (0-120) | **Issue:** Classic Gwent uses 1-15. We must decide if we scale OVR or use it as is. |
| `ability` | Keywords (e.g., `medic`, `spy`) | We need to assign these based on character lore. |

---

## 🛠️ 2. Key Differences & Challenges

### **A. The Strength Scale (OVR 120 vs Strength 15)**
- **Classic Gwent:** Total scores usually stay below 200. With 120 OVR cards, scores could reach 2000+.
- **Decision:** We should probably scale our 0-120 OVR back to a **0-15 Strength** scale for the actual board logic to keep the game balanced and readable, but keep OVR for "Collection Flex".

### **B. Ability Mapping (Lore-Based)**
We need to map Anime character traits to Gwent abilities:
- **Medical Ninjas (Sakura, Tsunade):** `medic` ability.
- **Summoners/Squads (Pain, Clone users):** `muster` ability.
- **Strategists (Shikamaru):** `spy` or `morale` ability.
- **Top Tier (Goku, Saitama):** `hero` status (immune to weather/scorches).

### **C. Special Cards (The Missing Pieces)**
We currently only summon characters. Classic Gwent requires:
- **Weather Cards:** (Frost, Fog, Rain) to debuff rows.
- **Special Cards:** (Decoy, Scorch, Commander's Horn).
- **Leader Cards:** Unique cards that give a one-time per match bonus.

---

## 📅 Phase 1: Data Expansion
- [ ] **Update `tcgUtils.js`:** 
    - Assign a `row` based on AniList "Genre" or "Tags" (e.g., Melee combatants -> `close`).
    - Assign an `ability` based on character tags (e.g., "Medical" tag -> `medic`).
    - Assign a `leader` boolean for certain ultra-rare characters.

## 📅 Phase 2: The Deck Builder
- [ ] Create `/deck` command:
    - Minimum 22 Unit cards.
    - Maximum 10 Special/Weather cards.
    - Choose 1 Leader.

## 📅 Phase 3: The Board Engine
- [ ] Use `temporary/gwent.js` as the logic reference to build our Discord interaction version.
- [ ] Implement Row-based scoring.
- [ ] Implement the 2-of-3 Round system.

---

## 💡 Recommendation:
We should start by **mapping the rows and abilities** in `tcgUtils.js` so that every new character summoned already has its "Gwent" identity.

**Should I update the `calculateStats` function to include Row and Ability assignment based on AniList tags?**
