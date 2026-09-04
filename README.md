# AURA: Your Private AI Memory Layer

> GenAI Academy / Google Cloud Run AI Challenge Submission
> Resource Label: `dev-tutorial=cloud-run-ai-challenge`

AURA is an authenticated personal AI workspace and memory layer built on Google Cloud Run, Cloud Firestore, Firebase Authentication, Google Drive, and Google Gemini Flash (`@google/genai`).

---

## 1. Product Concept

Traditional AI assistants suffer from conversational amnesia: they forget context the moment a session ends, or force users to manually paste endless background notes.

AURA solves this by providing an **intelligent, owner-isolated private memory layer**:
1. **Talk Naturally**: User engages in conversational reflections or work planning.
2. **Selective Extraction**: Gemini analyzes conversational turns server-side to extract long-term goals, project details, and personal preferences while ignoring trivial banter.
3. **Contextual Retrieval**: In subsequent turns, AURA retrieves the most relevant memories, citing them directly.
4. **Explainable AI**: The user can open **Context used** on any response to inspect which memories influenced the AI and forget any memory with one click.
5. **Private Knowledge Graph**: An interactive visual topography of the user's mind, goals, and tasks.
6. **Executive Daily Brief**: Synthesizes morning priorities and recommendations strictly from user-owned data.
7. **Sovereign Google Drive Sync**: One-click encrypted snapshot backups directly to the user's personal Google Drive using the least-privilege `drive.file` scope.

---

## 2. Zero-Trust Security Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│ UNTRUSTED CLIENT ZONE (Browser / React SPA)                           │
│                                                                        │
│  • Google Sign-In (Firebase Auth Client SDK)                          │
│  • Google Drive Sync (Client GSI Token Client - scope: drive.file)     │
│  • Private Dashboard, Conversation UI, Memory Graph, Privacy Center   │
│  • Acquires Firebase ID Token (JWT) on every privileged request       │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ HTTPS / Bearer <Firebase_ID_Token>
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TRUSTED SERVER ZONE (Node.js / Express on Google Cloud Run)            │
│                                                                        │
│  [1. Security Middleware]                                              │
│      ├── Security Headers (X-Content-Type-Options, Frame protection)   │
│      ├── Payload Sanitization & Size Constraints (max 200kb)          │
│      └── Firebase Auth Token Verifier (resolves immutable req.uid)    │
│                                                                        │
│  [2. Orchestration Services]                                           │
│      ├── Memory Engine (retrieveRelevantMemories with scoring)         │
│      ├── Gemini Service (@google/genai, server-side secret injection)   │
│      ├── Extraction Pipeline (Structured JSON memories, goals, tasks)  │
│      └── Audit & Sanitization Logger                                   │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │ Server SDK                      │ gRPC / REST
                   ▼                                 ▼
┌──────────────────────────────────┐ ┌───────────────────────────────────┐
│ Cloud Firestore (Owner-Scoped)   │ │ Google Cloud Secret Manager       │
│                                  │ │                                   │
│  users/{uid}/conversations       │ │  projects/.../secrets/            │
│  users/{uid}/memories            │ │  GEMINI_API_KEY                   │
│  users/{uid}/goals & tasks       │ │                                   │
│  users/{uid}/dailyBriefs         │ │ Injected securely into Cloud Run │
│  Security Rules: uid == auth.uid │ └───────────────────────────────────┘
└──────────────────────────────────┘
```

### Security Guarantees:
- **No Client UID Trust**: The backend resolves identity strictly from verified RS256 Firebase ID Tokens.
- **Mathematical Multi-Tenancy**: Firestore security rules mandate `request.auth.uid == userId` for every sub-resource.
- **Indirect Prompt Injection Defense**: Memory context is wrapped in immutable `<user_memory_context>` tags and treated strictly as untrusted data.
- **Zero API Key Leakage**: Gemini API keys are never bundled into client JavaScript.
- **Least-Privilege Drive Access**: Only `https://www.googleapis.com/auth/drive.file` is requested.

---

## 3. Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Motion
- **Backend**: Express on Node.js / Cloud Run
- **Identity**: Firebase Authentication with Google Sign-In
- **Database**: Google Cloud Firestore (Multi-tenant owner-scoped)
- **AI Engine**: `@google/genai` with Resilient Model Fallback Ladder (`gemini-3.6-flash` -> `gemini-3.1-flash-lite` -> `gemini-flash-latest` -> `gemini-3.7-flash`)
- **Secrets**: Google Cloud Secret Manager
- **External Integration**: Google Drive v3 REST API (least-privilege `drive.file` scope)

---

## 4. Local Development & Automated Testing

```bash
# 1. Clone repository
git clone https://github.com/your-org/aura.git
cd aura

# 2. Install dependencies
npm install

# 3. Configure local environment
cp .env.example .env
# Edit .env and supply GEMINI_API_KEY for local development

# 4. Run automated security and invariant test suite
npm test

# 5. Run static analysis & type validation
npm run lint

# 6. Start full-stack development server (Express + Vite)
npm run dev
```

Visit `http://localhost:3000` to interact with AURA.

---

## 5. Cloud Run Deployment Guide

### Prerequisites
1. Ensure Google Cloud SDK (`gcloud`) is installed and authenticated:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```
2. Enable required services:
   ```bash
   gcloud services enable \
     run.googleapis.com \
     secretmanager.googleapis.com \
     firestore.googleapis.com \
     drive.googleapis.com
   ```

### 1. Store Gemini API Key in Secret Manager & Configure IAM
```bash
# Create and populate the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# Grant the default Cloud Run service account access to read the secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 2. Firestore Schema & Security Configuration
Cloud Firestore is provisioned in Native mode with strict owner-bound rules enforcing user data isolation across all subcollections:

**Subcollection Hierarchy**:
- `/users/{userId}`: User profile document
- `/users/{userId}/conversations/{conversationId}`: Conversation threads
- `/users/{userId}/conversations/{conversationId}/messages/{messageId}`: Immutable message entries
- `/users/{userId}/memories/{memoryId}`: Categorized long-term intelligence items
- `/users/{userId}/goals/{goalId}`: Active, completed, and archived goals
- `/users/{userId}/tasks/{taskId}`: Actionable tasks with due dates
- `/users/{userId}/insights/{insightId}`: Strategic reflections & recurring patterns
- `/users/{userId}/dailyBriefs/{briefId}`: Executive daily briefings
- `/users/{userId}/settings/{configId}`: Privacy toggles & extraction policies

**Firestore Security Rules (`firestore.rules`)**:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Global default deny
    match /{document=**} {
      allow read, write: if false;
    }

    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    match /users/{userId} {
      allow get, create, update, delete: if isOwner(userId);
      allow list: if false;

      match /{allSubcollections=**} {
        allow read, write: if isOwner(userId);
      }
    }
  }
}
```
Deploy the security rules:
```bash
firebase deploy --only firestore:rules
```

### 3. Build and Deploy to Cloud Run
```bash
# Build the production bundle
npm run build

# Deploy container to Cloud Run with challenge label
gcloud run deploy aura \
  --source . \
  --platform managed \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --set-labels="dev-tutorial=cloud-run-ai-challenge"
```

### 4. Automated Challenge Verification Binding
To verify or update the mandatory challenge registration label at any time:
```bash
gcloud run services update aura \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=asia-southeast1
```

---

## 6. Judge Evaluation Walkthrough

1. **Sign In**: Click **Sign in with Google** on the landing page.
2. **Initial Reflection**: Send a message such as:
   > *"I am actively preparing for software engineering interviews, and my goal is to master Google Cloud Run and system design over the next 4 weeks. I prefer concise bullet points."*
3. **Inspect Output & Citations**: Observe AURA formulate advice and automatically extract the goal into your private store.
4. **Future Turn & Context Use**: In the next message, ask:
   > *"What should I focus on first?"*
   Notice the **Context used (1 memory)** banner appear. Click it to view the exact citation and confidence metrics.
5. **Memory Graph**: Switch to the **Memory Graph** tab to explore the cognitive topography.
6. **Executive Daily Brief**: Click **Daily Brief** to synthesize priorities.
7. **Privacy Center & Drive Sync**: Open the **Privacy Center** to toggle extraction settings, view the security architecture, or perform a sovereign backup to Google Drive.

---

## 7. Known Limitations & Operational Considerations

- **Embedded iFrame Constraints**: In sandboxed development preview iframes, third-party cookies or cross-origin popup blockers may affect external OAuth redirects. Open the application in a full browser tab for optimal authentication flow.
- **Least-Privilege Drive Scope**: Google Drive backups utilize `https://www.googleapis.com/auth/drive.file`. AURA has zero access to the user's broader Drive files or directories—only the specific snapshot backup files created by AURA.
- **Resilient AI Fallback Ladder**: If the primary Gemini model (`gemini-3.6-flash`) experiences API rate limits or regional availability spikes, the server automatically recovers through `gemini-3.1-flash-lite`, `gemini-flash-latest`, and `gemini-3.7-flash`.
