---
name: ETM bot scope
description: Product scope for ETM's Discord achievement tracker and its OWO relationship.
---

ETM is a Discord bot users can add to their servers. It tracks ETM-designed milestones from recognized OWO commands in channels selected by a server administrator. The administrator can choose one channel, all channels, or turn tracking off.

**Why:** The user requested automatic tracking and explicitly approved channel-scoped or all-channel message monitoring.

**How to apply:** Read only enough message content in the configured scope to recognize OWO commands, store action metadata rather than raw message text, and never run OWO commands or control OWO.
