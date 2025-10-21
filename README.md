# 🎸 Pop Punk Website - Josh Holmes Music

A Next.js website for streaming music with integrated Meta (Facebook) Conversions API tracking.

## 🔧 Recent Fixes (October 2025)

**Fixed Meta Conversions API Connection Issues:**

- ✅ Added required `event_source_url` field
- ✅ Removed null values from user_data (Meta rejects these)
- ✅ Enhanced error logging with full API responses
- ✅ Added environment variable validation
- ✅ Added test event support for safe testing

**📚 See [CHANGES_SUMMARY.md](./CHANGES_SUMMARY.md) for full details**

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required variables:

- `NEXT_PUBLIC_META_PIXEL_ID` - From Meta Events Manager
- `META_CAPI_TOKEN` - From Meta Conversions API settings
- `NEXT_PUBLIC_SUPABASE_URL` - From Supabase project
- `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` - From Supabase project

### 3. Configure Supabase Edge Functions

In Supabase Dashboard → Project Settings → Edge Functions, add:

- `META_PIXEL_ID`
- `META_CAPI_TOKEN`
- `META_TEST_EVENT_CODE` (optional, for testing)

**📖 See [META_SETUP.md](./META_SETUP.md) for detailed setup instructions**

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the site.

### 5. Deploy Edge Function

```bash
supabase functions deploy click
```

## 📚 Documentation

- **[META_SETUP.md](./META_SETUP.md)** - Complete setup and troubleshooting guide
- **[META_CHECKLIST.md](./META_CHECKLIST.md)** - Quick testing checklist
- **[CHANGES_SUMMARY.md](./CHANGES_SUMMARY.md)** - What was fixed and why
- **[.env.example](./.env.example)** - Environment variables template

## 🧪 Testing

### Test with Meta Test Events:

1. Get test code from Meta Events Manager → Test Events
2. Add `META_TEST_EVENT_CODE` to your environment
3. Click a platform button (e.g., Spotify on `/music/say-yes`)
4. Check Meta Events Manager → Test Events

### View Logs:

```bash
# Edge Function logs
supabase functions logs click --tail

# Local development logs
npm run dev
# Check terminal output
```

## 🏗️ Architecture

```
User Clicks Button (Frontend)
    ↓
    ├─→ Facebook Pixel (Browser-side)
    │   └─→ Meta directly via JavaScript
    │
    └─→ Supabase Edge Function (Server-side)
        ├─→ Save to Database (visits + events tables)
        └─→ Meta Conversions API (Server-to-Server)
            └─→ Meta Events Manager
```

## 🔍 Verify It's Working

**1. Check Edge Function Logs:**

```bash
supabase functions logs click --tail
```

Should see: `Meta CAPI Success: { events_received: 1, ... }`

**2. Check Meta Events Manager:**

- Go to Test Events (with test code) or Events tab
- See "OutboundClick" events appearing

**3. Check Database:**

```sql
SELECT * FROM events ORDER BY event_time DESC LIMIT 5;
```

## 🐛 Troubleshooting

| Issue                        | Quick Fix                                     |
| ---------------------------- | --------------------------------------------- |
| "Missing Meta credentials"   | Set env vars in Supabase Dashboard            |
| "Invalid OAuth access token" | Regenerate token in Meta Events Manager       |
| No events showing            | Add `META_TEST_EVENT_CODE` to see test events |

**See [META_SETUP.md](./META_SETUP.md) for detailed troubleshooting**

## 📁 Key Files

- `supabase/functions/click/index.ts` - Edge Function for tracking
- `src/app/music/say-yes/ClientPage.tsx` - Streaming platform buttons
- `src/app/layout.tsx` - Meta Pixel initialization
- `src/app/api/click/route.ts` - Next.js API route (alternative)

## 🔐 Security

- Never commit `.env.local` to git
- Use service role key only in server-side code
- Keep Meta CAPI token server-side only

## 📞 Resources

- [Meta Conversions API Docs](https://developers.facebook.com/docs/marketing-api/conversions-api)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Next.js Documentation](https://nextjs.org/docs)

---

**Status**: ✅ All Meta CAPI issues fixed  
**Last Updated**: October 17, 2025
