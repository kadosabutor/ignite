# IGNITE - Habit Tracker PWA

## 📋 Project Overview

**IGNITE** is a Progressive Web App (PWA) for habit tracking with social features. It's built with:
- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Supabase (PostgreSQL database + Authentication)
- **Styling**: CSS Modules
- **State Management**: React Context API
- **Routing**: React Router v7

The app is in **Hungarian** and focuses on tracking daily habits (sleep, work, exercise, etc.) with gamification elements like streaks, ranks, and social features.

---

## 📁 Project Structure

```
ignite/
├── public/                    # Static assets
│   ├── assets/
│   │   ├── avatars/          # User avatar SVGs (lion, wolf, bull)
│   │   ├── streaks/          # Streak level icons (spark, blaze, inferno, etc.)
│   │   └── icon-*.png        # PWA icons
│   ├── logo.png              # App logo
│   ├── manifest.json         # PWA manifest
│   └── sw.js                 # Service worker for offline support
│
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── Layout.tsx        # Main layout with tab navigation
│   │   ├── RadarChart.tsx    # Radar chart for statistics
│   │   ├── StreakIcon.tsx    # Streak level display
│   │   └── ui/               # Basic UI components (Button, Card, Input, etc.)
│   │
│   ├── context/              # React Context providers
│   │   └── HabitContext.tsx  # Main app state (auth, entries, friends, etc.)
│   │
│   ├── lib/                  # Utility libraries
│   │   ├── supabase.ts       # Supabase client & database functions
│   │   ├── scoring.ts        # Score calculation logic
│   │   ├── storage.ts        # Local storage utilities
│   │   └── push.ts           # Push notification handling
│   │
│   ├── pages/                # Page components (routes)
│   │   ├── Auth.tsx          # Login/Register page
│   │   ├── Dashboard.tsx     # Home page (today's score, streak)
│   │   ├── Wizard.tsx        # Multi-step form for daily entry
│   │   ├── Summary.tsx       # Entry summary view
│   │   ├── History.tsx       # Past entries calendar
│   │   ├── Statistics.tsx   # Charts and analytics
│   │   ├── Profile.tsx      # User profile settings
│   │   ├── Arena.tsx         # Social feed (friends' daily entries)
│   │   ├── Friends.tsx       # Friend list and requests
│   │   └── FriendProfile.tsx # View friend's profile
│   │
│   ├── types/                # TypeScript type definitions
│   │   └── index.ts          # All app types (HabitEntry, User, Friend, etc.)
│   │
│   ├── App.tsx               # Main app component with routing
│   ├── main.tsx              # App entry point
│   ├── index.css             # Global styles
│   └── App.css               # App-specific styles
│
├── index.html                # HTML entry point
├── vite.config.ts            # Vite configuration (PWA plugin)
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── supabase-schema.sql       # Database schema (run in Supabase SQL Editor)
└── README.md                 # Project documentation
```

---

## 🚀 Getting Started

### 1. **Setting Up Environment Variables**

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Where to find these:**
- Go to your Supabase project dashboard
- Settings → API
- Copy the "Project URL" and "anon public" key

### 2. **Installing Dependencies**

**First, install pnpm (if not already installed):**
```bash
npm install -g pnpm
```

**Then install project dependencies:**
```bash
pnpm install
```

The project uses `pnpm` as the package manager (you can see `pnpm-lock.yaml`). If you prefer to use `npm` instead, you can run `npm install`, but `pnpm` is recommended for consistency with the lock file.

### 3. **Running the Development Server**

```bash
pnpm dev
```

The app will run on `http://localhost:5173` (or the next available port).

### 4. **Setting Up the Database**

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase-schema.sql`
4. Run the SQL script

This creates all necessary tables, indexes, and Row Level Security (RLS) policies.

---

## 📝 Common Editing Tasks

### **Adding a New Page**

1. Create a new component in `src/pages/`:
   ```tsx
   // src/pages/NewPage.tsx
   import styles from './NewPage.module.css';
   
   export function NewPage() {
     return <div className={styles.container}>New Page</div>;
   }
   ```

2. Add the route in `src/App.tsx`:
   ```tsx
   import { NewPage } from './pages/NewPage';
   
   // In AppRoutes component:
   <Route path="/newpage" element={
     <ProtectedRoute>
       <Layout />
     </ProtectedRoute>
   }>
     <Route index element={<NewPage />} />
   </Route>
   ```

3. Optionally add to tab navigation in `src/components/Layout.tsx`:
   ```tsx
   const TABS = [
     // ... existing tabs
     { id: '/newpage', label: 'New Page', icon: '🆕' },
   ];
   ```

### **Modifying the Daily Entry Form (Wizard)**

The wizard is in `src/pages/Wizard.tsx`. It currently has 5 steps:
1. Sleep (Alvás)
2. Work (Business)
3. Health (Egészség) - includes Exercise, Clean Eating, and Paradigma
4. Purity (Tisztaság)
5. Summary (Összegzés)

To add a new field:
1. Update `HabitEntry` type in `src/types/index.ts`
2. Add the field to the wizard step component
3. Update the database schema in `supabase-schema.sql` (if needed)
4. Update `saveEntry` function in `src/lib/supabase.ts` to save the new field

### **Changing Scoring Logic**

Edit `src/lib/scoring.ts`. The `calculateTotalScore()` function calculates the daily score based on:
- Sleep minutes (max 33 points)
- Business minutes (max 37 points)
- Exercise (boolean, 7 points)
- Clean eating (boolean, 6 points)
- Paradigm (boolean, 5 points)
- Satisfaction (boolean, 4 points if false)
- Dopamine content (boolean, 3 points if false)
- Gaming (boolean, 5 points if false)

### **Modifying Streak Levels**

Edit `STREAK_LEVELS` in `src/types/index.ts`:
```typescript
export const STREAK_LEVELS: Record<StreakLevel, { ... }> = {
  spark: { name: 'Spark', minDays: 1, maxDays: 7, ... },
  // ... modify or add new levels
};
```

### **Changing User Ranks**

Edit `RANKS` in `src/types/index.ts`:
```typescript
export const RANKS: Record<RankType, { ... }> = {
  sleepwalker: { name: 'Sleepwalker', minScore: 0, maxScore: 49.9, ... },
  // ... modify thresholds or add new ranks
};
```

### **Adding a New Database Table**

1. Add SQL to `supabase-schema.sql`:
   ```sql
   CREATE TABLE IF NOT EXISTS public.new_table (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
     -- your columns here
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

2. Enable RLS and create policies:
   ```sql
   ALTER TABLE public.new_table ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "Users can manage own data" ON public.new_table
     FOR ALL USING (auth.uid() = user_id);
   ```

3. Create TypeScript types in `src/types/index.ts`
4. Add functions in `src/lib/supabase.ts` to interact with the table

### **Styling Changes**

- **Global styles**: Edit `src/index.css`
- **Component styles**: Each component has a `.module.css` file (e.g., `Dashboard.module.css`)
- **Theme colors**: Defined in `src/index.css` as CSS variables:
  ```css
  :root {
    --color-primary: #ff7033;
    --color-background: #121212;
    /* ... */
  }
  ```

### **Adding Push Notifications**

Push notification logic is in `src/lib/push.ts`. To add a new notification:
1. Register subscription in `HabitContext.tsx`
2. Create notification trigger in Supabase (via SQL function or Edge Function)
3. Handle notification display in the relevant page component

---

## 🗂️ Key Files Explained

### **`src/App.tsx`**
- Main routing configuration
- Protected routes (require authentication)
- Public routes (auth page)

### **`src/context/HabitContext.tsx`**
- Central state management
- Provides: authentication, entries, user profile, friends, notifications
- All pages access data via `useHabits()` hook

### **`src/lib/supabase.ts`**
- All database operations
- Functions for: auth, entries, users, friends, streaks, notifications
- Type-safe Supabase queries

### **`src/types/index.ts`**
- All TypeScript type definitions
- Constants (RANKS, STREAK_LEVELS, AVATARS, etc.)
- Single source of truth for data structures

### **`vite.config.ts`**
- Vite build configuration
- PWA plugin settings (manifest, service worker)
- Development server settings

---

## 🏗️ Building for Production

```bash
pnpm build
```

This creates a `dist/` folder with optimized production files.

To preview the production build:
```bash
pnpm preview
```

---

## 🐛 Debugging Tips

1. **Check browser console** for errors
2. **Check Supabase logs** (Dashboard → Logs) for database errors
3. **Verify RLS policies** if you can't access data
4. **Check network tab** to see API requests
5. **Use React DevTools** to inspect component state

---

## 📚 Important Concepts

### **Row Level Security (RLS)**
Supabase uses RLS to secure data. Each table has policies that determine who can read/write data. Check `supabase-schema.sql` for all policies.

### **Streak System**
- Streaks are calculated daily when an entry is saved
- Cutoff time is 4:00 AM (entries before 4 AM count for previous day)
- Levels: Spark (1-7 days) → Blaze (8-30) → Inferno (31-90) → Plasma (91+)
- Special states: Frozen (streak lost), Phoenix (recovery trial)

### **Score Calculation**
Scores are calculated in `src/lib/scoring.ts`. The formula considers:
- Sleep quality (minutes)
- Work productivity (minutes)
- Exercise, clean eating, paradigm, satisfaction
- Negative factors (dopamine content, gaming)

### **Friend System**
- Users can send friend requests by username
- Once connected, friends can see each other's entries in Arena
- Friends can "ping" each other (remind to complete entry)
- Friends can give "fire" reactions to entries

---

## 🎨 UI/UX Patterns

- **Dark theme** throughout
- **Tab navigation** at bottom (hidden on wizard/summary pages)
- **CSS Modules** for scoped styling
- **Mobile-first** design
- **PWA features**: Installable, offline support, push notifications

---

## 🔐 Security Notes

- Never commit `.env` file (it's in `.gitignore`)
- All database access goes through Supabase with RLS
- User authentication handled by Supabase Auth
- Sensitive operations require authentication

---

## 🎯 Quick Reference

| Task | File to Edit |
|------|-------------|
| Change app title | `index.html` |
| Add new page | `src/pages/` + `src/App.tsx` |
| Modify scoring | `src/lib/scoring.ts` |
| Change colors | `src/index.css` |
| Add database field | `supabase-schema.sql` + `src/types/index.ts` + `src/lib/supabase.ts` |
| Modify streak logic | `src/lib/scoring.ts` (getStreakLevel) |
| Change ranks | `src/types/index.ts` (RANKS) |
| Add UI component | `src/components/ui/` |
| Modify wizard | `src/pages/Wizard.tsx` |

---

## 📞 Need Help?

- Check `todo.md` for project status
- Review `supabase-schema.sql` for database structure
- Look at existing pages/components for patterns
- Check Supabase documentation for database queries

---


