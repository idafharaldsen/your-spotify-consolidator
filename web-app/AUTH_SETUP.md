# Authentication Setup Guide

This guide will help you set up authentication with Supabase and NextAuth.js v5.

## Prerequisites

1. A Supabase account (sign up at https://supabase.com)
2. A Supabase project created
3. Google OAuth credentials (required, for Google sign-in)

## Step 1: Set Up Supabase

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Select your project (or create a new one)

### Get Database Connection String

The connection string location varies in Supabase. Try these steps:

**Option 1: Find Connection String Section**
1. Navigate to **Settings** → **Database**
2. Look for sections like:
   - **Connection string**
   - **Connection info**
   - **Connection parameters**
3. If you see tabs (URI, JDBC, etc.), select the **URI** tab
4. Copy the connection string and replace `[YOUR-PASSWORD]` with your actual password

**Option 2: Construct Manually**
If you can't find a connection string section, build it from the Database Settings page:

1. On the **Database Settings** page, note:
   - **Database password** (shown in the "Database password" section)
   - Look for connection info showing the host (usually `db.[PROJECT-REF].supabase.co`)

2. Construct the connection string:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```
   - Replace `[YOUR-PASSWORD]` with your actual database password
   - Replace `[PROJECT-REF]` with your project reference (found in your Supabase URL or connection info)
   - Default values: Port `5432`, Database `postgres`, User `postgres`

**Option 3: Use Connection Pooling String**
Some Supabase projects show connection strings in the **Connection pooling** section. Look for a URI format there.

**To find your project reference:**
- Check your Supabase project URL: `https://[PROJECT-REF].supabase.co`
- Or look in **Settings** → **API** for connection details

### Get API Keys (Required for authentication)

1. Navigate to **Settings** → **API**
2. You'll see:
   - **Project URL** - This is your `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key - This is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key - This is your `SUPABASE_SERVICE_ROLE_KEY` (scroll down or look for it)

**Important:** The service_role key bypasses Row Level Security. Keep it secret and only use it server-side (which we do in the auth callbacks).

## Step 2: Set Up Database Tables

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run the SQL script from `setup-tables.sql` to create the necessary tables for NextAuth.js (users, accounts, verification_tokens)

**Note:** We're using JWT sessions (not database sessions), so the `sessions` table won't be used, but it's still created by the schema.

## Step 3: Configure Environment Variables

Create a `.env.local` file in the `web-app` directory with:

```env
# NextAuth (Required)
AUTH_SECRET=generate_with_openssl_rand_base64_32
AUTH_URL=http://localhost:3000

# Google OAuth (Required)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Supabase API Keys (Required for authentication)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Note: Get service_role key from Settings → API (not the anon key!)
# This key bypasses RLS and is needed for server-side user creation
```

### Generate AUTH_SECRET

Run this command to generate a secure secret:

```bash
openssl rand -base64 32
```

## Step 4: Set Up Google OAuth (Required)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Set authorized redirect URI to: `http://localhost:3000/api/auth/callback/google`
   - For production, also add: `https://yourdomain.com/api/auth/callback/google`
6. Copy the Client ID and Client Secret to your `.env.local`

## Step 5: Test the Setup

1. Start the development server:

```bash
cd web-app
npm run dev
```

2. Navigate to http://localhost:3000
3. You should be redirected to `/auth/signin`
4. Click "Sign in with Google" to test authentication

## Troubleshooting

### Database Connection Issues

- Make sure your `DATABASE_URL` is correct
- Check that your Supabase project is active
- Verify the password in the connection string

### NextAuth Errors

- Make sure `AUTH_SECRET` is set and is at least 32 characters
- Verify `AUTH_URL` matches your application URL
- Check that all required environment variables are set

### Database Issues

- Check that your `DATABASE_URL` is accessible
- Make sure you've run the SQL script from `setup-tables.sql` in Supabase SQL Editor
- Verify tables exist in Supabase Table Editor

## Step 6: Set Up Supabase Storage Buckets

After authentication is working, set up storage buckets for user file uploads:

1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **Create a new bucket**
4. Configure the bucket:
   - **Name**: `user-files` (must match the bucket name in code)
   - **Public bucket**: Toggle **OFF** (private bucket for security)
   - **File size limit**: Set appropriate limit (e.g., 50MB per file)
   - **Allowed MIME types**: Leave empty or add `application/json` if you want to restrict to JSON files

5. **Row Level Security (RLS) - Optional:**
   
   Since we're using NextAuth (not Supabase Auth) and the service role key for all operations, RLS policies won't apply to our server-side code. However, you can still set up policies for additional security if you plan to allow direct client-side access in the future.
   
   **Option A: Disable RLS (Recommended for now)**
   - Keep the bucket private
   - All access goes through server-side API routes with authentication checks
   - This is the current implementation approach
   
   **Option B: Set up RLS policies (for future client-side access)**
   - If you want to allow direct client-side access later, you'll need to:
     1. Set up Supabase Auth alongside NextAuth, OR
     2. Create custom RLS policies that work with your user ID system
   - For now, this is not necessary since all operations use the service role key

### Update Database Schema

Run the updated SQL script from `setup-tables.sql` in Supabase SQL Editor to create the `user_files` table for tracking file metadata.

## Next Steps

After storage is set up:

1. Test file upload using the `/api/upload` endpoint
2. Create user-specific data models
3. Implement file upload UI component
4. Set up background job processing for data analysis

