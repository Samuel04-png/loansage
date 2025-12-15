# Offline Functionality

TengaLoans now supports full offline functionality! Users can continue working even when their internet connection is lost. All data changes are automatically saved locally and synced when the connection is restored.

## How It Works

### Firestore Offline Persistence

Firebase Firestore automatically enables offline persistence when the app loads. This means:

- **All reads** are cached locally
- **All writes** are queued locally when offline
- **Automatic sync** happens when connection is restored
- **No data loss** - everything is saved locally first

### Features

1. **Offline Detection**
   - Automatically detects when device goes offline/online
   - Shows visual indicators in the UI
   - Tracks pending writes

2. **Visual Indicators**
   - **Offline Banner**: Shows at the top when offline
   - **Sync Status**: Shows when syncing pending changes
   - **Online Indicator**: Small icon in bottom-right when online

3. **Toast Notifications**
   - Notifies users when going offline
   - Shows sync progress when coming back online
   - Confirms when all changes are synced

4. **Pending Write Tracking**
   - Tracks all writes made while offline
   - Shows count of pending operations
   - Automatically clears when synced

## What Works Offline

✅ **All CRUD Operations**
- Create customers, loans, employees
- Update any existing data
- Delete records
- Record payments
- Add collateral

✅ **Data Reading**
- View all cached data
- Search through local cache
- View dashboards (with cached data)

❌ **What Doesn't Work Offline**
- File uploads (requires active connection)
- Real-time updates from other users
- Email notifications
- External API calls (DeepSeek AI, etc.)

## User Experience

### When Going Offline

1. User sees an amber banner at the top: "You're offline"
2. Toast notification explains that changes will be saved locally
3. All operations continue to work normally
4. Pending write count appears in the banner

### When Coming Back Online

1. Banner changes to green: "Back online" or "Syncing..."
2. Toast shows sync progress
3. All pending writes are automatically synced
4. Success notification when sync completes

### During Offline Work

- Users can continue adding/editing data normally
- All changes are saved to local IndexedDB
- No errors or interruptions
- Data appears immediately in the UI

## Technical Implementation

### Files Created

1. **`src/hooks/useOfflineStatus.ts`**
   - Hook to monitor online/offline status
   - Tracks pending writes
   - Monitors sync state

2. **`src/components/offline/OfflineIndicator.tsx`**
   - UI component showing offline status
   - Animated banners and indicators
   - Pending write counter

3. **`src/lib/firebase/offline-helpers.ts`**
   - Helper functions for offline operations
   - Write tracking utilities
   - Connection state monitoring

4. **`src/hooks/useOfflineToast.ts`**
   - Toast notifications for offline events
   - User-friendly messages

### Firestore Configuration

Offline persistence is enabled in `src/lib/firebase/config.ts`:

```typescript
enableIndexedDbPersistence(db, { cacheSizeBytes: CACHE_SIZE_UNLIMITED })
```

This enables:
- Unlimited cache size
- Automatic write queuing
- Background sync when online

## Testing Offline Mode

### To Test Offline Functionality:

1. **Chrome DevTools**:
   - Open DevTools (F12)
   - Go to Network tab
   - Select "Offline" from throttling dropdown

2. **Browser Settings**:
   - Disable WiFi/Network adapter
   - Or use airplane mode

3. **What to Test**:
   - Create a new customer while offline
   - Update a loan while offline
   - Record a payment while offline
   - Go back online and verify sync

### Expected Behavior

- ✅ All operations should work without errors
- ✅ Data should appear immediately in UI
- ✅ Offline banner should show
- ✅ When back online, sync should happen automatically
- ✅ No data should be lost

## Best Practices

1. **Always save locally first** - Firestore does this automatically
2. **Show user feedback** - Users should know when offline
3. **Track pending operations** - So users know what's queued
4. **Handle conflicts gracefully** - Firestore handles this automatically
5. **Test offline scenarios** - Ensure critical flows work offline

## Limitations

- **File uploads** require active connection (Firebase Storage)
- **Real-time collaboration** won't work offline
- **External APIs** won't work offline
- **Large data sets** may take time to sync

## Future Enhancements

- [ ] Queue file uploads for when online
- [ ] Show detailed sync progress
- [ ] Allow manual sync trigger
- [ ] Conflict resolution UI
- [ ] Offline data size management

