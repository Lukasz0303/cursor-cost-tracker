import { createLeaderboardView } from './tabs/leaderboard.js'

globalThis.__cctCreateLeaderboardView = createLeaderboardView
document.dispatchEvent(new window.Event('cct-leaderboard-ready'))
