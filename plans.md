# Menma Engine: Resource Utilization Roadmap (150% CPU / 4GB RAM)

## 1. Deep-Think Battle AI (Intelligence)
- **Objective**: Utilize idle 100%+ CPU during boss battles.
- **Strategy**: Implement Worker Threads to simulate thousands of combat scenarios per turn. NPCs will dynamically choose the most lethal or strategic move based on the simulations.

## 2. Persistent Living World (Simulation)
- **Objective**: Make the ninja world feel alive even without player input.
- **Strategy**: A global ticker (High Priority) simulating real-time events. NPCs moving between villages, dynamic territory takeover attempts, and shifting market prices for scrolls/items.

## 3. Tier-0 Memory Engine (Performance)
- **Objective**: Use the 4GB RAM to reach sub-10ms response times.
- **Strategy**: Permanently cache all JSON data files in memory. Shift the architecture from "Read-on-Request" to "Read-on-Startup" with asynchronous disk flushing to ensure the bot is the fastest in the industry.
