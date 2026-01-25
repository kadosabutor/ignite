# IGNITE - Habit Tracker PWA

## 📋 Project Overview

**IGNITE** is a Progressive Web App (PWA) for habit tracking with social/gamification features. It's built with React 19 + TypeScript + Vite frontend and Supabase (PostgreSQL + Auth) backend.

**Purpose**: Track daily habits (sleep, work, exercise) with a comprehensive scoring system, streaks, leaderboards, and social features to keep users motivated.

**Language**: Hungarian UI

---

## 🎯 Core Features

### User Tracking System
- **Daily Entry Form (Wizard)**: Multi-step form to log:
  - Sleep (wake time, bed time, minutes, HRV, resting pulse, sleep efficiency)
  - Business/Work minutes logged
  - Health metrics (exercise, clean eating, paradigm adherence)
  - Purity factors (dopamine content, gaming, satisfaction)
  - Personal obstacles and goals

### Gamification
- **Streak System**: Track consecutive days with levels (Spark → Blaze → Inferno → Plasma)
  - Special states: Frozen (streak lost), Phoenix (recovery trial)
  - Cryo freeze power-up (skip one day without losing streak)
- **Ranking System**: 6 ranks based on daily score (Sleepwalker → Titan)
- **XP/Badge System**: Unlock badges by meeting requirements (streak, focus, vitality, will, mind, special)
- **Scoring Algorithm**: Custom formula in `scoring.ts` (~100 points max, weighted by habits)

### Social Features
- **Friends System**: Add friends by username, track their entries
- **Arena**: Social feed showing friends' daily entries
- **VS Mode**: Compare stats with friends (radar charts, weekly scores)
- **Leaderboards**: Today/week/month rankings
- **Ping System**: Remind friends to complete daily entry
- **Fire Reactions**: Give positive feedback on entries

### Analytics
- **Heatmap**: 12-month calendar view showing daily scores
- **Radar Charts**: 5 dimensions (business, discipline, body, mind, sleep)
- **Metrics Charts**: Line/bar charts for trends
- **History**: Searchable calendar of all entries

### Technical Features
- **PWA**: Installable, offline support, push notifications (VAPID-based)
- **Real-time Sync**: Supabase realtime subscriptions
- **Row-Level Security**: PostgreSQL RLS for data privacy
- **State Management**: React Context (HabitContext, ToastContext)
- **Routing**: React Router v7 with lazy-loaded pages

---

## 📁 Project Structure

```
ignite/
├── public/                    # Static assets
│   ├── manifest.json         # PWA manifest
│   ├── sw.js                 # Service worker (offline + cache)
│   ├── sw-push.js            # Push notification handler
│   └── assets/
│       ├── avatars/          # User avatars (lion, wolf, bull)
│       └── streaks/          # Streak level icons
│
├── src/
│   ├── pages/                # Route components
│   │   ├── Auth.tsx          # Login/register (public route)
│   │   ├── Dashboard.tsx     # Home (today's entry, streak, score)
│   │   ├── Wizard.tsx        # Multi-step daily entry form (5 steps)
│   │   ├── Summary.tsx       # Entry review page
│   │   ├── History.tsx       # 12-month heatmap + search
│   │   ├── Statistics.tsx    # Charts & analytics (radar, line, bar)
│   │   ├── Profile.tsx       # User settings & profile
│   │   ├── Arena.tsx         # Social feed (friends' entries)
│   │   ├── Friends.tsx       # Friend list & requests
│   │   └── FriendProfile.tsx # View friend's stats
│   │
│   ├── components/           # Reusable UI components
│   │   ├── Layout.tsx        # Tab navigation wrapper
│   │   ├── DateSelector.tsx  # Calendar date picker
│   │   ├── Gauge.tsx         # Score gauge visualization
│   │   ├── Heatmap.tsx       # 12-month calendar heatmap
│   │   ├── HeroCard.tsx      # Large stat cards
│   │   ├── ImageCropper.tsx  # Avatar crop tool
│   │   ├── LeaderboardPodium.tsx # Top 3 rankings
│   │   ├── MetricsChart.tsx  # Line/bar charts (Chart.js)
│   │   ├── ProfileCard.tsx   # User profile display
│   │   ├── RadarChart.tsx    # 5-dimension radar (Chart.js)
│   │   ├── StreakIcon.tsx    # Streak level display
│   │   ├── Toast.tsx         # Notifications
│   │   ├── LoadingScreen.tsx # Loading state
│   │   └── ui/               # Basic atoms (Button, Input, Card, etc.)
│   │
│   ├── context/              # React Context
│   │   ├── HabitContext.tsx  # Main state: auth, entries, friends, profile
│   │   └── ToastContext.tsx  # Toast notifications
│   │
│   ├── lib/                  # Business logic
│   │   ├── supabase.ts       # Supabase client + all DB functions (~1257 lines)
│   │   ├── scoring.ts        # Score/rank/streak calculations
│   │   ├── gamification.ts   # Badge unlocking logic
│   │   ├── insight-engine.ts # AI insights generation
│   │   ├── push.ts           # Push notification handling
│   │   └── cropImage.ts      # Image processing
│   │
│   ├── types/                # TypeScript interfaces
│   │   └── index.ts          # HabitEntry, UserProfile, Friend, Badge, etc.
│   │
│   ├── App.tsx               # Main router + ProtectedRoute wrappers
│   ├── main.tsx              # React DOM render
│   ├── index.css             # Global styles + CSS variables
│   └── App.css               # App styles
│
├── supabase/
│   └── functions/
│       ├── cron-scheduler/   # Deno function for daily cron jobs
│       └── send-push/        # Deno function to send push notifications
│
├── supabase-schema.sql       # PostgreSQL schema (tables, RLS, functions)
├── vite.config.ts            # Vite + PWA plugin config
├── tsconfig.json             # TypeScript config
├── package.json              # Dependencies & scripts
├── .env                      # Supabase credentials (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
├── .gitignore                # Ignore node_modules, dist, .env, .pw.txt
└── README.md                 # This file
```

---

## 🗄️ Database Schema Overview

**Tables** (all in PostgreSQL via Supabase):
- `users` - User profiles with rank, bio, XP
- `habit_entries` - Daily habit data (sleep, work, exercise, etc.) with score
- `streaks` - Streak tracking (current, longest, level, phoenix state)
- `friends` - Friendship connections between users
- `badges` - Badge unlocks by user
- `notifications` - User notification preferences

All tables have RLS enabled - users can only access their own data unless explicitly allowed (e.g., friends can view each other's entries).

---

## 🔧 Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript, Vite |
| **Styling** | CSS Modules (dark theme) |
| **State** | React Context API |
| **Routing** | React Router v7 |
| **Charts** | Chart.js + react-chartjs-2 |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth (email/password) |
| **Real-time** | Supabase Realtime subscriptions |
| **PWA** | vite-plugin-pwa, Workbox |
| **Notifications** | Web Push (VAPID keys) |
| **Build** | Vite + TypeScript compiler |

---

## 🚀 Key Code Patterns for AI Agents

### Adding a New Habit Field
1. Update `HabitEntry` type in [src/types/index.ts](src/types/index.ts)
2. Add form step in [src/pages/Wizard.tsx](src/pages/Wizard.tsx)
3. Add SQL column in [supabase-schema.sql](supabase-schema.sql)
4. Update `saveEntry()` in [src/lib/supabase.ts](src/lib/supabase.ts)
5. Update `calculateTotalScore()` in [src/lib/scoring.ts](src/lib/scoring.ts) if it affects score

### Adding a New Page
1. Create component in [src/pages/](src/pages/)
2. Add route in [src/App.tsx](src/App.tsx) (protected or public)
3. Wrap in `<ProtectedRoute>` if auth required
4. Add to tab nav in [src/components/Layout.tsx](src/components/Layout.tsx) if top-level

### State Management Pattern
All state flows through `HabitContext.tsx`. Access via `useHabits()` hook:
```tsx
const { isAuthenticated, user, entries, friends, saveEntry } = useHabits();
```

### Database Function Pattern
```typescript
// In src/lib/supabase.ts - typical pattern
export async function myFunction(userId: string) {
  const { data, error } = await supabase
    .from('table_name')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error) throw error;
  return data;
}
```

---

## 🔐 Security Posture

### ✅ Current Security
- **Authentication**: Supabase Auth (email/password) with JWT tokens
- **Data Privacy**: PostgreSQL RLS policies prevent unauthorized access
- **Sensitive Operations**: All mutations require auth
- **Anonymous Key**: Supabase public/anon key is designed to be exposed; RLS enforces access control
- **Push Notifications**: VAPID public key is public by design
- **No Third-party APIs**: No OpenAI, external APIs, or exposed service keys
- **No API Keys Exposed**: Verified - only Supabase credentials needed

### ⚠️ CRITICAL Security Issues Found

**🚨 ACTION REQUIRED:**

1. **`.env` file is not in `.gitignore`**
   - Currently contains live Supabase credentials
   - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are exposed
   - If repo is public/shared, these should be considered compromised

2. **`.pw.txt` file exists** - Remove if it contains passwords

**Immediate Actions:**
1. Add to `.gitignore`:
   ```
   .env
   .env.local
   .env.*.local
   .pw.txt
   ```
2. If repo is public, rotate Supabase anonymous key (Supabase Dashboard → Settings → API → Rotate Key)
3. Create `.env.example` with placeholder values for documentation
4. Delete sensitive local files from git history if needed

### ✅ Security Recommendations
- Ensure `.env` is NEVER committed
- Monitor Supabase logs for suspicious activity (Dashboard → Logs)
- Keep RLS policies strict (review [supabase-schema.sql](supabase-schema.sql))
- Use `.env.example` to document required env variables without exposing keys
- Implement rate limiting on auth endpoints if needed

---

## 📦 Dependencies

### Core
- `@supabase/supabase-js` - Database & auth client
- `react` / `react-dom` - UI framework
- `react-router-dom` - Routing
- `typescript` - Type safety

### UI/Visualization
- `chart.js` - Charts library
- `react-chartjs-2` - React wrapper for charts
- `uuid` - ID generation

### Data
- `date-fns` - Date utilities
- `localforage` - Offline storage

### PWA
- `vite-plugin-pwa` - PWA support
- `workbox-window` - Service worker management
- `web-push` - Push notifications

**Note**: No external API services (OpenAI, GPT, etc.) configured. All features use local computation or Supabase.

---

## 🏃 Development Commands

```bash
# Install (uses pnpm - faster than npm)
pnpm install

# Dev server (http://localhost:5173)
pnpm dev

# Type check + build production
pnpm build

# Preview production build locally
pnpm preview

# Lint check
pnpm lint
```

**First Time Setup**:
1. Create `.env` from values below (add Supabase credentials)
2. Run `pnpm install && pnpm dev`
3. Create Supabase account, create project, copy credentials
4. Paste into `.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
5. Run schema in Supabase SQL Editor from [supabase-schema.sql](supabase-schema.sql)

---

## 🧠 Important Business Logic

### Scoring System
- Daily score calculated by [src/lib/scoring.ts](src/lib/scoring.ts) → `calculateTotalScore()`
- Points distributed across habits (sleep ~33 pts, work ~37 pts, exercise 7 pts, etc.)
- Max ~100 points/day
- Weighted formula - some habits worth more than others

### Streak Logic
- Resets if no entry by 4:00 AM cutoff
- Levels: Spark (1-7 days) → Blaze (8-30) → Inferno (31-90) → Plasma (91+)
- Cryo Freeze: Skip 1 day without losing streak (limited uses)
- Phoenix: Recover broken streak within 3 days

### Ranks
- Based on monthly average score (0-100)
- 6 tiers: Sleepwalker → Grinder → Operator → HighPerformer → MonkMode → Titan
- Reset monthly, calculated in [src/lib/scoring.ts](src/lib/scoring.ts)

### Badge System
- Unlock by meeting specific criteria (streaks, scores, etc.)
- 6 categories: streak, focus, vitality, will, mind, special
- Logic in [src/lib/gamification.ts](src/lib/gamification.ts)

---

## 📊 Data Flow

```
User Action (e.g., "Save Entry")
    ↓
Page Component (e.g., Wizard.tsx)
    ↓
HabitContext (calls supabase.ts function)
    ↓
Supabase.ts (executes query via @supabase/supabase-js)
    ↓
Supabase Backend (PostgreSQL with RLS)
    ↓
Response back to HabitContext
    ↓
Context state updates
    ↓
Components re-render via Context hook
```

---

## 🐛 Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Can't access data after login | RLS policy blocks user | Check RLS in supabase-schema.sql |
| Entry not saving | Foreign key constraint | Verify user_id matches auth |
| Charts not rendering | Missing data points | Ensure entries exist for date range |
| Offline doesn't work | Service worker not registered | Check public/sw.js and manifest.json |
| Notifications not received | VAPID key mismatch | Verify VAPID keys in send-push function |
| `.env` file errors | Missing credentials | Create `.env` with Supabase URL & anon key |

---

## 🎨 Styling Guide

- **Dark theme** - All components use dark background (#121212)
- **Primary color** - Orange (#ff7033) used for accents
- **CSS Modules** - Each component has scoped `.module.css` file
- **Variables** - Global colors in [src/index.css](src/index.css)
- **Mobile-first** - Responsive design, optimized for portrait phones

---

## 📚 For AI Agents: Quick Integration Tips

**To understand the codebase**:
1. Start with [src/types/index.ts](src/types/index.ts) - defines all data structures
2. Review [src/lib/supabase.ts](src/lib/supabase.ts) - shows all DB operations
3. Check [src/context/HabitContext.tsx](src/context/HabitContext.tsx) - state management
4. Look at a page like [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx) - component pattern

**To make changes**:
- For new features: Update types → add DB function → add context method → add UI
- For bug fixes: Find the page component → trace up to context → check supabase.ts
- For styling: Modify `[component].module.css` or [src/index.css](src/index.css)

**To debug**:
- Check browser console for React errors
- Review Supabase logs (Dashboard → Logs)
- Use React DevTools to inspect context state
- Verify RLS policies allow the operation

---

## 📞 Additional Resources

- **Supabase Docs**: https://supabase.com/docs
- **React Docs**: https://react.dev
- **TypeScript Docs**: https://www.typescriptlang.org/docs
- **Chart.js**: https://www.chartjs.org/docs/latest/
- **PWA Guide**: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps

---

## ✨ Project Status

See [todo.md](todo.md) for current tasks and roadmap.
